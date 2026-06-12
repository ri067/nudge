from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import faiss
import json
import numpy as np
from sentence_transformers import SentenceTransformer
import os

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
def active_search(req: SearchRequest):
    """The core RAG retrieval endpoint."""
    # 1. Embed the user's natural language goal
    query_vector = model.encode([req.query]).astype("float32")
    
    # 2. Perform the cosine similarity search in FAISS
    distances, indices = index.search(query_vector, req.top_k)
    
    # 3. Map vector indices back to actual product JSON data
    results = []
    for i in range(req.top_k):
        idx = int(indices[0][i])
        if idx != -1 and idx < len(products):
            # Attach the semantic distance score just so we can see the math working
            product_data = products[idx].copy()
            product_data["match_score"] = float(distances[0][i])
            results.append(product_data)
            
    return {"results": results}