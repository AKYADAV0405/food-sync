import csv
from datetime import datetime, timedelta

from db.firestore import db
from db.stats import update_item_usage

FOOD_CATEGORY_MAP: dict[str, str] = {}


def _load_food_categories():
    """Load canonical-name -> category mapping from the master CSV once."""
    global FOOD_CATEGORY_MAP
    if FOOD_CATEGORY_MAP:
        return
    try:
        import os
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        csv_path = os.path.join(backend_dir, "data/food_master.csv")
        with open(csv_path, encoding="utf-8") as f:
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
    from services.food_index import get_item_metadata
    items = []
    try:
        inventory_ref = (
            db.collection("users")
            .document(user_id)
            .collection("inventory")
        )

        docs = inventory_ref.stream()

        for doc in docs:
            data = doc.to_dict() or {}
            item_name = data.get("item", doc.id)
            
            # Determine shelf life from metadata (default 14 days for unknown items)
            metadata = get_item_metadata(item_name)
            shelf_life = float(metadata.get("shelf_life_days", 14)) if metadata else 14.0
            
            # Retrieve or default added_at
            added_at_str = data.get("added_at")
            if added_at_str:
                try:
                    # Remove Z and parse
                    dt_str = added_at_str
                    if dt_str.endswith("Z"):
                        dt_str = dt_str[:-1] + "+00:00"
                    added_at = datetime.fromisoformat(dt_str)
                except:
                    added_at = datetime.utcnow()
            else:
                added_at = datetime.utcnow()
                
            elapsed_days = (datetime.utcnow() - added_at.replace(tzinfo=None)).days
            days_left = int(shelf_life - elapsed_days)
            
            # If item is expired (0 days left or negative), automatically purge from Firestore & omit
            if days_left <= 0:
                try:
                    doc.reference.delete()
                except Exception as e:
                    print(f"[EXPIRE PURGE] Failed to delete expired item {item_name}:", e)
                continue

            items.append({
                "item": item_name,
                "quantity": data.get("quantity", 0),
                "unit": data.get("unit", ""),
                "category": _normalize_category_label(data.get("category"), item_name),
                "shelf_life": shelf_life,
                "days_left": max(1, days_left),
                "added_at": added_at_str or datetime.utcnow().isoformat()
            })
    except Exception as e:
        print(f"[FIREBASE INVENTORY NOTICE] Firestore query notice: {e}")

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


from firebase_admin import firestore


@firestore.transactional
def _add_inventory_item_transaction(transaction, doc_ref, item: str, quantity: float, unit: str, category: str | None, metadata: dict | None, now_iso: str):
    snapshot = doc_ref.get(transaction=transaction)
    
    if metadata:
        target_qty = convert_to_store_unit(quantity, unit, metadata)
        target_unit = metadata.get("store_unit", unit)
    else:
        target_qty = float(quantity)
        target_unit = unit

    if snapshot.exists:
        current_data = snapshot.to_dict() or {}
        current_qty = float(current_data.get("quantity", 0))
        transaction.update(doc_ref, {
            "quantity": round(current_qty + target_qty, 3),
            "added_at": now_iso
        })
    else:
        payload = {
            "item": item,
            "quantity": round(target_qty, 3),
            "unit": target_unit,
            "added_at": now_iso
        }
        if category:
            payload["category"] = category
        transaction.set(doc_ref, payload)


@firestore.transactional
def _remove_inventory_item_transaction(transaction, doc_ref, quantity: float, unit: str | None, metadata: dict | None):
    snapshot = doc_ref.get(transaction=transaction)
    if not snapshot.exists:
        return {"message": "Item does not exist"}

    current_data = snapshot.to_dict() or {}
    current_qty = float(current_data.get("quantity", 0))
    current_unit = current_data.get("unit", "")

    if metadata:
        deduct_qty = convert_to_store_unit(quantity, unit or current_unit, metadata)
    else:
        deduct_qty = float(quantity)

    new_qty = current_qty - deduct_qty

    if new_qty <= 0:
        transaction.delete(doc_ref)
        return {"message": "Item removed completely"}
    else:
        transaction.update(doc_ref, {"quantity": round(new_qty, 3)})
        return {"message": "Item quantity decremented"}


def add_inventory_item(user_id: str, item: str, quantity: float, unit: str, category: str | None = None):
    from services.food_index import get_item_metadata, resolve_food, convert_to_store_unit
    
    # Resolve canonical name & metadata
    resolved = resolve_food(item)
    canonical_name = resolved["canonical"] if resolved else item.strip().lower()
    metadata = get_item_metadata(canonical_name) if resolved else None

    doc_ref = (
        db.collection("users")
        .document(user_id)
        .collection("inventory")
        .document(canonical_name)
    )

    now_iso = datetime.utcnow().isoformat()
    norm_category = _normalize_category_label(category, canonical_name)

    try:
        transaction = db.transaction()
        _add_inventory_item_transaction(transaction, doc_ref, canonical_name, quantity, unit, norm_category, metadata, now_iso)
    except Exception as tx_err:
        print(f"[INVENTORY ADD TX FALLBACK] {tx_err}")
        target_qty = convert_to_store_unit(quantity, unit, metadata) if metadata else float(quantity)
        target_unit = metadata.get("store_unit", unit) if metadata else unit
        
        doc = doc_ref.get()
        if doc.exists:
            cur_data = doc.to_dict() or {}
            cur_qty = float(cur_data.get("quantity", 0))
            doc_ref.update({
                "quantity": round(cur_qty + target_qty, 3),
                "added_at": now_iso
            })
        else:
            doc_ref.set({
                "item": canonical_name,
                "quantity": round(target_qty, 3),
                "unit": target_unit,
                "category": norm_category,
                "added_at": now_iso
            })

    # Track usage for personalized suggestions
    try:
        update_item_usage(user_id=user_id, item=canonical_name)
    except Exception:
        pass

    return {"message": "Item added/updated successfully", "canonical": canonical_name}


def remove_inventory_item(user_id: str, item: str, quantity: float = 1.0, unit: str | None = None):
    from services.food_index import get_item_metadata, resolve_food, convert_to_store_unit

    resolved = resolve_food(item)
    canonical_name = resolved["canonical"] if resolved else item.strip().lower()
    metadata = get_item_metadata(canonical_name) if resolved else None

    doc_ref = (
        db.collection("users")
        .document(user_id)
        .collection("inventory")
        .document(canonical_name)
    )

    try:
        transaction = db.transaction()
        result = _remove_inventory_item_transaction(transaction, doc_ref, quantity, unit, metadata)
    except Exception as tx_err:
        print(f"[INVENTORY REMOVE TX FALLBACK] {tx_err}")
        doc = doc_ref.get()
        if not doc.exists:
            return {"message": "Item does not exist"}
        cur_data = doc.to_dict() or {}
        cur_qty = float(cur_data.get("quantity", 0))
        deduct_qty = convert_to_store_unit(quantity, unit or cur_data.get("unit", "pieces"), metadata) if metadata else float(quantity)
        new_qty = cur_qty - deduct_qty
        if new_qty <= 0:
            doc_ref.delete()
            return {"message": "Item removed completely"}
        else:
            doc_ref.update({"quantity": round(new_qty, 3)})
            return {"message": "Item quantity decremented"}

    return result
