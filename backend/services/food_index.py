import csv
from typing import List, Dict

try:
    from rapidfuzz import fuzz  # Optional fuzzy matching
except ImportError:  # pragma: no cover - optional dependency
    fuzz = None

from db.stats import get_item_usage
from db.inventory import get_inventory_map


def _normalize_category(raw: str) -> str:
    """
    Map various raw category labels into the Phase-1 canonical set.

    Canonical keys:
      - vegetables
      - fruits
      - pulses_dals
      - grains_cereals
      - dairy
      - spices_condiments
      - oils_fats
      - others
    """
    if not raw:
        return "others"

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

    return "others"

FOOD_INDEX: List[Dict] = []


def load_food_index():
    """Load the master food dataset into memory."""
    global FOOD_INDEX
    FOOD_INDEX = []

    with open("data/food_master.csv", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Support both older and newer CSV schemas gracefully.
            # Current file header: id,name,canonical,aliases,default_unit
            # Target schema: canonical,category,unit,aliases
            raw_name = (row.get("name") or row.get("canonical") or "").strip()
            name = raw_name.lower()

            raw_category = (row.get("category") or row.get("canonical") or "").strip()
            category = _normalize_category(raw_category)

            aliases_field = (row.get("aliases") or "").replace(";", ",")
            aliases = [a.strip().lower() for a in aliases_field.split(",") if a.strip()]

            default_unit = (row.get("default_unit") or row.get("unit") or "").strip() or "kg"

            FOOD_INDEX.append(
                {
                    "id": row.get("id", raw_name) or raw_name,
                    "name": name,
                    "category": category,
                    "aliases": aliases,
                    "default_unit": default_unit,
                }
            )


def resolve_food(term: str) -> Dict | None:
    """
    Resolve any name/alias to its canonical food definition.

    Returns dict with:
      { "canonical", "category", "default_unit", "aliases" } or None.
    """
    query = term.strip().lower()
    if not query:
        return None

    if not FOOD_INDEX:
        load_food_index()

    for item in FOOD_INDEX:
        if query == item["name"] or query in item["aliases"]:
            return {
                "canonical": item["name"],
                "category": item["category"],
                "default_unit": item["default_unit"],
                "aliases": item["aliases"],
            }

    return None


def _match_items(query: str, limit: int = 20, use_fuzzy: bool = False):
    """Core matching logic: prefix + aliases (+ optional fuzzy).

    Returns a list of dicts:
      { "item": <food dict>, "display": <matched alias or canonical> }
    """
    query = query.lower().strip()
    if not query:
        return []

    results = []

    for item in FOOD_INDEX:
        # 1) Canonical name match
        if item["name"].startswith(query):
            results.append({"item": item, "display": item["name"]})
            continue

        # 2) Alias match
        matched_alias = None
        for alias in item["aliases"]:
            if alias.startswith(query):
                matched_alias = alias
                break

        if matched_alias:
            results.append({"item": item, "display": matched_alias})
            continue

        # 3) Optional fuzzy match on canonical
        if use_fuzzy and fuzz:
            if fuzz.partial_ratio(query, item["name"]) > 80:
                results.append({"item": item, "display": item["name"]})
                continue

    # Deduplicate by id while preserving order
    seen = set()
    deduped = []
    for entry in results:
        item = entry["item"]
        if item["id"] in seen:
            continue
        seen.add(item["id"])
        deduped.append(entry)

    return deduped[:limit]


def suggest_items(user_id: str, query: str, limit: int = 5, use_fuzzy: bool = False):
    """
    Suggest items by prefix over name/aliases, optionally fuzzy,
    then re-rank using per-user usage frequency.

    LEVEL 1 personalization: frequency-based, no ML.
    """
    candidates = _match_items(query, limit=limit * 3, use_fuzzy=use_fuzzy)
    if not candidates:
        return []

    usage = get_item_usage(user_id)
    inventory_map = get_inventory_map(user_id)

    def score(entry: Dict) -> int:
        item = entry["item"]
        return usage.get(item["name"], 0)

    ranked = sorted(candidates, key=score, reverse=True)

    result = []
    for entry in ranked[:limit]:
        item = entry["item"]
        canonical = item["name"]
        result.append(
            {
                "display": entry["display"],
                "canonical": canonical,
                "category": item["category"],
                "default_unit": item["default_unit"],
                "already_in_inventory": canonical in inventory_map,
                "current_quantity": inventory_map.get(canonical, 0),
            }
        )

    return result

