import streamlit as st 
from router import router
from faq import faq_chain,ingest_faq_data
from pathlib import Path
from sql import sql_chain


faqs_path=Path(__file__).parent/"resources/faq_data.csv"

@st.cache_resource
def setup_faq_data_ingestion():
    """
    Ingests FAQ data into ChromaDB (or whatever backend ingest_faq_data uses).
    This function will only run once when the Streamlit app starts.
    """
   
    ingest_faq_data(faqs_path)
    

setup_faq_data_ingestion()

def format_product_list(products):
    formatted_output = ""
    for item in products:
        title = item.get('title', 'Unknown Product')
        price = item.get('price', 'N/A')
        discount = item.get('discount', 0)
        rating = item.get('avg_rating', 'No rating')
        link = item.get('product_link', '#')
        
        if isinstance(discount, (float, int)) and discount > 0:
            disc_text = f"({int(discount * 100)} percent off)"
        else:
            disc_text = "(No discount)"
            
        formatted_output += f"**{title}**: Rs. {price}, {disc_text}, Rating: {rating} [🔗]({link})\n\n"
    return formatted_output

def ask(query):
    route=router(query).name
    if route == "faq":
        print("Route is: faq")
        return faq_chain(query)
    elif route=="sql":
        print("Route is: sql")
        return sql_chain(query)
    else:
        return f"I don't have the knowledge to answer that question."


st.title("E-commerce Chatbot")


query=st.chat_input("Write your Query")

if "messages" not in st.session_state:
    st.session_state["messages"]=[]

for message in st.session_state.messages:
    with st.chat_message(message['role']):
        st.markdown(message['content'])


if query:
    with st.chat_message("user"):
        st.markdown(query)

    st.session_state["messages"].append({"role":"user","content":query})

    response=ask(query)
    
    if isinstance(response, list):
        response = format_product_list(response)
        
    with st.chat_message("ai"):
        st.markdown(response)

    st.session_state["messages"].append({"role":"ai","content":response})