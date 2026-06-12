import os
from groq import AsyncGroq
import asyncio

# The client will automatically look for the GROQ_API_KEY environment variable
client = AsyncGroq()

async def generate_card_reason(user_query: str, product: dict) -> str:
    """Generates a short, punchy reason why this product matches the context."""
    
    prompt = f"""
    User Context/Goal: "{user_query}"
    Product: {product['name']} ({product['category']}) - {product['description']}
    
    Write a conversational, 1-sentence reason (under 10 words) why the user is seeing this product based on their goal.
    Do not use quotes. Keep it punchy like a UI notification.
    Example: Perfect for the 38°C heat next week.
    
    Reason:
    """
    
    try:
        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama3-8b-8192",
            temperature=0.7,
            max_tokens=30,
        )
        # Clean up the output to ensure it looks good on a UI card
        return response.choices[0].message.content.strip().replace('"', '')
    except Exception as e:
        print(f"Groq API Error: {e}")
        return "Recommended for your current context."

async def enrich_products_with_reasons(user_query: str, products: list) -> list:
    """Fires off all Groq API calls concurrently."""
    # Create a list of async tasks
    tasks = [generate_card_reason(user_query, p) for p in products]
    
    # Run them all in parallel and wait for the results
    reasons = await asyncio.gather(*tasks)
    
    # Attach the reasons back to the product dictionaries
    for i, product in enumerate(products):
        product["why_reason"] = reasons[i]
        product["badge"] = "🎯 CONTEXT MATCH" # Assigning the badge from your blueprint
        
    return products