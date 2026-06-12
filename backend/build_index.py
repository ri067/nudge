import json
import faiss
import pickle
import numpy as np
from sentence_transformers import SentenceTransformer
import os

# --- THE BULLETPROOF PATHS ---
# 1. Find exactly where this Python script lives on the server
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# 2. Build absolute paths relative to the script's location
DATA_PATH = os.path.join(SCRIPT_DIR, "data", "products.json")
INDEX_PATH = os.path.join(SCRIPT_DIR, "data", "products.index")
METADATA_PATH = os.path.join(SCRIPT_DIR, "data", "product_metadata.pkl")

def build_faiss_index():
    print(f"Loading product data from: {DATA_PATH}")
    
    if not os.path.exists(DATA_PATH):
        print(f"Error: Could not find products.json at {DATA_PATH}.")
        return

    with open(DATA_PATH, 'r') as f:
        products = json.load(f)

    # 1. Construct the rich text representation for each product
    print(f"Loaded {len(products)} products. Constructing semantic texts...")
    texts_to_embed = []
    
    for item in products:
        tags_str = ", ".join(item.get('tags', []))
        rich_text = f"{item.get('name', '')} by {item.get('brand', '')}. Category: {item.get('category', '')}. Description: {item.get('description', '')} Tags: {tags_str}"
        texts_to_embed.append(rich_text)

    # 2. Load the embedding model
    print("Loading sentence-transformers model 'all-MiniLM-L6-v2'...")
    model = SentenceTransformer('all-MiniLM-L6-v2')

    # 3. Generate embeddings
    print("Generating vector embeddings (this will take a moment)...")
    embeddings = model.encode(texts_to_embed, show_progress_bar=True)
    embeddings = np.array(embeddings).astype('float32')

    # 4. Build the FAISS index
    dimension = embeddings.shape[1] 
    print(f"Building FAISS index with dimension {dimension}...")
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)

    # 5. Save the vector index to disk
    faiss.write_index(index, INDEX_PATH)
    print(f"✅ Success! FAISS index saved to {INDEX_PATH}")

    # 6. Save the raw JSON metadata to disk (CRUCIAL FOR THE FRONTEND!)
    with open(METADATA_PATH, 'wb') as f:
        pickle.dump(products, f)
    print(f"✅ Success! Metadata saved to {METADATA_PATH}")

if __name__ == "__main__":
    build_faiss_index()