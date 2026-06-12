from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import faiss
import json
import numpy as np
from sentence_transformers import SentenceTransformer
import os

from backend.groq_client import enrich_products_with_reasons

app = FastAPI(title="Nudge API")

# Essential for allowing your React frontend to talk to this server later
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables to hold our in-memory data
products = []
index = None
model = None

@app.on_event("startup")
def load_resources():
    global products, index, model
    
    print("Loading products JSON...")
    with open("backend/data/products.json", "r") as f:
        products = json.load(f)
        
    print("Loading FAISS index...")
    index = faiss.read_index("backend/data/products.index")
    
    print("Loading embedding model (this takes a few seconds)...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("✅ Backend is locked, loaded, and ready!")

# Request models
class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

@app.get("/health")
def health_check():
    """Sanity check endpoint for the hackathon demo."""
    return {
        "status": "healthy", 
        "products_loaded": len(products), 
        "vectors_in_index": index.ntotal
    }

@app.post("/search")
async def search(request: Request):
    data = await request.json()
    user_query = data.get("query", "")
    top_k = data.get("top_k", 5)

    # ==========================================
    # STAGE 1: QUERY EXPANSION (The New Brain)
    # ==========================================
    expansion_prompt = f"""
    You are an e-commerce search assistant. 
    The user is asking for: "{user_query}"
    Predict 5 specific types of products, items, or ingredients they will need for this. 
    Respond ONLY with a comma-separated list of items. No pleasantries or extra text.
    """
    
    # Call Groq to expand the query
    expansion_response = groq_client.chat.completions.create(
        model="llama3-8b-8192", # Or whichever model you are currently using
        messages=[{"role": "user", "content": expansion_prompt}],
        temperature=0.3 # Keep it low so it doesn't hallucinate weird items
    )
    
    expanded_keywords = expansion_response.choices[0].message.content.strip()
    
    # We combine the user's original thought with the AI's predicted items
    enriched_query = f"{user_query}. Keywords: {expanded_keywords}"
    print(f"Original: {user_query} | Enriched: {enriched_query}")

    # ==========================================
    # STAGE 2: VECTOR SEARCH
    # ==========================================
    # NOW you encode the ENRICHED query instead of the raw user query
    query_vector = embedding_model.encode([enriched_query], convert_to_numpy=True)
    
    distances, indices = faiss_index.search(query_vector, top_k)
    
    # Fetch the actual products from your metadata using the indices...
    # retrieved_products = [metadata[i] for i in indices[0]]

    # ==========================================
    # STAGE 3: REASONING GENERATION
    # ==========================================
    # Now run your existing Groq code to generate the `why_reason` for the frontend
    # ...
    
    return {"results": final_payload}