import json
import faiss
import numpy as np
import os
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
app = FastAPI(title="Nudge API")
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

def get_user_context(pid, signals):
    context = []
    if pid in signals.get("wishlist_products", []):
        context.append("This is on the user's wishlist.")
    abandoned = next((i for i in signals.get("abandoned_cart_products", []) if i["product_id"] == pid), None)
    if abandoned:
        context.append(f"Abandoned in cart {abandoned['days_since_cart']} days ago.")
    print(f"👤 [SIGNAL] Found {len(context)} historical signals for ID {pid}")
    return " ".join(context)

@app.post("/search")
async def search(req: SearchRequest):
    global products, index, model, operational_db, user_signals
    
    print(f"\n🚀 [INPUT] Received: '{req.query}' (top_k: {req.top_k})")
    is_feed_refill = not req.query or req.query.strip().lower() == "feed"
    retrieved = []

    # Declare these at the top so they exist for the return statement later
    budget = 99999
    delivery_limit = 30
    query_enriched = req.query

    if is_feed_refill:
        print("🔄 [FEED] Generating personalized fallback feed...")
        signal_pids = set()
        signal_pids.update(user_signals.get("wishlist_products", []))
        signal_pids.update([item["product_id"] for item in user_signals.get("abandoned_cart_products", [])])
        signal_pids.update([item["product_id"] for item in user_signals.get("previously_bought_products", [])])
        
        # Look up these products in our databases
        for pid in list(signal_pids):
            base_item = next((p for p in products if p["id"] == pid), None)
            if base_item:
                item = base_item.copy()
                ops = operational_db.get(item["id"], {})
                item["price"] = ops.get("price", 99999)
                item["delivery_days"] = ops.get("delivery_days", 14)
                item["user_context"] = get_user_context(item["id"], user_signals)
                retrieved.append(item)
                
        import random
        random.shuffle(retrieved)  # Shuffle to add some variety
        
        # HACKATHON BACKUP: If the user doesn't have enough signals, pad with random items
        if len(retrieved) < req.top_k:
            pad_items = random.sample(products, req.top_k - len(retrieved))
            for p in pad_items:
                if p["id"] not in signal_pids:
                    item = p.copy()
                    ops = operational_db.get(item["id"], {})
                    item["price"] = ops.get("price", 99999)
                    item["delivery_days"] = ops.get("delivery_days", 14)
                    item["user_context"] = get_user_context(item["id"], user_signals)
                    retrieved.append(item)

        retrieved = retrieved[:req.top_k]  # Limit to top_k
        print(f"🔍 [FEED] Retrieved {len(retrieved)} personalized products.")
        
        # FIX: Define query_enriched for the feed reasoning
        query_enriched = "Curated items based on user's past behavior, wishlists, and abandoned carts."

    else:
        # 1. Query Expansion & Budget Extraction
        import re # Ensure regex is available
        expansion_prompt = f"""
        User query: "{req.query}"
        1. Predict 5 product keywords. 
        2. Extract max budget (number). Default: 99999.
        3. Extract max delivery days if urgency is mentioned (number). 
        - IMPORTANT: Translate time words into integers! "Tomorrow" = 1, "next week" = 7, "this weekend" = 3, "today" = 0.
        - If no time urgency is mentioned, use Default: 30.
        
        Return JSON ONLY: {{"keywords": "...", "max_budget": 99999, "max_delivery_days": 30}}
        """
        try:
            res = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": expansion_prompt}],
                response_format={"type": "json_object"}
            )
            data = json.loads(res.choices[0].message.content)
            query_enriched = f"{req.query}. Keywords: {data.get('keywords')}"
            
            # Robust Extraction
            raw_budget = str(data.get("max_budget", 99999))
            b_match = re.sub(r'\D', '', raw_budget)
            budget = int(b_match) if b_match else 99999
            
            raw_delivery = str(data.get("max_delivery_days", 30))
            d_match = re.sub(r'\D', '', raw_delivery)
            delivery_limit = int(d_match) if d_match else 30
            
        except Exception as e: # FIX: Catch the specific exception
            print(f"Extraction Error: {e}")
            query_enriched, budget, delivery_limit = req.query, 99999, 30
            
        print(f"🧠 [ENRICHED] Query: '{query_enriched}' | Budget: ₹{budget} | Max Delivery: {delivery_limit} days")    
        
        # 2. Vector Retrieve & Filter
        vec = np.array(model.encode([query_enriched])).astype('float32')
        _, indices = index.search(vec, 20)
        
        retrieved = []
        for idx in indices[0]:
            item = products[idx].copy()
            ops = operational_db.get(item["id"], {})
            item_price = ops.get("price", 99999)
            item_delivery = ops.get("delivery_days", 30)
            
            if item_price <= budget and item_delivery <= delivery_limit:
                item["price"] = item_price
                item["delivery_days"] = item_delivery
                item["user_context"] = get_user_context(item["id"], user_signals)
                retrieved.append(item)
                if len(retrieved) >= req.top_k: break
                
        print(f"🔍 [RAG] Retrieved {len(retrieved)} products from FAISS index")

    # 3. Reasoning
    try:
        context_query = query_enriched if is_feed_refill else req.query
        final_payload = await enrich_products_with_reasons(retrieved, context_query)
        print(f"✨ [OUTPUT] Generated {len(final_payload)} reasoned recommendations.")
    except Exception as e:
        print(f"❌ [ERROR] Reasoning Generation Failed: {e}")
        final_payload = retrieved
        
    # FIX: Include ai_context for the React UI Chip
    return {
        "results": final_payload,
        "ai_context": {
            "query": req.query,
            "budget": budget,
            "delivery": delivery_limit,
            "is_feed": is_feed_refill
        }
    }