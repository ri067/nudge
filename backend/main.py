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

def get_user_context(product_id, user_signals):
    signals = []
    
    # 1. Check Wishlist
    if product_id in user_signals.get("wishlist_products", []):
        signals.append("This is on the user's wishlist.")
        
    # 2. Check Abandoned Cart
    for item in user_signals.get("abandoned_cart_products", []):
        if item.get("product_id") == product_id:
            # THIS MUST BE INDENTED UNDER THE 'IF'
            signals.append(f"Abandoned in cart {item.get('days_since_cart', 0)} days ago.")
            
    # 3. Check Previously Bought
    for item in user_signals.get("previously_bought_products", []):
        # We also force both to be integers just in case your mock JSON has string IDs
        if int(item.get("product_id", -1)) == int(product_id):
            # THIS MUST BE INDENTED UNDER THE 'IF'
            signals.append(f"Usually bought every {item.get('days_since_purchase', 30)} days.")

    return " | ".join(signals)


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
    dropcount=0

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
        Analyze the user query: "{req.query}"
        
        Extract the following into strict JSON:
        1. "keywords": 15 specific product types (comma-separated).
        2. "max_budget": Integer only. If no budget is mentioned, use 99999.
        3. "max_delivery_days": Integer only. 
           - IF AN EXACT NUMBER IS GIVEN (e.g., "in 2 days", "5 days"), output that exact number!
           - IF WORDS ARE GIVEN: "today" = 0, "tomorrow" = 1, "this weekend" = 3, "next week" = 7.
           - If no urgency is mentioned, use 14.

        EXAMPLE INPUT 1: "going to the beach tomorrow under 500"
        EXAMPLE OUTPUT 1: {{"keywords": "sunscreen, towel, flip flops", "max_budget": 500, "max_delivery_days": 1}}
        
        EXAMPLE INPUT 2: "need a tent in 2 days"
        EXAMPLE OUTPUT 2: {{"keywords": "camping tent, sleeping bag, lantern", "max_budget": 99999, "max_delivery_days": 2}}
        
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
            else:
                dropcount += 1
                
        print(f"🔍 [RAG] Retrieved {len(retrieved)} products from FAISS index")
        print(f"🗑️ [FILTER] Dropped {dropcount} products based on budget and delivery constraints")

    # 3. Reasoning
    try:
        context_query = query_enriched if is_feed_refill else req.query
        final_payload = await enrich_products_with_reasons(
            products=retrieved, 
            user_query=context_query, 
            user_signals=user_signals, 
            budget=budget
        )
        print(f"✨ [OUTPUT] Generated {len(final_payload)} cards (mix of bundles & individuals).")
    except Exception as e:
        print(f"❌ [ERROR] Reasoning Generation Failed: {e}")
        final_payload = retrieved[:req.top_k]
        
    # FIX: Include ai_context for the React UI Chip
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