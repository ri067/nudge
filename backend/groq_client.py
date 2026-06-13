import os
import json
from groq import Groq

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

async def enrich_products_with_reasons(products, user_query, user_signals, budget):
    if not products:
        return []

    # 1. Prepare the Candidate Pool for the LLM
    # We include price so the LLM can decide which items belong in "Budget" vs "Premium"
    candidates = [
        {"id": p.get("id"), "name": p.get("name"), "price": p.get("price")} 
        for p in products
    ]

    # 2. Dynamic Bundle Logic based on Budget extraction
    if budget >= 99999:
        bundle_instructions = """
        Since no strict budget was defined, create 2-3 TIERED BUNDLES (e.g., 'Budget Beach Kit', 'Standard Beach Kit', 'Premium Beach Kit'). 
        Use cheaper candidates for the Budget tier and higher-end/branded candidates for the Premium tier.
        """
    else:
        bundle_instructions = f"""
        A strict budget of ₹{budget} was defined. 
        Create exactly ONE bundle ('Essentials Kit') where the combined price of the items is STRICTLY LESS THAN ₹{budget}.
        """

    # 3. The Super-Prompt
    prompt = f"""
    You are an expert e-commerce merchandiser. The user searched for: "{user_query}"
    
    GLOBAL USER CONTEXT (Use this to explain your bundles):
    - Wishlist IDs: {user_signals.get('wishlist_products', [])}
    - Abandoned Cart IDs: {[i['product_id'] for i in user_signals.get('abandoned_cart_products', [])]}
    
    CANDIDATE INVENTORY (Max 20 items):
    {json.dumps(candidates)}
    
    YOUR TASK:
    Group these candidates into a mix of "individual" cards and "bundle" cards. 
    - Individual Cards: Standalone items that don't fit perfectly into a set. Give a 1-sentence reason why it fits the user.
    - Bundle Cards: Groups of 3-5 highly related items. {bundle_instructions}
    
    CRITICAL: For bundles, write a compelling reason why they work together, EXPLICITLY referencing the user's context if applicable (e.g., "Skipped the sunscreen since you already have Neutrogena in your cart! Here is the rest of the gear.").
    
    OUTPUT EXACTLY THIS JSON FORMAT:
    {{
        "results": [
            {{
                "type": "individual",
                "id": 12,
                "why_reason": "Perfect standalone item for your trip."
            }},
            {{
                "type": "bundle",
                "tier_name": "Premium Beach Kit",
                "why_reason": "Upgraded gear that perfectly complements the towel already on your wishlist.",
                "item_ids": [15, 8, 22] 
            }}
        ]
    }}
    """

    # 4. Call Groq
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2, # Lower temperature for stricter JSON structure
        response_format={"type": "json_object"}
    )

    # 5. Parse and Reconstruct the Final Payload safely in Python
    try:
        llm_data = json.loads(response.choices[0].message.content)
        final_feed = []
        product_map = {p["id"]: p for p in products}

        for item in llm_data.get("results", []):
            if item.get("type") == "individual":
                # Reconstruct Individual Card
                p_id = item.get("id")
                if p_id in product_map:
                    p_obj = product_map[p_id].copy()
                    p_obj["type"] = "individual"
                    p_obj["why_reason"] = item.get("why_reason")
                    final_feed.append(p_obj)
            
            elif item.get("type") == "bundle":
                # Reconstruct Bundle Card & Calculate Math Safely
                bundle_items = []
                total_price = 0
                for b_id in item.get("item_ids", []):
                    if b_id in product_map:
                        bundle_items.append(product_map[b_id])
                        total_price += product_map[b_id].get("price", 0)
                
                # Only add the bundle if it actually found valid items
                if bundle_items:
                    final_feed.append({
                        "type": "bundle",
                        "id": f"bundle_{len(final_feed)}", # Unique ID for React keys
                        "tier_name": item.get("tier_name", "Curated Kit"),
                        "why_reason": item.get("why_reason"),
                        "total_price": total_price,
                        "items": bundle_items
                    })
                    
        return final_feed
        
    except Exception as e:
        print(f"LLM Bundle Parsing Error: {e}")
        # Fallback to returning standard individual items if the LLM crashes
        for p in products:
            p["type"] = "individual"
        return products[:5]