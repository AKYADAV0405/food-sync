# db/shopping_list.py
from db.firestore import db

def get_shopping_list(user_id):
    list_ref = (
        db.collection("users")
        .document(user_id)
        .collection("shopping_list")
    )
    docs = list_ref.stream()
    items = []
    for doc in docs:
        data = doc.to_dict() or {}
        items.append({
            "item": data.get("item", doc.id),
            "quantity": data.get("quantity", 1.0),
            "unit": data.get("unit", "pieces"),
            "checked": data.get("checked", False)
        })
    return items

def add_shopping_item(user_id, item, quantity=1.0, unit="pieces"):
    doc_ref = (
        db.collection("users")
        .document(user_id)
        .collection("shopping_list")
        .document(item.lower().strip())
    )
    doc = doc_ref.get()
    if doc.exists:
        current_data = doc.to_dict() or {}
        current_qty = float(current_data.get("quantity", 0))
        doc_ref.update({
            "quantity": current_qty + float(quantity)
        })
    else:
        doc_ref.set({
            "item": item,
            "quantity": float(quantity),
            "unit": unit,
            "checked": False
        })
    return get_shopping_list(user_id)

def remove_shopping_item(user_id, item_name):
    doc_ref = (
        db.collection("users")
        .document(user_id)
        .collection("shopping_list")
        .document(item_name.lower().strip())
    )
    doc_ref.delete()
    return get_shopping_list(user_id)

def clear_checked_items(user_id):
    """Removes items marked as 'checked' (bought)"""
    list_ref = (
        db.collection("users")
        .document(user_id)
        .collection("shopping_list")
    )
    docs = list_ref.stream()
    for doc in docs:
        data = doc.to_dict() or {}
        if data.get("checked", False):
            doc.reference.delete()
    return get_shopping_list(user_id)

def toggle_item_checked(user_id, item_name):
    doc_ref = (
        db.collection("users")
        .document(user_id)
        .collection("shopping_list")
        .document(item_name.lower().strip())
    )
    doc = doc_ref.get()
    if doc.exists:
        current_data = doc.to_dict() or {}
        current_checked = bool(current_data.get("checked", False))
        doc_ref.update({
            "checked": not current_checked
        })
    return get_shopping_list(user_id)