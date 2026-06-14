# Nudge

Nudge is a mobile first prototype that changes the e-commerce experience. It replaces the traditional endless scroll with a highly curated, card based swipe feed. 

By combining semantic vector search, deterministic operational logic, and LLM-driven merchandising, Nudge builds real-time, context-aware product bundles and recommendations tailored perfectly to the user's immediate intent and historical behavior.

---

## Core Features

### Intelligent Merchandising Engine (Polymorphic Feed)
Instead of just returning a list of single items, the LLM acts as an expert merchandiser, taking the top 20 semantic matches and intelligently grouping them into a polymorphic feed:
* **Individual Cards:** Standalone items with a unique, single-sentence AI reasoning string explaining why it fits the user.
* **Curated Bundles:** Groups of 2-4 highly related items combined into a single card.
* **Dynamic Pricing Tiers:** If no budget is specified, the AI generates tiered bundles (e.g., "Budget Hiking Kit," "Premium Hiking Kit"). If a hard budget is set, it strictly builds a single bundle under that limit.

### Signal X-Ray & Convergence Matching
To prove the AI isn't just hallucinating bundles, users can long-press any card to trigger X-Ray Mode. 
* It reveals the backend data signal that pulled each item into the feed (eg "Abandoned in cart 2 days ago", "This is on the user's wishlist").
* **Dual Signal Match:** If an item is both a semantic match and has historical relevance (e.g., you searched for a trek, and you abandoned trekking boots yesterday), the UI highlights it with a glowing "Convergence" badge, closing the loop on forgotten intent.

### Real-Time UI Adaptation
The feed adapts to the user's immediate session behavior without requiring heavy backend model retraining.
* If a user swipes left (rejects) two items of the same category in a row, the UI instantly triggers a sleek toast notification: "Got it. Showing fewer [category] suggestions."
* The frontend then silently purges all remaining items (and bundles containing those items) from that category out of the active deck.

### Deterministic Constraints
To prove the system respects hard business rules, an "AI Understood" UI Chip drops down on every search. 
* It visually confirms the parsed query, the extracted budget, and the delivery timeline.
* It includes a deterministic drop counter (e.g., "Strictly removed 8 items exceeding limits"), proving that standard operational logic (price/delivery checks) governs the semantic search space.

### Smooth Mobile UX
* **Swipe Physics:** Hardware-accelerated touch physics (`translate3d`) used to prevent mobile browser scroll conflicts.
* **Secure Cart:** A dedicated cart view with a checkout footer and an item list.

---

### Tech Stack

**Frontend:**
* React (Vite)
* Tailwind CSS

**Backend:**
* Python
* FastAPI / Uvicorn (Hosted on AWS EC2)

**AI & Search Pipeline:**
* **Vector DB:** FAISS (Facebook AI Similarity Search)
* **Embeddings:** `all-MiniLM-L6-v2` (SentenceTransformers)
* **LLM Merchandiser:** Llama-3.1 8B (via Groq API)

---

## Architecture (The 3-Stage Pipeline)

When a user searches (e.g., "Cheap beach trip next week"), the backend executes a strict pipeline:

1. **Query Enrichment:** The natural language query is parsed to extract hard constraints (e.g., "cheap" = budget, "next week" = delivery <= 7 days).
2. **Vector Retrieval & Filtering:** FAISS retrieves the closest semantic matches. A Python filtering loop strictly removes items that violate the extracted price/delivery limits. Remaining items are enriched with real-time operational data and historical user signals (wishlists, abandoned carts).
3. **Reasoning & Packaging:** The surviving candidate pool and user history are sent to Llama-3.1 in a prompt. The LLM responds with a strict JSON structure categorizing items into "individuals" and "bundles," which is rendered by the React UI.

---

## Setup & Installation

### Prerequisites
* Node.js (v18+)
* Python (3.10+)
* A [Groq API Key](https://console.groq.com/)

### 1. Clone the repository
```bash
git clone https://github.com/ri067/nudge
cd nudge
source venv/bin/activate
pip install -r requirements.txt

export GROQ_API_KEY="your_api_key_here"
python backend/build_index.py

uvicorn main:app --host 0.0.0.0 --port 8000 --reload

cd frontend
npm install
npm run dev
```