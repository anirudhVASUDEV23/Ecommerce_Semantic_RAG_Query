import asyncio
import logging
from typing import AsyncGenerator

from groq import AsyncGroq
from pinecone import Pinecone

from config import settings

logger = logging.getLogger(__name__)

GROQ_MODEL = settings.GROQ_MODEL

# ── Pinecone client & index ───────────────────────────────────────────────────
_pc = Pinecone(api_key=settings.PINECONE_API_KEY)
# Connect directly to the index host for lowest latency
_index = _pc.Index(host=settings.PINECONE_INDEX_HOST)

# Namespace used in all upsert/search calls
_NAMESPACE = "_default_"

# Groq client for LLM calls
groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

_SYSTEM_PROMPT = "You are a helpful e-commerce customer support assistant."

# ── Out-of-scope canned reply ─────────────────────────────────────────────────
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
    'reply with exactly: "'
    + _OUT_OF_SCOPE
    + '"'
)


# ── Ingestion (called once at startup / on demand) ────────────────────────────
def ingest_faq_data(path) -> None:
    """
    Load FAQ CSV into Pinecone using integrated embeddings.
    Pinecone's llama-text-embed-v2 model handles embedding server-side.
    Skip if records already exist in the index.
    """
    import pandas as pd

    stats = _index.describe_index_stats()
    total = stats.get("total_vector_count", 0)
    # For integrated-embedding indexes the key is namespaces
    ns_stats = stats.get("namespaces", {})
    ns_count = ns_stats.get(_NAMESPACE, {}).get("vector_count", 0)

    if ns_count > 0:
        logger.info(
            "Pinecone index already has %d records in namespace '%s' — skipping ingestion.",
            ns_count, _NAMESPACE,
        )
        return

    logger.info("Ingesting FAQ data to Pinecone (%s)…", settings.PINECONE_INDEX_NAME)
    df = pd.read_csv(path)

    # Build records — Pinecone embeds the 'text' field automatically
    records = [
        {
            "id": f"faq_{i}",
            "text": row["question"],   # field mapped for embedding
            "answer": row["answer"],   # stored as metadata
        }
        for i, row in df.iterrows()
    ]

    # Upsert in batches of 96 (Pinecone inference limit per call)
    batch_size = 96
    for start in range(0, len(records), batch_size):
        batch = records[start : start + batch_size]
        _index.upsert_records(_NAMESPACE, batch)

    logger.info("Ingested %d FAQs into Pinecone.", len(records))


# ── Retrieval ─────────────────────────────────────────────────────────────────
def _search_faq_sync(query: str) -> list[dict]:
    """
    Search Pinecone using integrated embeddings.
    Send only text — Pinecone generates the query embedding server-side.
    """
    results = _index.search(
        namespace=_NAMESPACE,
        query={"inputs": {"text": query}, "top_k": 2},
        fields=["text", "answer"],
    )
    hits = results.get("result", {}).get("hits", [])
    return [hit.get("fields", {}) for hit in hits]


async def get_relevant_qa(query: str) -> list[dict]:
    """Async wrapper — Pinecone SDK is synchronous."""
    return await asyncio.to_thread(_search_faq_sync, query)


# ── General LLM fallback (uses conversation history only) ────────────────────
async def general_llm_fallback(
    query: str, history: list[dict] | None = None
) -> str:
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
    hits = await get_relevant_qa(query)
    context = "\n".join(h.get("answer", "") for h in hits)
    return await generate_answer(query, context, history)


async def faq_chain_stream(
    query: str, history: list[dict] | None = None
) -> AsyncGenerator[str, None]:
    """Async generator for streaming FAQ answers."""
    hits = await get_relevant_qa(query)
    context = "\n".join(h.get("answer", "") for h in hits)
    async for chunk in generate_answer_stream(query, context, history):
        yield chunk


if __name__ == "__main__":
    from pathlib import Path

    faqs_path = Path(__file__).parent / "resources/faq_data.csv"
    ingest_faq_data(faqs_path)

    async def _test():
        print(await faq_chain("what is the return policy?"))

    asyncio.run(_test())