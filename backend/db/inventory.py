import csv

from db.firestore import db
from db.stats import update_item_usage

FOOD_CATEGORY_MAP: dict[str, str] = {}


def _load_food_categories():
    """Load canonical-name -> category mapping from the master CSV once."""
    global FOOD_CATEGORY_MAP
    if FOOD_CATEGORY_MAP:
        return
    try:
        with open("data/food_master.csv", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = (row.get("name") or row.get("canonical") or "").strip().lower()
                raw_cat = (row.get("category") or row.get("canonical") or "").strip()
                if not name:
                    continue
                category = _normalize_category_label(raw_cat, None, from_map=True)
                # Map canonical name -> category
                FOOD_CATEGORY_MAP[name] = category

                # Also map aliases -> same category (so "matar", "gobhi", etc. work)
                aliases_field = (row.get("aliases") or "").replace(";", ",")
                for raw_alias in aliases_field.split(","):
                    alias = raw_alias.strip().lower()
                    if not alias:
                        continue
                    FOOD_CATEGORY_MAP[alias] = category
    except FileNotFoundError:
        # Safe fallback: no mapping, everything will go to "others"
        FOOD_CATEGORY_MAP = {}


def _normalize_category_label(raw: str | None, item_name: str | None = None, from_map: bool = False) -> str:
    """
    Normalize arbitrary category strings into the Phase-1 canonical set.

    If `raw` is missing, try to infer from the master CSV using `item_name`.
    """
    if raw:
        text = raw.strip().lower()
        if text in {"veg", "veggie", "vegetable", "vegetables"}:
            return "vegetables"
        if text in {"fruit", "fruits"}:
            return "fruits"
        if text in {"pulse", "pulses", "dal", "dals"}:
            return "pulses_dals"
        if text in {"grain", "grains", "cereal", "cereals"}:
            return "grains_cereals"
        if text in {"dairy", "milk"}:
            return "dairy"
        if text in {"spice", "spices", "condiment", "condiments"}:
            return "spices_condiments"
        if text in {"oil", "oils", "fat", "fats"}:
            return "oils_fats"

    # Avoid infinite recursion when called from _load_food_categories
    if not from_map and item_name:
        _load_food_categories()
        cat = FOOD_CATEGORY_MAP.get(item_name.strip().lower())
        if cat:
            return cat

    return "others"


def get_inventory(user_id: str):
    inventory_ref = (
        db.collection("users")
        .document(user_id)
        .collection("inventory")
    )

    docs = inventory_ref.stream()

    items = []
    for doc in docs:
        data = doc.to_dict() or {}
        item_name = data.get("item", doc.id)
        items.append({
            "item": item_name,
            "quantity": data.get("quantity", 0),
            "unit": data.get("unit", ""),
            "category": _normalize_category_label(data.get("category"), item_name),
        })

    return items


def get_inventory_map(user_id: str):
    """
    Return a simple mapping of canonical item -> quantity, e.g.
      { "tomato": 2, "rice": 1 }

    Document IDs are assumed to be canonical names.
    """
    inventory_ref = (
        db.collection("users")
        .document(user_id)
        .collection("inventory")
    )

    docs = inventory_ref.stream()
    return {
        doc.id: (doc.to_dict() or {}).get("quantity", 0)
        for doc in docs
    }


def add_inventory_item(user_id: str, item: str, quantity: int, unit: str, category: str | None = None):
    doc_ref = (
        db.collection("users")
        .document(user_id)
        .collection("inventory")
        .document(item)
    )

    doc = doc_ref.get()

    if doc.exists:
        current_data = doc.to_dict() or {}
        current_qty = current_data.get("quantity", 0)
        doc_ref.update({
            "quantity": current_qty + quantity
        })
    else:
        payload = {
            "item": item,
            "quantity": quantity,
            "unit": unit,
        }
        if category:
            payload["category"] = category
        doc_ref.set(payload)

    # Track usage for personalized suggestions
    update_item_usage(user_id=user_id, item=item)

    return {"message": "Item added/updated successfully"}


def remove_inventory_item(user_id: str, item: str, quantity: int = 1):
    doc_ref = (
        db.collection("users")
        .document(user_id)
        .collection("inventory")
        .document(item)
    )

    doc = doc_ref.get()

    if not doc.exists:
        return {"message": "Item does not exist"}

    current_qty = doc.to_dict().get("quantity", 0)
    new_qty = current_qty - quantity

    if new_qty <= 0:
        doc_ref.delete()
        return {"message": "Item removed completely"}
    else:
        doc_ref.update({"quantity": new_qty})
        return {"message": "Item quantity decremented"}
