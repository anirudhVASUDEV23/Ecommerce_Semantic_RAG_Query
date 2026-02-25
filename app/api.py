import time
import sqlite3
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from faq import (
    faq_chain, faq_chain_stream, ingest_faq_data,
    general_llm_fallback, general_llm_fallback_stream,
    chroma_client, collection_name_faq,
)
from router import router
from sql import sql_chain

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Track server start time for uptime reporting
_SERVER_START = time.time()

# Sentinel: SQL chain returns this string when it has no data
_NO_DATA_PREFIXES = (
    "sorry, we do not have",
    "invalid query generated",
)

# ── Paths ─────────────────────────────────────────────────────────────────────
faqs_path = Path(__file__).parent / "resources/faq_data.csv"

# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["20/minute"])

# ── Conversation Session Store ────────────────────────────────────────────────
SESSION_STORE: dict[str, dict] = {}
SESSION_TTL = 1800       # 30 minutes of inactivity before expiry
MAX_HISTORY_TURNS = 10   # max conversation turns kept per session


def get_session_history(session_id: str) -> list[dict]:
    """Return conversation history for a session, or [] if expired/not found."""
    if session_id not in SESSION_STORE:
        return []
    session = SESSION_STORE[session_id]
    if time.time() - session["last_active"] > SESSION_TTL:
        del SESSION_STORE[session_id]
        return []
    return session["history"]


def update_session(session_id: str, query: str, response: str) -> None:
    """Append a user/assistant turn to the session history."""
    if session_id not in SESSION_STORE:
        SESSION_STORE[session_id] = {"history": [], "last_active": time.time()}
    session = SESSION_STORE[session_id]
    session["history"].extend([
        {"role": "user", "content": query},
        {"role": "assistant", "content": response},
    ])
    # Cap history to avoid token overflows
    if len(session["history"]) > MAX_HISTORY_TURNS * 2:
        session["history"] = session["history"][-(MAX_HISTORY_TURNS * 2):]
    session["last_active"] = time.time()


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ingest FAQ data on startup (no-op if already persisted)."""
    ingest_faq_data(faqs_path)
    yield


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Flipkart RAG API",
    description="Backend API for the E-commerce Semantic RAG chatbot.",
    version="2.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Schemas ───────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    query: str
    session_id: str = "default"


class ChatResponse(BaseModel):
    route: str
    response: str


# ── Helpers ───────────────────────────────────────────────────────────────────
def format_product_list(products: list) -> str:
    output = ""
    for item in products:
        title    = item.get("title", "Unknown Product")
        price    = item.get("price", "N/A")
        discount = item.get("discount", 0)
        rating   = item.get("avg_rating", "No rating")
        link     = item.get("product_link", "#")
        disc_text = (
            f"({int(discount * 100)}% off)"
            if isinstance(discount, (float, int)) and discount > 0
            else "(No discount)"
        )
        output += f"**{title}**: Rs. {price}, {disc_text}, Rating: {rating} [🔗]({link})\n\n"
    return output.strip()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Ops"])
async def health():
    """Liveness check."""
    return {"status": "ok"}


@app.get("/admin/stats", tags=["Admin"])
async def admin_stats():
    """
    Admin dashboard — returns live server stats:
    uptime, active sessions, ChromaDB collection info, SQLite product count.
    """
    # ── Uptime ────────────────────────────────────────────────────────────────
    uptime_seconds = int(time.time() - _SERVER_START)
    hours, remainder = divmod(uptime_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    uptime_str = f"{hours}h {minutes}m {seconds}s"

    # ── Sessions ──────────────────────────────────────────────────────────────
    now = time.time()
    active_sessions = [
        sid for sid, s in SESSION_STORE.items()
        if now - s["last_active"] <= SESSION_TTL
    ]

    # ── ChromaDB ──────────────────────────────────────────────────────────────
    try:
        collection = chroma_client.get_collection(collection_name_faq)
        faq_doc_count = collection.count()
        chroma_status = "ok"
    except Exception as e:
        faq_doc_count = None
        chroma_status = str(e)

    # ── SQLite ────────────────────────────────────────────────────────────────
    db_path = Path(__file__).parent / "db.sqlite"
    try:
        with sqlite3.connect(db_path) as conn:
            product_count = conn.execute("SELECT COUNT(*) FROM product").fetchone()[0]
        sqlite_status = "ok"
    except Exception as e:
        product_count = None
        sqlite_status = str(e)

    # ── Routes ────────────────────────────────────────────────────────────────
    available_routes = [r.name for r in router.routes]

    return {
        "uptime": uptime_str,
        "uptime_seconds": uptime_seconds,
        "sessions": {
            "active": len(active_sessions),
            "total_stored": len(SESSION_STORE),
            "ttl_minutes": SESSION_TTL // 60,
        },
        "chromadb": {
            "status": chroma_status,
            "collection": collection_name_faq,
            "faq_documents": faq_doc_count,
        },
        "sqlite": {
            "status": sqlite_status,
            "product_count": product_count,
        },
        "router": {
            "available_routes": available_routes,
        },
    }


@app.post("/ingest/faq", tags=["Admin"])
async def ingest_faq():
    """
    Load FAQ CSV into persistent ChromaDB.
    No-op if the collection already exists. Call once after a fresh deployment.
    """
    try:
        ingest_faq_data(faqs_path)
        return {"message": "FAQ data ingested successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
@limiter.limit("20/minute")
async def chat(request: Request, body: ChatRequest):
    """
    Main chat endpoint with conversation memory.
    Routes query to FAQ (semantic search) or SQL (text-to-SQL) chain.
    Rate limited to 20 requests/minute per IP.
    """
    start = time.monotonic()
    route_name = "unknown"
    try:
        history = get_session_history(body.session_id)
        route_name = router(body.query).name or "unknown"

        if route_name == "faq":
            result = await faq_chain(body.query, history)
        elif route_name == "sql":
            result = await sql_chain(body.query, history)
            if isinstance(result, list):
                result = format_product_list(result)
        else:
            result = None  # triggers fallback below

        # Fallback: if no useful answer, use conversation history via general LLM
        if result is None or (
            isinstance(result, str)
            and result.lower().startswith(_NO_DATA_PREFIXES)
        ):
            route_name = "fallback"
            result = await general_llm_fallback(body.query, history)

        update_session(body.session_id, body.query, str(result))
        elapsed = round((time.monotonic() - start) * 1000)
        logger.info(
            "route=%s | session=%s | query=%r | time=%dms | status=ok",
            route_name, body.session_id[:8], body.query[:60], elapsed,
        )
        return ChatResponse(route=route_name, response=str(result))

    except Exception as e:
        elapsed = round((time.monotonic() - start) * 1000)
        logger.error(
            "route=%s | session=%s | query=%r | time=%dms | status=error | err=%s",
            route_name, body.session_id[:8], body.query[:60], elapsed, e,
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/stream", tags=["Chat"])
@limiter.limit("20/minute")
async def chat_stream(request: Request, body: ChatRequest):
    """
    Streaming chat endpoint.
    FAQ answers stream word-by-word. SQL answers are sent as a single chunk.
    Rate limited to 20 requests/minute per IP.
    """
    history = get_session_history(body.session_id)
    route_name = router(body.query).name or "unknown"
    start = time.monotonic()

    async def generate():
        try:
            if route_name == "faq":
                full_response = ""
                async for chunk in faq_chain_stream(body.query, history):
                    full_response += chunk
                    yield chunk
                update_session(body.session_id, body.query, full_response)

            elif route_name == "sql":
                result = await sql_chain(body.query, history)
                if isinstance(result, list):
                    result = format_product_list(result)

                # Fallback if SQL returned no useful data
                if isinstance(result, str) and result.lower().startswith(_NO_DATA_PREFIXES):
                    full_response = ""
                    async for chunk in general_llm_fallback_stream(body.query, history):
                        full_response += chunk
                        yield chunk
                    update_session(body.session_id, body.query, full_response)
                else:
                    update_session(body.session_id, body.query, str(result))
                    yield str(result)

            else:
                # Unknown route — answer from conversation history
                full_response = ""
                async for chunk in general_llm_fallback_stream(body.query, history):
                    full_response += chunk
                    yield chunk
                update_session(body.session_id, body.query, full_response)

            elapsed = round((time.monotonic() - start) * 1000)
            logger.info(
                "stream | route=%s | session=%s | query=%r | time=%dms",
                route_name, body.session_id[:8], body.query[:60], elapsed,
            )
        except Exception as e:
            elapsed = round((time.monotonic() - start) * 1000)
            logger.error(
                "stream | route=%s | session=%s | error=%s | time=%dms",
                route_name, body.session_id[:8], e, elapsed,
            )
            yield f"\n\n⚠️ Error: {e}"

    return StreamingResponse(generate(), media_type="text/plain")
