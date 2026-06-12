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
    # 1. Query Expansion & Budget Extraction
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
        raw_budget = data.get("max_budget", 99999)
        if isinstance(raw_budget, dict):
            budget = raw_budget.get("number", 99999) # Extract if it's a dict
        else:
            budget = int(raw_budget) # Cast to int if it's a string or number
        raw_delivery = data.get("max_delivery_days", 30)
        delivery_limit = raw_delivery.get("number", 30) if isinstance(raw_delivery, dict) else int(raw_delivery)
        
    except:
        print(f"Extraction Error: {e}")
        query_enriched, budget, delivery_limit = req.query, 99999, 30
    print(f"🧠 [ENRICHED] Query: '{query_enriched}' | Budget: ₹{budget} | Max Delivery: {delivery_limit} days")    # 2. Vector Retrieve & Filter
    vec = np.array(model.encode([query_enriched])).astype('float32')
    _, indices = index.search(vec, 20)
    
    retrieved = []
    for idx in indices[0]:
        item = products[idx].copy()
        ops = operational_db.get(item["id"], {})
        item_price=ops.get("price",99999)
        item_delivery=ops.get("delivery_days",30)
        if item_price <= budget and item_delivery<= delivery_limit:
            item["price"] = ops.get("price")
            item["delivery_days"] = ops.get("delivery_days")
            item["user_context"] = get_user_context(item["id"], user_signals)
            retrieved.append(item)
            if len(retrieved) >= req.top_k: break
    print(f"🔍 [RAG] Retrieved {len(retrieved)} products from FAISS index:")
    for item in retrieved:
        print(f"   -> ID: {item.get('id')} | Name: {item.get('name')} | Price: ₹{item.get('price')} | Delivery: {item.get('delivery_days')} days | User Context: {item.get('user_context')}")

    # 3. Reasoning
    try:
        final_payload = await enrich_products_with_reasons(retrieved, req.query)
        print(f"✨ [OUTPUT] Generated {len(final_payload)} reasoned recommendations.")
        # Optional: Print the first reason to check the 'vibe'
        if final_payload:
            print(f"   -> Reasoning Example: {final_payload[0].get('why_reason')}")
    except Exception as e:
        print(f"❌ [ERROR] Reasoning Generation Failed: {e}")
        final_payload = retrieved
        
    return {"results": final_payload}