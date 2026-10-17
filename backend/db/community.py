from datetime import datetime
from typing import List, Dict, Optional, Any
from db.firestore import db
from db.inventory import remove_inventory_item

# In-memory fallback if Firestore is in offline / dummy mode
_IN_MEMORY_COMMUNITY_DONATIONS: List[Dict[str, Any]] = [
    {
        "id": "donation-demo-1",
        "donor_name": "Aarav Sharma",
        "user_id": "demo_donor_1",
        "food_item": "Fresh Spinach & Tomatoes",
        "quantity": 1.5,
        "unit": "kg",
        "cooking_time_mins": 0,
        "area": "Indiranagar, Bangalore",
        "pickup_type": "Porch Pickup / Delivery",
        "notes": "Surplus organic produce harvested yesterday. Fresh and refrigerated.",
        "status": "available",
        "claimed_by": None,
        "created_at": datetime.utcnow().isoformat()
    },
    {
        "id": "donation-demo-2",
        "donor_name": "Priya Nair",
        "user_id": "demo_donor_2",
        "food_item": "Home-Cooked Vegetable Biryani",
        "quantity": 4.0,
        "unit": "servings",
        "cooking_time_mins": 45,
        "area": "Koramangala, Bangalore",
        "pickup_type": "Direct Handover",
        "notes": "Freshly cooked party excess. Packed hygienically in food containers.",
        "status": "available",
        "claimed_by": None,
        "created_at": datetime.utcnow().isoformat()
    }
]


def get_community_donations(area: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch active food donations sorted by newest first, optionally filtered by area."""
    donations = []
    try:
        query_ref = db.collection("community_donations")
        docs = query_ref.stream()
        for doc in docs:
            d = doc.to_dict() or {}
            d["id"] = doc.id
            donations.append(d)
    except Exception as e:
        print(f"[COMMUNITY DONATIONS FETCH WARN] {e}")

    if not donations:
        donations = list(_IN_MEMORY_COMMUNITY_DONATIONS)

    # Filter by area if provided
    if area and area.strip():
        a_clean = area.strip().lower()
        donations = [d for d in donations if a_clean in str(d.get("area", "")).lower()]

    # Sort newest first
    donations.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
    return donations


def create_community_donation(
    user_id: str,
    donor_name: str,
    food_item: str,
    quantity: float,
    unit: str = "pieces",
    cooking_time_mins: int = 0,
    area: str = "Central Community",
    pickup_type: str = "Pickup",
    notes: str = "",
    deduct_from_pantry: bool = True
) -> Dict[str, Any]:
    """Creates a new community donation listing with food safety verification."""
    # Food safety check: if cooked, cannot exceed 240 mins (4 hours) at ambient
    if cooking_time_mins > 240:
        raise ValueError("Food safety floor violation: Prepared food cooked over 4 hours ago cannot be posted for community safety.")

    import uuid
    donation_id = f"don-{uuid.uuid4().hex[:8]}"
    now_iso = datetime.utcnow().isoformat()

    donation_record = {
        "id": donation_id,
        "donor_name": donor_name or "Generous Foodie",
        "user_id": user_id,
        "food_item": food_item.strip().title(),
        "quantity": float(quantity),
        "unit": unit,
        "cooking_time_mins": int(cooking_time_mins),
        "area": area.strip() or "Community Hub",
        "pickup_type": pickup_type,
        "notes": notes,
        "status": "available",
        "claimed_by": None,
        "created_at": now_iso
    }

    try:
        db.collection("community_donations").document(donation_id).set(donation_record)
    except Exception as e:
        print(f"[COMMUNITY DONATION SAVE WARN] {e}")
        _IN_MEMORY_COMMUNITY_DONATIONS.insert(0, donation_record)

    # Optional pantry deduction
    if deduct_from_pantry and user_id:
        try:
            remove_inventory_item(user_id, food_item, quantity, unit)
        except Exception as de:
            print(f"[COMMUNITY DONATION PANTRY DEDUCT WARN] {de}")

    return donation_record


def claim_community_donation(donation_id: str, claimer_name: str, claimer_id: str = "community_hero") -> Dict[str, Any]:
    """Marks an active donation as claimed."""
    try:
        doc_ref = db.collection("community_donations").document(donation_id)
        doc = doc_ref.get()
        if doc.exists:
            doc_ref.update({
                "status": "claimed",
                "claimed_by": claimer_name,
                "claimed_at": datetime.utcnow().isoformat()
            })
            res = doc.to_dict() or {}
            res["status"] = "claimed"
            res["claimed_by"] = claimer_name
            return res
    except Exception as e:
        print(f"[COMMUNITY CLAIM WARN] {e}")

    for d in _IN_MEMORY_COMMUNITY_DONATIONS:
        if d["id"] == donation_id:
            d["status"] = "claimed"
            d["claimed_by"] = claimer_name
            d["claimed_at"] = datetime.utcnow().isoformat()
            return d

    return {"status": "claimed", "id": donation_id, "claimed_by": claimer_name}
