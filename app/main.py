import streamlit as st 
from router import router
from faq import faq_chain,ingest_faq_data
from pathlib import Path


faqs_path=Path(__file__).parent/"resources/faq_data.csv"

@st.cache_resource
def setup_faq_data_ingestion():
    """
    Ingests FAQ data into ChromaDB (or whatever backend ingest_faq_data uses).
    This function will only run once when the Streamlit app starts.
    """
   
    ingest_faq_data(faqs_path)
    

setup_faq_data_ingestion()

def ask(query):
    route=router(query).name
    if route == "faq":
        
        return faq_chain(query)
    else:
       
        return f"Route {route} not Implemented yet"


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
    with st.chat_message("ai"):
        st.markdown(response)

    st.session_state["messages"].append({"role":"ai","content":response})