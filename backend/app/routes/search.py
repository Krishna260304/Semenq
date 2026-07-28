from __future__ import annotations

from math import sqrt

from fastapi import APIRouter, Query

from app.core.responses import APIResponse
from app.models.medicine import Medicine, MedicineInventory
from app.models.search import SearchResult
from app.models.user import Pharmacy

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("/suggestions", response_model=APIResponse[list[dict]], summary="Search suggestions")
async def get_suggestions(q: str = Query("", min_length=1)) -> APIResponse:
    medicines = await Medicine.find(Medicine.is_deleted == False).limit(50).to_list()  # noqa: E712

    suggestions: list[dict] = []
    seen: set[str] = set()
    for medicine in medicines:
        haystack = " ".join(filter(None, [medicine.name, medicine.generic_name, medicine.category, medicine.manufacturer])).lower()
        if q.lower() not in haystack:
            continue
        for text, kind in [
            (medicine.name, "medicine"),
            (medicine.generic_name, "generic"),
            (medicine.category, "category"),
            (medicine.manufacturer, "brand"),
        ]:
            if text and text not in seen:
                suggestions.append({"text": text, "type": kind, "medicineId": None, "category": medicine.category})
                seen.add(text)
    return APIResponse.ok(data=suggestions, message="Suggestions retrieved.")


@router.get("/medicines", response_model=APIResponse[dict], summary="Search medicines")
async def search_medicines(
    q: str = Query("", alias="q"),
    lat: float | None = None,
    lng: float | None = None,
    radius: float = 5.0,
    sortBy: str = "bestMatch",
) -> APIResponse:
    medicines = await Medicine.find(Medicine.is_deleted == False).to_list()  # noqa: E712
    pharmacies = await Pharmacy.find(Pharmacy.is_deleted == False).to_list()  # noqa: E712
    inventories = await MedicineInventory.find(MedicineInventory.is_deleted == False).to_list()  # noqa: E712

    query = q.strip().lower()
    results: list[dict] = []
    for inventory in inventories:
        medicine = next((item for item in medicines if str(item.id) == str(inventory.medicine_id)), None)
        pharmacy = next((item for item in pharmacies if str(item.id) == str(inventory.pharmacy_id)), None)
        if not medicine or not pharmacy:
            continue

        haystack = " ".join(filter(None, [medicine.name, medicine.generic_name, medicine.category, medicine.manufacturer, inventory.medicine_composition])).lower()
        if query and query not in haystack:
            continue

        distance = 0.0
        if lat is not None and lng is not None and pharmacy.latitude is not None and pharmacy.longitude is not None:
            distance = round(sqrt((pharmacy.latitude - lat) ** 2 + (pharmacy.longitude - lng) ** 2) * 111, 1)

        results.append(
            {
                "medicine": medicine.model_dump(),
                "pharmacy": pharmacy.model_dump(),
                "price": inventory.unit_price,
                "quantity": inventory.available_quantity,
                "distance": distance,
                "distanceUnit": "km",
                "estimatedDelivery": "Pickup" if not pharmacy.courier_enabled else "Courier available",
                "deliveryType": "courier" if pharmacy.courier_enabled else "pickup",
                "stockStatus": inventory.status.value if hasattr(inventory.status, "value") else str(inventory.status),
                "matchScore": 1.0,
            }
        )

    total_results = len(results)
    return APIResponse.ok(
        data={
            "query": q,
            "totalResults": total_results,
            "searchRadius": radius,
            "expansionLevel": "national" if total_results > 20 else "city",
            "results": results,
            "mapMarkers": [
                {
                    "pharmacyId": item["pharmacy"]["id"],
                    "pharmacyName": item["pharmacy"]["pharmacy_name"] if "pharmacy_name" in item["pharmacy"] else item["pharmacy"]["name"],
                    "lat": item["pharmacy"].get("latitude") or 0,
                    "lng": item["pharmacy"].get("longitude") or 0,
                    "stockStatus": item["stockStatus"],
                    "price": item["price"],
                    "quantity": item["quantity"],
                }
                for item in results[:10]
            ],
        },
        message="Search completed.",
    )


@router.get("/semantic", response_model=APIResponse[list[dict]], summary="Semantic search for medicines via RAG")
async def semantic_search(
    q: str = Query(..., description="Natural language search query (e.g. 'cream for rash')"),
    top_k: int = Query(5, description="Number of results to return")
) -> APIResponse:
    from app.services.rag_service import RAGService
    try:
        rag = RAGService()
        results = await rag.semantic_search_medicines(q, top_k)
        
        # results is a list of dicts from redisvl
        formatted_results = []
        for r in results:
            formatted_results.append({
                "medicine_id": r.get("medicine_id"),
                "name": r.get("name"),
                "composition": r.get("composition"),
                "match_snippet": r.get("content")[:200] + "..." if r.get("content") else "",
                "score": r.get("vector_distance")
            })
            
        return APIResponse.ok(
            data=formatted_results,
            message="Semantic search completed."
        )
    except Exception as e:
        return APIResponse.error(message=f"Semantic search failed: {str(e)}")

@router.post("/index-medicines", summary="Admin trigger to reindex all medicines for semantic search")
async def index_medicines() -> APIResponse:
    from app.services.rag_service import RAGService
    try:
        rag = RAGService()
        await rag.initialize()
        count = await rag.index_all_medicines()
        return APIResponse.ok(message=f"Successfully indexed {count} medicines for semantic search.")
    except Exception as e:
        return APIResponse.error(message=f"Indexing failed: {str(e)}")

@router.get("/chat", response_model=APIResponse[dict], summary="RAG Chatbot Assistant")
async def chat_assistant(
    q: str = Query(..., description="Ask a medical question (e.g., 'What are the side effects of paracetamol?')")
) -> APIResponse:
    from app.services.rag_service import RAGService
    try:
        rag = RAGService()
        answer = await rag.answer_medical_query(q)
        return APIResponse.ok(
            data={"question": q, "answer": answer},
            message="Chat completed."
        )
    except Exception as e:
        return APIResponse.error(message=f"Chat failed: {str(e)}")