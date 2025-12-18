from firebase_admin import firestore

from db.firestore import db


def update_item_usage(user_id: str, item: str) -> None:
  """
  Increment per-user item usage counters when an item is added.

  Firestore path:
    users/{userId}/stats/item_usage/items/{item}
  """
  item_key = item.strip().lower()
  if not item_key:
    return

  ref = (
    db.collection("users")
    .document(user_id)
    .collection("stats")
    .document("item_usage")
    .collection("items")
    .document(item_key)
  )

  ref.set(
    {
      "item": item_key,
      "add_count": firestore.Increment(1),
      "last_added": firestore.SERVER_TIMESTAMP,
    },
    merge=True,
  )


def get_item_usage(user_id: str) -> dict:
  """
  Read per-user usage stats as a simple mapping:
    { "tomato": 12, "onion": 5, ... }
  """
  stats_ref = (
    db.collection("users")
    .document(user_id)
    .collection("stats")
    .document("item_usage")
    .collection("items")
  )

  docs = stats_ref.stream()
  usage: dict = {}
  for doc in docs:
    data = doc.to_dict() or {}
    item = (data.get("item") or doc.id or "").strip().lower()
    if not item:
      continue
    usage[item] = int(data.get("add_count") or 0)

  return usage


