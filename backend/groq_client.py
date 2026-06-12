import os
import json
from groq import Groq

# Initialize the global client
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

async def enrich_products_with_reasons(products, user_query):
    if not products:
        return []

    # 1. Include name and the specific behavioral context (wishlist/abandoned cart)
    items_to_evaluate = [
        {"id": p.get("id"), "name": p.get("name"),"delivery_days": p.get("delivery_days"), "context": p.get("user_context", "")} 
        for p in products
    ]

    # 2. Updated Prompt: Instruct the AI to leverage the 'context' field
    prompt = f"""
    You are an expert e-commerce AI assistant. The user searched for: "{user_query}"
    
    Here are the products retrieved from the database, including behavioral context:
    {json.dumps(items_to_evaluate)}
    
    Write a short, catchy 1-sentence reason (max 15 words) why EACH product is perfect for the user.
    If the context says they previously abandoned it in their cart or have it on their wishlist, 
    mention that to create urgency or familiarity.
    
    You MUST output ONLY a valid JSON object with a key "results" containing a list of objects.
    Format exactly like this:
    {{
        "results": [
            {{"id": 1, "why_reason": "Price dropped since you abandoned this in your cart—grab it now!"}}
        ]
    }}
    """

    # 3. Call Groq with JSON mode
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        response_format={"type": "json_object"}
    )

    # 4. Parse the JSON safely
    raw_content = response.choices[0].message.content
    try:
        llm_data = json.loads(raw_content)
        reason_map = {item.get("id"): item.get("why_reason") for item in llm_data.get("results", [])}
    except Exception as e:
        print(f"JSON Parsing Error: {e}")
        reason_map = {}

    # 5. Inject the custom reasons
    for p in products:
        p_id = p.get("id")
        p["why_reason"] = reason_map.get(p_id, "Highly relevant match based on your current search intent.")

    return products