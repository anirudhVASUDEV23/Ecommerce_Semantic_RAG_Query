import uuid

import requests
import streamlit as st

API_BASE = "http://localhost:8000"


# ── Health check ──────────────────────────────────────────────────────────────
@st.cache_resource(show_spinner=False)
def check_api_health() -> bool:
    try:
        r = requests.get(f"{API_BASE}/health", timeout=3)
        return r.status_code == 200
    except requests.exceptions.ConnectionError:
        return False


# ── Streaming generator ───────────────────────────────────────────────────────
def stream_response(query: str, session_id: str):
    """
    Generator that yields text chunks from POST /chat/stream.
    Compatible with st.write_stream().
    """
    try:
        with requests.post(
            f"{API_BASE}/chat/stream",
            json={"query": query, "session_id": session_id},
            stream=True,
            timeout=60,
        ) as r:
            r.raise_for_status()
            for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
                if chunk:
                    yield chunk
    except requests.exceptions.ConnectionError:
        yield "⚠️ Cannot reach the API server. Make sure `uvicorn api:app --reload --port 8000` is running."
    except requests.exceptions.HTTPError as e:
        yield f"⚠️ API error: {e.response.text}"
    except Exception as e:
        yield f"⚠️ Unexpected error: {e}"


# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="E-commerce Chatbot",
    page_icon="🛒",
    layout="centered",
)

st.title("🛒 E-commerce Chatbot")

api_ok = check_api_health()
if api_ok:
    st.success("API connected ✅", icon="🟢")
else:
    st.error(
        "FastAPI backend not reachable. Run: `uvicorn api:app --reload --port 8000`",
        icon="🔴",
    )

st.divider()

# ── Sidebar — Admin Stats ──────────────────────────────────────────────────────
with st.sidebar:
    st.header("🛠️ Admin")

    if st.button("🔄 Refresh Stats", use_container_width=True):
        try:
            r = requests.get(f"{API_BASE}/admin/stats", timeout=5)
            r.raise_for_status()
            stats = r.json()

            # Uptime
            st.subheader("⏱️ Uptime")
            st.info(stats["uptime"])

            # Sessions
            st.subheader("👥 Sessions")
            col1, col2 = st.columns(2)
            col1.metric("Active", stats["sessions"]["active"])
            col2.metric("Stored", stats["sessions"]["total_stored"])
            st.caption(f"TTL: {stats['sessions']['ttl_minutes']} min")

            # ChromaDB
            st.subheader("🗄️ ChromaDB")
            chroma = stats["chromadb"]
            st.markdown(
                f"- **Status**: `{chroma['status']}`\n"
                f"- **Collection**: `{chroma['collection']}`\n"
                f"- **FAQ docs**: {chroma['faq_documents']}"
            )

            # SQLite
            st.subheader("🛍️ Products DB")
            sql_info = stats["sqlite"]
            st.markdown(
                f"- **Status**: `{sql_info['status']}`\n"
                f"- **Products**: {sql_info['product_count']:,}"
            )

            # Router
            st.subheader("🔀 Routes")
            for route in stats["router"]["available_routes"]:
                st.markdown(f"- `{route}`")

        except requests.exceptions.ConnectionError:
            st.error("API not reachable")
        except Exception as e:
            st.error(f"Error: {e}")

    st.divider()
    if "session_id" in st.session_state:
        st.caption(f"🔑 Session: `{st.session_state['session_id'][:8]}...`")

# ── Session state ─────────────────────────────────────────────────────────────
if "session_id" not in st.session_state:
    # Unique ID per browser session — used by the API for conversation memory
    st.session_state["session_id"] = str(uuid.uuid4())

if "messages" not in st.session_state:
    st.session_state["messages"] = []

# Render existing messages
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# ── Input ─────────────────────────────────────────────────────────────────────
query = st.chat_input("Ask me anything about products or policies...")

if query:
    with st.chat_message("user"):
        st.markdown(query)
    st.session_state["messages"].append({"role": "user", "content": query})

    with st.chat_message("ai"):
        # st.write_stream collects all chunks and returns the full string
        response = st.write_stream(
            stream_response(query, st.session_state["session_id"])
        )

    st.session_state["messages"].append({"role": "ai", "content": response})
