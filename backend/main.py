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
operational_db = {}


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
    You are an e-commerce AI. The user is asking: "{user_query}"
    
    1. Predict 10 specific products they need (comma-separated).
    2. Extract their maximum budget in numbers if they mention one. If no budget is mentioned, use 999999.
    
    Respond ONLY with valid JSON exactly like this:
    {{
        "keywords": "item1, item2, item3",
        "max_budget": 5000
    }}
    """
    
    try:
        expansion_response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": expansion_prompt}],
            temperature=0.1,
            response_format={"type": "json_object"} # Force strict JSON
        )
        
        llm_data = json.loads(expansion_response.choices[0].message.content)
        expanded_keywords = llm_data.get("keywords", "")
        budget_limit = llm_data.get("max_budget", 99999)
        
        enriched_query = f"{user_query}. Keywords: {expanded_keywords}"
    except Exception as e:
        print(f"Groq Extraction Failed: {e}")
        enriched_query = user_query
        budget_limit = 99999

    print(f"Enriched: {enriched_query} | Budget Limit: ₹{budget_limit}")

    # ==========================================
    # STAGE 2: VECTOR SEARCH
    # ==========================================
    # Use the globally loaded 'model' and 'index' variables
    query_vector = model.encode([enriched_query], convert_to_numpy=True)
    query_vector = np.array(query_vector).astype('float32')
    
    # OVER-FETCH: Grab 15 items from FAISS in case the top ones are too expensive
    distances, indices = index.search(query_vector, 15)
    
    retrieved_products = []
    
    for idx in indices[0]:
        if 0 <= idx < len(products):
            base_item = products[idx].copy()
            ops_data = operational_db.get(base_item["id"], {})
            item_price = ops_data.get("price", 99999)
            
            # THE FILTER: Only accept items that fit the user's budget
            if item_price <= budget_limit:
                # Merge the operational price into the payload for the frontend
                base_item["price"] = item_price 
                retrieved_products.append(base_item)
                
                # Stop looking once we have enough items for the UI
                if len(retrieved_products) == top_k:
                    break

    # ==========================================
    # STAGE 3: REASONING GENERATION
    # ==========================================
    try:
        final_payload = await enrich_products_with_reasons(retrieved_products, user_query)
    except Exception as e:
        print(f"Reasoning Generation Failed: {e}")
        final_payload = retrieved_products
        for p in final_payload:
            p["why_reason"] = "Highly relevant match based on your current search intent."
    
    return {"results": final_payload}