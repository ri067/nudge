import json
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
import os

# Define paths relative to where the script will run
DATA_PATH = "backend/data/products.json"
INDEX_PATH = "backend/data/products.index"

def build_faiss_index():
    print("Loading product data...")
    # Ensure the file exists before trying to open it
    if not os.path.exists(DATA_PATH):
        print(f"Error: Could not find {DATA_PATH}. Make sure you are running this from the 'nudge' root directory.")
        return

    with open(DATA_PATH, 'r') as f:
        products = json.load(f)

    # 1. Construct the rich text representation for each product
    print(f"Loaded {len(products)} products. Constructing semantic texts...")
    texts_to_embed = []
    
    for item in products:
        # We combine name, brand, category, description, and tags to give the AI maximum context
        tags_str = ", ".join(item.get('tags', []))
        rich_text = f"{item.get('name', '')} by {item.get('brand', '')}. Category: {item.get('category', '')}. Description: {item.get('description', '')} Tags: {tags_str}"
        texts_to_embed.append(rich_text)

    # 2. Load the embedding model
    print("Loading sentence-transformers model 'all-MiniLM-L6-v2'...")
    # This model is small, fast, and perfect for the t3.micro CPU
    model = SentenceTransformer('all-MiniLM-L6-v2')

    # 3. Generate embeddings
    print("Generating vector embeddings (this will take a moment)...")
    embeddings = model.encode(texts_to_embed, show_progress_bar=True)

    # FAISS requires the numpy array to be strictly float32
    embeddings = np.array(embeddings).astype('float32')

    # 4. Build the FAISS index
    dimension = embeddings.shape[1]  # all-MiniLM-L6-v2 outputs 384-dimensional vectors
    print(f"Building FAISS index with dimension {dimension}...")

    # IndexFlatL2 measures the L2 (Euclidean) distance between vectors
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)

    print(f"Total vectors inserted into FAISS index: {index.ntotal}")

    # 5. Save the index to disk
    faiss.write_index(index, INDEX_PATH)
    print(f"✅ Success! FAISS index saved to {INDEX_PATH}")

if __name__ == "__main__":
    build_faiss_index()