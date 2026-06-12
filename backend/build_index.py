import json
import faiss
import pickle
import os
import numpy as np
from sentence_transformers import SentenceTransformer

# 1. Load your mock data (assuming you saved the JSON array in 'products.json')
def load_data(filepath):
    with open(filepath, 'r') as file:
        return json.load(file)

def build_vector_db():
    print("Loading product catalog...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, 'data', 'products.json')
    products = load_data('products.json')
    
    # 2. Create "Rich Text" representations for the Embedding Model
    # We stitch the fields together so the vector math catches synonyms in tags, brands, and descriptions.
    documents = []
    for p in products:
        tags_str = ", ".join(p.get("tags", []))
        # This string is what the AI actually "reads" to understand the product
        rich_text = f"{p['name']}. Brand: {p['brand']}. Category: {p['category']}. Keywords: {tags_str}. Description: {p['description']}"
        documents.append(rich_text)
        
    print(f"Prepared {len(documents)} products for vectorization.")

    # 3. Initialize the Embedding Model
    print("Loading SentenceTransformer model (this might take a few seconds)...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # 4. Generate Embeddings
    print("Encoding product data into vectors...")
    embeddings = model.encode(documents, convert_to_numpy=True)
    
    # 5. Build the FAISS Index
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)
    
    # 6. Save the Index and the Metadata to disk
    print("Saving FAISS index to 'faiss_index.bin'...")
    faiss.write_index(index, 'faiss_index.bin')
    
    print("Saving product metadata to 'product_metadata.pkl'...")
    # We save the original JSON dictionaries so your search API can return them instantly
    with open('product_metadata.pkl', 'wb') as f:
        pickle.dump(products, f)
        
    print("✅ Build complete! Database is ready for the Nudge API.")

if __name__ == "__main__":
    build_vector_db()