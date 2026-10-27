# query_data.py — Grounded RAG Pipeline for Puravankara HR Policies

import os
import time
import re
import threading
import warnings
from dotenv import load_dotenv
import chromadb
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.embeddings import Embeddings
from groq import Groq

# Filter out verbose deprecation warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="huggingface_hub")
warnings.filterwarnings("ignore", message=".*LangChainDeprecationWarning.*")

# Load environment variables
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv()
load_dotenv(os.path.join(ROOT_DIR, ".env"))
load_dotenv(os.path.join(ROOT_DIR, "backend", ".env"))

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_final")

EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


class HFInferenceEmbeddings(Embeddings):
    """
    Same all-MiniLM-L6-v2 model as the local index, computed on Hugging Face's
    hosted inference instead of local PyTorch. Used on low-RAM cloud hosts
    (Render free tier) so the existing chroma_final index stays compatible.
    Requires HF_TOKEN.
    """

    def __init__(self, token: str):
        from huggingface_hub import InferenceClient
        self._client = InferenceClient(model=EMBEDDING_MODEL_NAME, token=token)

    def _embed(self, text: str) -> list[float]:
        vec = self._client.feature_extraction(text)
        # Sentence-transformers models return (384,) or (1, 384)
        if hasattr(vec, "ndim") and vec.ndim > 1:
            vec = vec[0]
        return [float(x) for x in vec]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)


RAG_READY = False
_RAG_INITIALIZING = False
_init_lock = threading.Lock()
embedding_model = None
db = None


def initialize_rag():
    global RAG_READY, _RAG_INITIALIZING
    if RAG_READY:
        return

    with _init_lock:
        if RAG_READY:
            return
        _RAG_INITIALIZING = True
        try:
            print("[INFO] Warming up Policy RAG system...")
            start_time = time.time()
            from rag.policy_indexer import get_policy_index
            idx = get_policy_index()
            RAG_READY = True
            print(f"[OK] Policy RAG Ready (Indexed {len(idx.chunks)} chunks across Puravankara policies in {round(time.time() - start_time, 2)}s)\n")
        except Exception as e:
            print(f"[WARN] Policy index initialization error: {e}")
            RAG_READY = True
        finally:
            _RAG_INITIALIZING = False


def is_rag_ready():
    return RAG_READY


def is_rag_initializing():
    return _RAG_INITIALIZING


GROQ_MODEL = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")


def call_llm(prompt: str) -> str:
    global client
    if client is None:
        key = os.environ.get("GROQ_API_KEY")
        if key:
            client = Groq(api_key=key)
        else:
            return "Error: GROQ_API_KEY not configured."
    try:
        model = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            max_tokens=600,
            temperature=0.0
        )
        content = response.choices[0].message.content.strip()
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
        return content
    except Exception as e:
        print("GROQ ERROR:", e)
        return "Error contacting LLM"


def preprocess_query(query: str) -> str:
    """Normalize query terms and expand common acronyms for optimal vector similarity."""
    cleaned = query.strip()
    query_lower = cleaned.lower()

    if "posh" in query_lower and "sexual harassment" not in query_lower:
        cleaned = cleaned + " sexual harassment workplace policy"

    return cleaned


def get_rag_response(query_text: str):
    if not RAG_READY:
        initialize_rag()

    total_start = time.time()
    clean_query = preprocess_query(query_text)

    # 1. RETRIEVE USING HIGH-PRECISION IN-MEMORY BM25 POLICY INDEX
    from rag.policy_indexer import get_policy_index
    idx = get_policy_index()
    raw_results = idx.search(clean_query, top_k=4)

    # Filter by minimum relevance score threshold
    filtered_results = [r for r in raw_results if r[1] >= 1.0]

    # If no relevant policy documents matched
    if not filtered_results:
        return {
            "answer": "The available Puravankara policy documents do not provide sufficient information to answer your question.",
            "sources": []
        }

    # 4. CONTEXT BUILDING WITH CLEAR STRUCTURE
    context_blocks = []
    sources = []
    seen_sources = set()

    for doc, score in filtered_results[:4]:
        policy_id = doc.metadata.get("policy_id", "")
        policy_name = doc.metadata.get("policy_name", "Puravankara Policy")
        department = doc.metadata.get("department", "HR")
        authority = doc.metadata.get("authority", "")
        version = doc.metadata.get("version", "")
        source_file = doc.metadata.get("source_file", doc.metadata.get("source", "Policy Document"))
        page = doc.metadata.get("page", 1)
        section = doc.metadata.get("section", "")

        header_info = f"Policy: {policy_name}"
        if policy_id and policy_id != "LEGACY":
            header_info += f" [{policy_id}]"
        if department:
            header_info += f" | Dept: {department}"
        if authority:
            header_info += f" | Authority: {authority}"

        block = f"--- OKF POLICY SOURCE ---\n{header_info}\nPage: {page}"
        if section:
            block += f"\nSection: {section}"
        block += f"\nContent:\n{doc.page_content}\n"
        context_blocks.append(block)

        source_key = (policy_name, page)
        if source_key not in seen_sources:
            seen_sources.add(source_key)
            sources.append({
                "source": policy_name,
                "policy_id": policy_id,
                "department": department,
                "authority": authority,
                "version": version,
                "source_file": source_file,
                "page": page,
                "section": section,
                "score": round(float(score), 3)
            })

    context_text = "\n".join(context_blocks)

    # 5. STRICT GROUNDED GENERATION PROMPT (Anti-Hallucination Framework)
    prompt = f"""### ROLE & SCOPE ASSIGNMENT:
You are Purva, the official AI Policy Guide for Puravankara Enterprise. You are strictly an informational intake and policy guidance assistant, NOT an authorized policy author or arbitrary knowledge engine.

### CONTENT GROUNDING (CLOSED-WORLD RULE):
Answer the user's question using ONLY the factual content inside the [PURAVANKARA POLICY CONTEXT] below.
If the answer is NOT explicitly stated in the context, output EXACTLY:
"The available Puravankara policy documents do not provide sufficient information to answer your question."
Do NOT extrapolate, deduce, or assume unstated company rules or entitlements.

### SPECIFICITY & STRUCTURE:
1. State the relevant policy title and section name clearly at the start (e.g., "Policy: Leave Policy", "Section: Annual Leave").
2. DO NOT output internal technical codes, metadata IDs, or document identifiers (such as [POL-IC-001], [POL-HR-001]) in the user-facing text. Use only the human-readable policy title.
3. Keep the answer clear, structured, and concise (under 200 words).
4. Use bullet points for requirements, criteria, or eligibility steps.
5. If policy tables or clauses state "Nil", "N/A", "0", or "None", explicitly clarify this means zero entitlement or non-applicability.

### INSTRUCTIONAL DOS & DON'TS:
- DO quote verified clauses and terms directly from the context.
- DO refer users to the official "Puravankara Resident App" or "Facility Management / HR Desk" for administrative submissions.
- DO NOT invent, hallucinate, or output placeholder phone numbers (e.g. 9876543210, 1800-xxx), email addresses, or personnel names.
- DO NOT mention general industry practices or external company rules.

[PURAVANKARA POLICY CONTEXT]:
{context_text}

[USER QUESTION]:
{query_text}

Answer:"""

    response_text = call_llm(prompt)

    if "do not provide sufficient information" in response_text.lower():
        sources = []

    print(f"Total RAG Execution Time: {round(time.time() - total_start, 3)}s")

    return {
        "answer": response_text,
        "sources": sources
    }


if __name__ == "__main__":
    initialize_rag()
    while True:
        q = input("\nAsk policy question: ")
        if q.lower() in ["exit", "quit"]:
            break
        res = get_rag_response(q)
        print("\n🧠 Answer:\n", res["answer"])
        print("\n📚 Sources:")
        for s in res["sources"]:
            print(s)
