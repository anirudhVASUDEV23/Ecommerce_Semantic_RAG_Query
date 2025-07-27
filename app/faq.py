import pandas as pd
from pathlib import Path
import chromadb
from chromadb.utils import embedding_functions
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

import os
GROQ_API_KEY=os.environ['GROQ_API_KEY']
GROQ_MODEL=os.environ['GROQ_MODEL']

faqs_path=Path(__file__).parent/"resources/faq_data.csv"
chroma_client=chromadb.Client()##just like ram only in memory
collection_name_faq="faqs"
groq_client=Groq()


ef=embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)


def ingest_faq_data(path):
    if collection_name_faq not in [collection.name for collection in chroma_client.list_collections()]:
        print("Ingesting FAQ data to ChromaDB")
        collection=chroma_client.get_or_create_collection(
        name=collection_name_faq,
        embedding_function=ef)
        df=pd.read_csv(path) 
        docs=df['question'].to_list()##we will create embedding only for questions right cuz bruh commonsense
        metadata=[{'answer':answer} for answer in df['answer'].to_list()]
        ids=[f"id_{idx}" for idx in range(len(docs))]
        collection.add(
            documents=docs,
            metadatas=metadata,
            ids=ids
        )
    else:
        print(f"Collection {collection_name_faq} already exists")


def get_relevant_qa(query):
    collection=chroma_client.get_collection(collection_name_faq)
    result=collection.query(
        query_texts=[query],
        n_results=2
    )
    return result

##'metadatas': [[{'answer': 'You can return products within 30 days of delivery.'}, {'answer': 'Contact our support team within 48 hours for a replacement or refund.'}]] we have answers in result['metadata'][0]
def faq_chain(query):
    result=get_relevant_qa(query)
    context=''.join([r.get('answer') for r in result['metadatas'][0]])
    answer= generate_answer(query,context)
    return answer


def generate_answer(query,context):
    prompt=f'''Given the question and context given below generate the answer based on the context only.
    If you don't find the answer inside the context then just say "I don't know".
    Do not make things up

    QUESTION:{query}
    CONTEXT:{context}
    '''

    ##call llm
    chat_completion=groq_client.chat.completions.create(
        messages=[
            {
                "role":"user",
                "content":prompt
            }
        ],
        model=GROQ_MODEL
    )

    return chat_completion.choices[0].message.content



if __name__ == '__main__':
    ingest_faq_data(faqs_path)
    query="what is the policy of defective products?"

    answer=faq_chain(query)
    print(answer)