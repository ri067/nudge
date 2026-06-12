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
    return " ".join(context)

@app.post("/search")
async def search(req: SearchRequest):
    global products, index, model, operational_db, user_signals
    
    # 1. Query Expansion & Budget Extraction
    expansion_prompt = f"""
    User query: "{req.query}"
    1. Predict 5 product keywords. 2. Extract max budget (number). Default budget: 99999.
    Return JSON: {{"keywords": "...", "max_budget": 0}}
    """
    try:
        res = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": expansion_prompt}],
            response_format={"type": "json_object"}
        )
        data = json.loads(res.choices[0].message.content)
        query_enriched = f"{req.query}. Keywords: {data.get('keywords')}"
        budget = data.get("max_budget", 99999)
    except:
        query_enriched, budget = req.query, 99999

    # 2. Vector Retrieve & Filter
    vec = np.array(model.encode([query_enriched])).astype('float32')
    _, indices = index.search(vec, 15)
    
    retrieved = []
    for idx in indices[0]:
        item = products[idx].copy()
        ops = operational_db.get(item["id"], {})
        if ops.get("price", 99999) <= budget:
            item["price"] = ops.get("price")
            item["user_context"] = get_user_context(item["id"], user_signals)
            retrieved.append(item)
            if len(retrieved) >= req.top_k: break
                
    # 3. Reasoning
    final = await enrich_products_with_reasons(retrieved, req.query)
    return {"results": final}