import json
import faiss
import numpy as np
import os
import random
import re
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from groq import Groq
from backend.groq_client import enrich_products_with_reasons
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Nudge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
products = []
index = None
model = None
operational_db = {}
user_signals = {}
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

app.mount("/images", StaticFiles(directory="backend/data/images"), name="images")

@app.on_event("startup")
def load_resources():
    global products, index, model, operational_db, user_signals
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    with open(os.path.join(script_dir, "data/semantic_products.json"), "r") as f:
        products = json.load(f)
    
    with open(os.path.join(script_dir, "data/operational_products.json"), "r") as f:
        raw_ops = json.load(f)
        operational_db = {item["id"]: item for item in raw_ops}
        
    with open(os.path.join(script_dir, "data/user_signals.json"), "r") as f:
        user_signals = json.load(f)
        
    index = faiss.read_index(os.path.join(script_dir, "data/products.index"))
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("✅ Backend ready.")

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

def get_user_context(product_id, user_signals):
    signals = []
    if product_id in user_signals.get("wishlist_products", []):
        signals.append("This is on the user's wishlist.")
    for item in user_signals.get("abandoned_cart_products", []):
        if item.get("product_id") == product_id:
            signals.append(f"Abandoned in cart {item.get('days_since_cart', 0)} days ago.")
    for item in user_signals.get("previously_bought_products", []):
        if int(item.get("product_id", -1)) == int(product_id):
            signals.append(f"Usually bought every {item.get('days_since_purchase', 30)} days.")
    return " | ".join(signals)

@app.post("/search")
async def search(req: SearchRequest):
    global products, index, model, operational_db, user_signals
    
    is_feed_refill = not req.query or req.query.strip().lower() == "feed"
    retrieved = []
    budget = 99999
    delivery_limit = 30
    dropcount = 0
    query_enriched = req.query

    if is_feed_refill:
        # ... (Your existing feed logic)
        pass 
    else:
        # Extraction logic ...
        
        # 1. Search for a larger pool (e.g., 50) to allow for filtering/deduplication
        vec = np.array(model.encode([query_enriched])).astype('float32')
        distances, indices = index.search(vec, 50)
        
        # 2. Pair indices with distances and sort by distance (lower L2 = higher relevance)
        results_with_scores = zip(indices[0], distances[0])
        sorted_results = sorted(results_with_scores, key=lambda x: x[1])

        # 3. Filter, Deduplicate, and collect up to top_k
        seen_ids = set()
        for idx, score in sorted_results:
            if idx == -1 or idx >= len(products): continue
            
            item = products[idx].copy()
            p_id = item["id"]
            
            if p_id not in seen_ids:
                ops = operational_db.get(p_id, {})
                item_price = ops.get("price", 99999)
                item_delivery = ops.get("delivery_days", 30)
                
                if item_price <= budget and item_delivery <= delivery_limit:
                    item["price"] = item_price
                    item["delivery_days"] = item_delivery
                    item["user_context"] = get_user_context(p_id, user_signals)
                    retrieved.append(item)
                    seen_ids.add(p_id)
                else:
                    dropcount += 1
            
            if len(retrieved) >= req.top_k:
                break

    final_payload = await enrich_products_with_reasons(
        products=retrieved, 
        user_query=query_enriched, 
        user_signals=user_signals, 
        budget=budget
    )
        
    return {
        "results": final_payload,
        "ai_context": {"query": req.query, "dropped_count": dropcount}
    }