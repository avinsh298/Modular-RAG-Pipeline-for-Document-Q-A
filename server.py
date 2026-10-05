import os
import shutil
import glob
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Pipeline imports
from main import create_pipeline
from src.util.invoke_ai import invoke_ai

app = FastAPI(
    title="Modular RAG API",
    description="Clean Single-Document RAG API",
    version="1.0.0",
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = create_pipeline()
UPLOAD_DIR = "sample_data/source"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "Modular RAG API"}

# --- Startup Hook: Ensure Clean State on Launch ---
@app.on_event("startup")
def clean_on_startup():
    """Wipes any previous LanceDB tables and uploaded files on server start."""
    try:
        pipeline.reset()
        for old_file in glob.glob(os.path.join(UPLOAD_DIR, "*")):
            if os.path.isfile(old_file):
                os.remove(old_file)
    except Exception as e:
        print(f"Startup cleanup note: {e}")


# --- Schemas ---
class ChatTurn(BaseModel):
    role: str
    content: str


class QueryRequest(BaseModel):
    query: str
    history: Optional[List[ChatTurn]] = []


class SourceItem(BaseModel):
    index: int
    document: str
    content: str


class QueryResponse(BaseModel):
    answer: str
    sources: List[SourceItem]


# --- Query Condensation ---
def condense_query(query: str, history: List[ChatTurn]) -> str:
    if not history:
        return query

    recent_history = "\n".join([f"{turn.role.capitalize()}: {turn.content}" for turn in history[-4:]])
    system_prompt = (
        "You are an assistant that reformulates follow-up questions into standalone search queries. "
        "Given the conversation history and a follow-up question, rewrite the question so that all "
        "pronouns and implicit references are replaced with their explicit entity names. "
        "Do NOT answer the question. Return ONLY the rewritten query."
    )
    user_prompt = f"Conversation History:\n{recent_history}\n\nFollow-up Question: {query}\n\nStandalone Query:"

    try:
        rewritten = invoke_ai(system_message=system_prompt, user_message=user_prompt).strip()
        return rewritten if rewritten else query
    except Exception:
        return query


# --- Endpoints ---

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "RAG Engine Active"}


@app.post("/query", response_model=QueryResponse)
def query_rag(payload: QueryRequest):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    try:
        effective_query = condense_query(payload.query, payload.history)
        search_results = pipeline.retriever.search(effective_query)
        answer = pipeline.response_generator.generate_response(effective_query, search_results)

        sources = []
        for i, chunk in enumerate(search_results):
            source_path = getattr(chunk, "source", None) or (chunk.get("source") if isinstance(chunk, dict) else "")
            doc_name = os.path.basename(source_path) if source_path else "Uploaded Document"
            content = getattr(chunk, "content", None) or (chunk.get("content") if isinstance(chunk, dict) else str(chunk))

            sources.append(
                SourceItem(
                    index=i + 1,
                    document=doc_name,
                    content=content
                )
            )

        return QueryResponse(answer=answer, sources=sources)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.post("/upload")
async def upload_documents(file: UploadFile = File(...)):
    """
    Automatically clears old data before indexing the new PDF.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        # 1. Wipe earlier database records completely
        pipeline.reset()

        # 2. Delete earlier files from disk
        for old_file in glob.glob(os.path.join(UPLOAD_DIR, "*")):
            if os.path.isfile(old_file):
                try:
                    os.remove(old_file)
                except OSError:
                    pass

        # 3. Save incoming PDF
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 4. Index only the newly uploaded document
        pipeline.add_documents([file_path])

        return {
            "status": "success",
            "filename": file.filename,
            "message": f"Previous knowledge deleted. '{file.filename}' is now active."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")