from __future__ import annotations

import os
from typing import List, Dict, Any, Optional
from datetime import datetime

from redisvl.index import SearchIndex
from redisvl.schema import IndexSchema
from redisvl.query import VectorQuery
from sentence_transformers import SentenceTransformer

from app.core.config import get_settings
from app.core.logging.logger import get_logger
from app.models.medicine import Medicine

logger = get_logger(__name__)

_embedding_model = None

def get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        logger.info("Loading sentence-transformers model 'all-MiniLM-L6-v2' (this may take a moment on first run)...")
        _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _embedding_model


class RAGService:
    def __init__(self):
        self.settings = get_settings()
        self.redis_url = self.settings.REDIS_URL
        self.model = get_embedding_model()
        self.vector_dimensions = 384
        
        self.medicine_schema = IndexSchema.from_dict({
            "index": {
                "name": "medicines_idx",
                "prefix": "med_vec:",
                "storage_type": "hash"
            },
            "fields": [
                {"name": "medicine_id", "type": "tag"},
                {"name": "name", "type": "text"},
                {"name": "composition", "type": "text"},
                {"name": "content", "type": "text"},
                {
                    "name": "embedding",
                    "type": "vector",
                    "attrs": {
                        "dims": self.vector_dimensions,
                        "distance_metric": "cosine",
                        "algorithm": "hnsw",
                        "datatype": "float32"
                    }
                }
            ]
        })
        
        self.medicine_index = SearchIndex(schema=self.medicine_schema, redis_url=self.redis_url)

    async def initialize(self):
        try:
            self.medicine_index.create(overwrite=False)
            logger.info("RAG Service initialized and Redis Vector Search indexes ready.")
        except Exception as e:
            logger.error(f"Failed to initialize RAG indexes in Redis: {e}")

    def get_embedding(self, text: str) -> List[float]:
        if not text:
            return [0.0] * self.vector_dimensions
        return self.model.encode(text).tolist()

    async def index_medicine(self, medicine: Medicine):
        content = f"Name: {medicine.name}\nGeneric: {medicine.generic_name}\n"
        content += f"Composition: {medicine.composition}\n"
        if medicine.usage_instructions:
            content += f"Usage: {medicine.usage_instructions}\n"
        if medicine.side_effects:
            content += f"Side Effects: {medicine.side_effects}\n"
        if medicine.description:
            content += f"Description: {medicine.description}\n"

        embedding = self.get_embedding(content)
        
        record = {
            "medicine_id": str(medicine.id),
            "name": medicine.name,
            "composition": medicine.composition,
            "content": content,
            "embedding": embedding
        }
        
        self.medicine_index.load([record])

    async def index_all_medicines(self, batch_size: int = 100) -> int:
        logger.info("Starting bulk indexing of medicines for RAG...")
        cursor = Medicine.find(Medicine.status == "active")
        
        count = 0
        batch = []
        
        async for med in cursor:
            content = f"Name: {med.name}\nGeneric: {med.generic_name}\nComposition: {med.composition}\n"
            if med.usage_instructions:
                content += f"Usage: {med.usage_instructions}\n"
            if med.side_effects:
                content += f"Side Effects: {med.side_effects}\n"
                
            embedding = self.get_embedding(content)
            
            record = {
                "medicine_id": str(med.id),
                "name": med.name,
                "composition": med.composition,
                "content": content,
                "embedding": embedding
            }
            batch.append(record)
            count += 1
            
            if len(batch) >= batch_size:
                self.medicine_index.load(batch)
                batch = []
                logger.info(f"Indexed {count} medicines...")
                
        if batch:
            self.medicine_index.load(batch)
            
        logger.info(f"Completed indexing {count} medicines.")
        return count

    async def semantic_search_medicines(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        query_vector = self.get_embedding(query)
        
        vector_query = VectorQuery(
            vector=query_vector,
            vector_field_name="embedding",
            return_fields=["medicine_id", "name", "composition", "content"],
            num_results=top_k
        )
        
        results = self.medicine_index.query(vector_query)
        return results

    async def answer_medical_query(self, query: str) -> str:
        docs = await self.semantic_search_medicines(query, top_k=3)
        
        context_text = ""
        for i, doc in enumerate(docs):
            context_text += f"\n--- Medicine {i+1} ---\n{doc.get('content')}\n"

        if not context_text:
            context_text = "No specific medicines found in the database for this query."

        prompt = f"""
You are a helpful medical assistant for the Semenq app.
Answer the user's question using ONLY the provided medicine context below. 
If the answer cannot be found in the context, say "I don't have enough information in my database to answer that."
Do not provide external medical advice outside of this context.

Context:
{context_text}

Question:
{query}
"""
        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            base_url=self.settings.QWEN_BASE_URL,
            api_key="ollama"
        )
        
        try:
            response = await client.chat.completions.create(
                model=self.settings.QWEN_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=500
            )
            return response.choices[0].message.content or "Sorry, I couldn't generate a response."
        except Exception as e:
            logger.error(f"Qwen LLM generation failed: {e}")
            return "Sorry, the AI service is currently unavailable."
