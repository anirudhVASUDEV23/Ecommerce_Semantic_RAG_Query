import sqlite3
import re
import asyncio
import pandas as pd
from groq import AsyncGroq
from pathlib import Path
from config import settings

GROQ_MODEL = settings.GROQ_MODEL
db_path = Path(__file__).parent / "db.sqlite"
client_sql = AsyncGroq(api_key=settings.GROQ_API_KEY)  # explicit key from config

# ── Blocked SQL patterns (safety) ─────────────────────────────────────────────
_BLOCKED = re.compile(
    r"\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|TRUNCATE|REPLACE|MERGE)\b",
    re.IGNORECASE,
)

sql_prompt = """You are an expert in understanding the database schema and generating SQL queries for a natural language question asked
pertaining to the data you have. The schema is provided in the schema tags. 
<schema> 
table: product 

fields: 
product_link - string (hyperlink to product)	
title - string (name of the product)	
brand - string (brand of the product)	
price - integer (price of the product in Indian Rupees)	
discount - float (discount on the product. 10 percent discount is represented as 0.1, 20 percent as 0.2, and such.)	
avg_rating - float (average rating of the product. Range 0-5, 5 is the highest.)	
total_ratings - integer (total number of ratings for the product)

</schema>
Make sure whenever you try to search for the brand name, the name can be in any case. 
So, make sure to use %LIKE% to find the brand in condition. Never use "ILIKE". 

IMPORTANT: The 'title' column contains the product name and description (e.g., "Campus Women Running Shoes"). 
If the user asks for "Ladies shoes", "Running shoes", "Walking shoes", etc., you MUST search the 'title' column using `LIKE %keyword%`.
Example: For "Ladies shoes", add `title LIKE '%Women%' OR title LIKE '%Ladies%'` to the WHERE clause.

Create a single SQL query for the question provided. 
The query should have all the fields in SELECT clause (i.e. SELECT *)

Just the SQL query is needed, nothing more. Always provide the SQL in between the <SQL></SQL> tags.
ALWAYS add LIMIT 5 to the query to avoid large payloads."""


comprehension_prompt = """You are an expert in understanding the context of the question and replying based on the data pertaining to the question provided. You will be provided with Question: and Data:. The data will be in the form of an array or a dataframe or dict. Reply based on only the data provided as Data for answering the question asked as Question. Do not write anything like 'Based on the data' or any other technical words. Just a plain simple natural language response.
The Data would always be in context to the question asked. For example if the question is "What is the average rating?" and data is "4.3", then answer should be "The average rating for the product is 4.3". So make sure the response is curated with the question and data. Make sure to note the column names to have some context, if needed, for your response.
There can also be cases where you are given an entire dataframe in the Data: field. Always remember that the data field contains the answer of the question asked. All you need to do is to always reply in the following format when asked about a product: 
Produt title, price in indian rupees, discount, and rating, and then product link. Take care that all the products are listed in list format, one line after the other. Not as a paragraph.
For example:
1. Campus Women Running Shoes: Rs. 1104 (35 percent off), Rating: 4.4 <link>
2. Campus Women Running Shoes: Rs. 1104 (35 percent off), Rating: 4.4 <link>
3. Campus Women Running Shoes: Rs. 1104 (35 percent off), Rating: 4.4 <link>
"""


# ── SQL Safety ────────────────────────────────────────────────────────────────
def validate_sql(query: str) -> None:
    """Raise ValueError if query is not a safe SELECT statement."""
    stripped = query.strip().upper()
    if not stripped.startswith("SELECT"):
        raise ValueError(f"Only SELECT queries are allowed. Got: {query[:80]}")
    if _BLOCKED.search(query):
        raise ValueError(f"Query contains a blocked SQL keyword: {query[:80]}")


# ── DB ────────────────────────────────────────────────────────────────────────
def _run_query_sync(query: str) -> pd.DataFrame:
    validate_sql(query)
    with sqlite3.connect(db_path) as conn:
        return pd.read_sql_query(query, conn)


async def run_query(query: str) -> pd.DataFrame:
    """Run a SELECT query against SQLite in a thread (non-blocking)."""
    return await asyncio.to_thread(_run_query_sync, query)


# ── LLM calls ─────────────────────────────────────────────────────────────────
async def generate_sql_query(question: str, history: list[dict] | None = None) -> str:
    messages = [{"role": "system", "content": sql_prompt}]
    if history:
        messages.extend(history[-10:])  # last 5 turns (10 messages)
    messages.append({"role": "user", "content": question})

    completion = await client_sql.chat.completions.create(
        messages=messages,
        model=GROQ_MODEL,
        temperature=0.2,
        max_tokens=1024,
    )
    return completion.choices[0].message.content


async def data_comprehension(
    question: str, context: list, history: list[dict] | None = None
) -> str:
    messages = [{"role": "system", "content": comprehension_prompt}]
    if history:
        messages.extend(history[-10:])
    messages.append({"role": "user", "content": f"Question: {question}\nData: {context}"})

    completion = await client_sql.chat.completions.create(
        messages=messages,
        model=GROQ_MODEL,
        temperature=0.2,
    )
    return completion.choices[0].message.content


# ── Chain ─────────────────────────────────────────────────────────────────────
async def sql_chain(question: str, history: list[dict] | None = None) -> str | list:
    sql_raw = await generate_sql_query(question, history)
    matches = re.findall(r"<SQL>(.*?)</SQL>", sql_raw, re.DOTALL)

    if not matches:
        return "Sorry, we do not have the data to answer this question. Please ask another question."

    try:
        df = await run_query(matches[0].strip())
    except ValueError as e:
        return f"Invalid query generated: {e}"

    if df is None or df.empty:
        return "Sorry, we do not have the data to answer this question. Please ask another question."

    context = df.head(5).to_dict(orient="records")

    if "product_link" in df.columns:
        return context  # formatted by the caller (api.py / main.py)

    return await data_comprehension(question, context, history)


if __name__ == "__main__":
    import asyncio

    async def _test():
        question = "Give me Puma Shoes with rating higher than 4.5 and more than 30% discount"
        print(await sql_chain(question))

    asyncio.run(_test())