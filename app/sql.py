import sqlite3
import pandas as pd
from groq import Groq
import os
import re
from pathlib import Path
from pandas import DataFrame
from dotenv import load_dotenv

load_dotenv()

# ##The Pandas DataFrame method df.to_dict(orient="records") converts a DataFrame into a list of dictionaries.

# Here's a breakdown of what it does:

# df: This refers to your Pandas DataFrame.

# .to_dict(): This is a method that converts the DataFrame into a Python dictionary.

# orient="records": This argument specifies the format of the output dictionary. When orient is set to "records", the DataFrame is converted into a list of dictionaries.

# Each dictionary in the list represents a row from the DataFrame.

# The keys of each dictionary are the column names of the DataFrame.

# The values in each dictionary are the data values for that specific row and column.

# Example:

# Let's say you have a DataFrame df like this:

#    Name  Age  City
# 0  Alice   30  NYC
# 1    Bob   24  LA
# 2  Charlie 35  Chicago
# Using df.to_dict(orient="records") would produce the following output:

# Python

# [
#     {'Name': 'Alice', 'Age': 30, 'City': 'NYC'},
#     {'Name': 'Bob', 'Age': 24, 'City': 'LA'},
#     {'Name': 'Charlie', 'Age': 35, 'City': 'Chicago'}
# ]  This format is very common and useful when you need to serialize DataFrame data into a JSON-like structure, process row by row, or pass it to APIs that expect a list of objects.

GROQ_MODEL=os.environ['GROQ_MODEL']

db_path=Path(__file__).parent/"db.sqlite"
client_sql=Groq()

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

def run_query(query):
    if query.strip().upper().startswith('SELECT'):##as the query will be passed by an LLM
            with sqlite3.connect(db_path) as conn:
                df=pd.read_sql_query(query,conn)
                return df


def sql_chain(question):
    sql_query = generate_sql_query(question)
    pattern = "<SQL>(.*?)</SQL>"
    matches = re.findall(pattern, sql_query, re.DOTALL)

    if len(matches) == 0:
        return "Sorry, we do not have the data to answer this question. Please ask another question."

    response = run_query(matches[0].strip())
    if response is None or response.empty:
        return "Sorry, we do not have the data to answer this question. Please ask another question."


    
    # context = response.to_dict(orient="records")
    # Limit to top 5 records to avoid token limit errors
    context = response.head(5).to_dict(orient="records")

    # Check if the result is likely a product list (contains 'product_link')
    if 'product_link' in response.columns:
        return context

    answer = data_comprehension(question, context)
    return answer


def generate_sql_query(question):

    chat_completion=client_sql.chat.completions.create(
         messages=[
              {
                   "role":"system",
                   "content":sql_prompt
              },
              {
                   "role":"user",
                   "content":question
              }
         ],
         model=GROQ_MODEL,
         temperature=0.2,
         max_tokens=1024
    )

    return chat_completion.choices[0].message.content

def data_comprehension(question,context):

    chat_completion=client_sql.chat.completions.create(
         messages=[
              {
                   "role":"system",
                   "content":comprehension_prompt
              },
              {
                   "role":"user",
                   "content":f"Question: {question}\nData: {context}"
              }
         ],
         model=GROQ_MODEL,
         temperature=0.2,
         
    )

    return chat_completion.choices[0].message.content




if __name__=="__main__":

    question="Give me Puma Shoes with rating higher than 4.5 and more than 30% discount"

    answer=sql_chain(question)
    print(answer)