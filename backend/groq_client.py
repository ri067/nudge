import os
import json
from groq import Groq

# Initialize the global client
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

async def enrich_products_with_reasons(products, user_query):
    if not products:
        return []

    # 1. Strip the data down so we don't overwhelm the LLM context window
    items_to_evaluate = [{"id": p.get("id"), "name": p.get("name")} for p in products]

    prompt = f"""
    You are an expert e-commerce AI assistant. The user searched for: "{user_query}"
    
    Here are the products retrieved from the database:
    {json.dumps(items_to_evaluate)}
    
    Write a short, catchy 1-sentence reason (max 15 words) why EACH product is perfect for the user's specific context.
    
    You MUST output ONLY a valid JSON object with a key "results" containing a list of objects.
    Format exactly like this:
    {{
        "results": [
            {{"id": 1, "why_reason": "Perfect to keep you cool in the summer heat."}}
        ]
    }}
    """

    # 2. Call Groq using the new model and FORCE JSON mode
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        response_format={"type": "json_object"} # <-- This prevents the string indexing crash!
    )

    # 3. Parse the JSON safely
    raw_content = response.choices[0].message.content
    try:
        llm_data = json.loads(raw_content)
        # Create a dictionary mapping the product ID to the LLM's custom reason
        reason_map = {item.get("id"): item.get("why_reason") for item in llm_data.get("results", [])}
    except Exception as e:
        print(f"JSON Parsing Error: {e}")
        reason_map = {}

    # 4. Inject the custom reasons back into the original product payloads
    for p in products:
        p_id = p.get("id")
        p["why_reason"] = reason_map.get(p_id, "Highly relevant match based on your current search intent.")

    return products