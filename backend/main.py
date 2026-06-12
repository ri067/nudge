from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import faiss
import json
import numpy as np
from sentence_transformers import SentenceTransformer
import os

# Import your Groq reasoning utility and the client instance
from backend.groq_client import enrich_products_with_reasons
from groq import Groq

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
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

@app.on_event("startup")
def load_resources():
    global products, index, model
    
    # Use absolute directory binding to prevent pathing issues on the server
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, "data", "products.json")
    index_path = os.path.join(script_dir, "data", "products.index")
    
    print(f"Loading products JSON from {data_path}...")
    with open(data_path, "r") as f:
        products = json.load(f)
        
    print(f"Loading FAISS index from {index_path}...")
    index = faiss.read_index(index_path)
    
    print("Loading embedding model (this takes a few seconds)...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("✅ Backend is locked, loaded, and ready!")

# Request models (This fixes the 422 by defining exactly what the incoming body looks like)
class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

@app.get("/health")
def health_check():
    """Sanity check endpoint for the hackathon demo."""
    return {
        "status": "healthy", 
        "products_loaded": len(products), 
        "vectors_in_index": index.ntotal if index else 0
    }

@app.post("/search")
async def search(req: SearchRequest):
    global products, index, model
    
    user_query = req.query
    top_k = req.top_k

    # ==========================================
    # STAGE 1: QUERY EXPANSION (The New Brain)
    # ==========================================
    expansion_prompt = f"""
    You are an e-commerce search assistant. 
    The user is asking for: "{user_query}"
    Predict 5 specific types of products, items, or ingredients they will need for this. 
    Respond ONLY with a comma-separated list of items. No pleasantries or extra text.
    """
    
    try:
        # Call Groq to expand the query
        expansion_response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": expansion_prompt}],
            temperature=0.3
        )
        expanded_keywords = expansion_response.choices[0].message.content.strip()
        enriched_query = f"{user_query}. Keywords: {expanded_keywords}"
    except Exception as e:
        print(f"Groq Expansion Failed: {e}. Falling back to standard query.")
        enriched_query = user_query

    print(f"Original: {user_query} | Enriched: {enriched_query}")

    # ==========================================
    # STAGE 2: VECTOR SEARCH
    # ==========================================
    # Use the globally loaded 'model' and 'index' variables
    query_vector = model.encode([enriched_query], convert_to_numpy=True)
    query_vector = np.array(query_vector).astype('float32')
    
    distances, indices = index.search(query_vector, top_k)
    
    # Extract matched products based on vector index positions
    retrieved_products = []
    for idx in indices[0]:
        if 0 <= idx < len(products):
            # Deep copy or slice to prevent modifying the base list items
            retrieved_products.append(products[idx].copy())

    # ==========================================
    # STAGE 3: REASONING GENERATION
    # ==========================================
    # Pass the matched products and original query to your custom Groq reasoner
    try:
        final_payload = await enrich_products_with_reasons(retrieved_products, user_query)
    except Exception as e:
        print(f"Reasoning Generation Failed: {e}")
        # Fallback if your Groq reasoning block has a syntax error during the heat of the hackathon
        final_payload = retrieved_products
        for p in final_payload:
            p["why_reason"] = "Highly relevant match based on your current search intent."
    
    return {"results": final_payload}