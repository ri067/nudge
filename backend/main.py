import json
import faiss
import numpy as np
import os
import random
import re
from fastapi import FastAPI, Request
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
    print("✅ Backend ready: Semantic, Operational, and Signal data loaded.")

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
    
    print(f"\n🚀 [INPUT] Received: '{req.query}' (top_k: {req.top_k})")
    is_feed_refill = not req.query or req.query.strip().lower() == "feed"
    retrieved = []
    budget = 99999
    delivery_limit = 30
    query_enriched = req.query
    dropcount = 0

    if is_feed_refill:
        print("🔄 [FEED] Generating personalized fallback feed...")
        signal_pids = set()
        signal_pids.update(user_signals.get("wishlist_products", []))
        signal_pids.update([item["product_id"] for item in user_signals.get("abandoned_cart_products", [])])
        signal_pids.update([item["product_id"] for item in user_signals.get("previously_bought_products", [])])
        
        for pid in list(signal_pids):
            base_item = next((p for p in products if p["id"] == pid), None)
            if base_item:
                item = base_item.copy()
                ops = operational_db.get(item["id"], {})
                item["price"] = ops.get("price", 99999)
                item["delivery_days"] = ops.get("delivery_days", 14)
                item["user_context"] = get_user_context(item["id"], user_signals)
                retrieved.append(item)
                
        random.shuffle(retrieved)
        
        if len(retrieved) < req.top_k:
            pad_items = random.sample(products, min(len(products), req.top_k))
            for p in pad_items:
                if p["id"] not in signal_pids:
                    item = p.copy()
                    ops = operational_db.get(item["id"], {})
                    item["price"] = ops.get("price", 99999)
                    item["delivery_days"] = ops.get("delivery_days", 14)
                    item["user_context"] = get_user_context(item["id"], user_signals)
                    retrieved.append(item)

        retrieved = retrieved[:req.top_k]
        query_enriched = "Curated items based on user's past behavior."

    else:
        expansion_prompt = f"""
        Analyze the user query: "{req.query}"
        Extract: "keywords" (15 items), "max_budget" (int), "max_delivery_days" (int).
        REAL INPUT: "{req.query}"
        REAL OUTPUT:
        """
        try:
            res = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": expansion_prompt}],
                response_format={"type": "json_object"}
            )
            data = json.loads(res.choices[0].message.content)
            query_enriched = f"{req.query}. Keywords: {data.get('keywords')}"
            budget = int(re.sub(r'\D', '', str(data.get("max_budget", 99999))))
            delivery_limit = int(re.sub(r'\D', '', str(data.get("max_delivery_days", 30))))
        except Exception as e:
            print(f"Extraction Error: {e}")
        
        vec = np.array(model.encode([query_enriched])).astype('float32')
        _, indices = index.search(vec, 20)
        
        seen_ids = set()
        for idx in indices[0]:
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

    try:
        final_payload = await enrich_products_with_reasons(
            products=retrieved, 
            user_query=query_enriched, 
            user_signals=user_signals, 
            budget=budget
        )
    except Exception as e:
        print(f"❌ [ERROR] Reasoning Generation Failed: {e}")
        final_payload = retrieved[:req.top_k]
        
    return {
        "results": final_payload,
        "ai_context": {
            "query": req.query,
            "budget": budget,
            "delivery": delivery_limit,
            "is_feed": is_feed_refill,
            "dropped_count": dropcount,
        }
    }