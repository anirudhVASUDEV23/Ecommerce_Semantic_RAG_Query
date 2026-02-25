import asyncio
import pandas as pd
from pathlib import Path
from typing import AsyncGenerator

import chromadb
from chromadb.utils import embedding_functions
from groq import AsyncGroq

from config import settings

GROQ_MODEL = settings.GROQ_MODEL

# ── ChromaDB (persistent) ─────────────────────────────────────────────────────
chroma_db_path = settings.CHROMA_DB_PATH
chroma_client = chromadb.PersistentClient(path=chroma_db_path)
collection_name_faq = "faqs"
groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)  # explicit key from config

ef = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

_SYSTEM_PROMPT = "You are a helpful e-commerce customer support assistant."


# ── Ingestion ─────────────────────────────────────────────────────────────────
def ingest_faq_data(path: str | Path) -> None:
    """Load FAQ CSV into persistent ChromaDB. No-op if collection already exists."""
    existing = [c.name for c in chroma_client.list_collections()]
    if collection_name_faq not in existing:
        print("Ingesting FAQ data to ChromaDB...")
        collection = chroma_client.get_or_create_collection(
            name=collection_name_faq,
            embedding_function=ef,
        )
        df = pd.read_csv(path)
        docs = df["question"].to_list()
        metadata = [{"answer": ans} for ans in df["answer"].to_list()]
        ids = [f"id_{i}" for i in range(len(docs))]
        collection.add(documents=docs, metadatas=metadata, ids=ids)
        print(f"Ingested {len(docs)} FAQs.")
    else:
        print(f"Collection '{collection_name_faq}' already exists — skipping ingestion.")


# ── Retrieval ─────────────────────────────────────────────────────────────────
def _get_relevant_qa_sync(query: str) -> dict:
    collection = chroma_client.get_collection(
        collection_name_faq, embedding_function=ef
    )
    return collection.query(query_texts=[query], n_results=2)


async def get_relevant_qa(query: str) -> dict:
    """Run ChromaDB query in a thread (ChromaDB is synchronous)."""
    return await asyncio.to_thread(_get_relevant_qa_sync, query)


# ── Out-of-scope canned reply ────────────────────────────────────────────────
_OUT_OF_SCOPE = (
    "I'm sorry, I don't have information about that. \n\n"
    "I can help you with:\n"
    "- 👟 **Finding shoes** — search by brand, price, rating, or discount\n"
    "- ❓ **Support questions** — returns, shipping, payments\n"
    "- 💬 **Follow-up questions** about shoes I've already shown you"
)

_FALLBACK_SYSTEM = (
    "You are FlipAssist, a Flipkart shoe-store assistant. "
    "Your ONLY job is to answer follow-up questions about products or topics "
    "already discussed in the conversation history below. "
    "Do NOT use any outside knowledge. "
    "Do NOT ask the user for more information or more context. "
    "If the question cannot be answered from the conversation history, "
    "reply with exactly: \""
    + _OUT_OF_SCOPE
    + "\""
)


# ── General LLM fallback (uses conversation history only) ────────────────────
async def general_llm_fallback(
    query: str, history: list[dict] | None = None
) -> str:
    """
    Answer a follow-up query using only conversation history.
    If there is no history context, return the canned out-of-scope message
    immediately without calling the LLM.
    """
    if not history:
        return _OUT_OF_SCOPE

    messages = [{"role": "system", "content": _FALLBACK_SYSTEM}]
    messages.extend(history[-10:])
    messages.append({"role": "user", "content": query})

    completion = await groq_client.chat.completions.create(
        messages=messages,
        model=GROQ_MODEL,
        temperature=0.1,
    )
    return completion.choices[0].message.content


async def general_llm_fallback_stream(
    query: str, history: list[dict] | None = None
) -> AsyncGenerator[str, None]:
    """Streaming version of general_llm_fallback."""
    if not history:
        yield _OUT_OF_SCOPE
        return

    messages = [{"role": "system", "content": _FALLBACK_SYSTEM}]
    messages.extend(history[-10:])
    messages.append({"role": "user", "content": query})

    stream = await groq_client.chat.completions.create(
        messages=messages,
        model=GROQ_MODEL,
        stream=True,
        temperature=0.1,
    )
    async for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            yield content


# ── LLM — non-streaming ───────────────────────────────────────────────────────
async def generate_answer(
    query: str, context: str, history: list[dict] | None = None
) -> str:
    prompt = (
        f"Given the question and context below, answer based only on the context.\n"
        f'If the answer is not in the context, say "I don\'t know". Do not make things up.\n\n'
        f"QUESTION: {query}\n"
        f"CONTEXT: {context}"
    )
    messages = [{"role": "system", "content": _SYSTEM_PROMPT}]
    if history:
        messages.extend(history[-10:])
    messages.append({"role": "user", "content": prompt})

    completion = await groq_client.chat.completions.create(
        messages=messages,
        model=GROQ_MODEL,
    )
    return completion.choices[0].message.content


# ── LLM — streaming ───────────────────────────────────────────────────────────
async def generate_answer_stream(
    query: str, context: str, history: list[dict] | None = None
) -> AsyncGenerator[str, None]:
    """Async generator yielding response text chunks."""
    prompt = (
        f"Given the question and context below, answer based only on the context.\n"
        f'If the answer is not in the context, say "I don\'t know". Do not make things up.\n\n'
        f"QUESTION: {query}\n"
        f"CONTEXT: {context}"
    )
    messages = [{"role": "system", "content": _SYSTEM_PROMPT}]
    if history:
        messages.extend(history[-10:])
    messages.append({"role": "user", "content": prompt})

    stream = await groq_client.chat.completions.create(
        messages=messages,
        model=GROQ_MODEL,
        stream=True,
    )
    async for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            yield content


# ── Chains ────────────────────────────────────────────────────────────────────
async def faq_chain(query: str, history: list[dict] | None = None) -> str:
    result = await get_relevant_qa(query)
    context = "".join(r.get("answer", "") for r in result["metadatas"][0])
    return await generate_answer(query, context, history)


async def faq_chain_stream(
    query: str, history: list[dict] | None = None
) -> AsyncGenerator[str, None]:
    """Async generator for streaming FAQ answers."""
    result = await get_relevant_qa(query)
    context = "".join(r.get("answer", "") for r in result["metadatas"][0])
    async for chunk in generate_answer_stream(query, context, history):
        yield chunk


if __name__ == "__main__":
    faqs_path = Path(__file__).parent / "resources/faq_data.csv"
    ingest_faq_data(faqs_path)

    async def _test():
        print(await faq_chain("what is the return policy?"))

    asyncio.run(_test())