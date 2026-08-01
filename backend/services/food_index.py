import csv
from typing import List, Dict, Optional

try:
    from rapidfuzz import fuzz, process
except ImportError:
    fuzz = None
    process = None

from db.stats import get_item_usage
from db.inventory import get_inventory_map

FOOD_INDEX: List[Dict] = []
FOOD_LOOKUP: Dict[str, Dict] = {} 

def load_food_index():
    """Load food_master.csv into memory."""
    global FOOD_INDEX, FOOD_LOOKUP
    FOOD_INDEX = []
    FOOD_LOOKUP = {}
    
    try:
        import os
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        csv_path = os.path.join(backend_dir, "data/food_master.csv")
        with open(csv_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    avg_weight = float(row.get("avg_weight_g", 0) or 0)
                except ValueError:
                    avg_weight = 0.0
                
                # Check for piece_weight_g alias or column
                piece_weight = avg_weight
                if "piece_weight_g" in row and row["piece_weight_g"]:
                     try:
                        piece_weight = float(row["piece_weight_g"])
                     except ValueError:
                        pass

                try:
                    shelf_life = int(row.get("shelf_life_days", 7) or 7)
                except ValueError:
                    shelf_life = 7

                store_unit = row.get("store_unit") or row.get("default_unit") or "unit"

                item = {
                    "id": row["id"],
                    "name": row["canonical"].strip().lower(),
                    "canonical": row["canonical"].strip().lower(),
                    "category": row["category"].strip().lower(),
                    "default_unit": row["default_unit"].strip().lower(),
                    "store_unit": store_unit.strip().lower(), # Canonical storage unit
                    "aliases": [a.strip().lower() for a in row.get("aliases", "").split(";") if a.strip()],
                    "avg_weight_g": avg_weight,
                    "piece_weight_g": piece_weight, # Specific for piece conversion
                    "shelf_life_days": shelf_life,
                    # Optional image_url if present in CSV
                    "image_url": row.get("image_url", "").strip()
                }
                FOOD_INDEX.append(item)
                FOOD_LOOKUP[item["canonical"]] = item
                for alias in item["aliases"]:
                    FOOD_LOOKUP[alias] = item
                    
    except FileNotFoundError:
        print("Warning: data/food_master.csv not found.")
        FOOD_INDEX = []

def get_all_matchable_names() -> List[str]:
    if not FOOD_LOOKUP: load_food_index()
    return list(FOOD_LOOKUP.keys())

def get_all_canonical_names() -> List[str]:
    if not FOOD_INDEX: load_food_index()
    return [item["canonical"] for item in FOOD_INDEX]

def get_item_metadata(item_name: str) -> Dict | None:
    """
    Resolve an item name and return canonical metadata
    including unit conversion info.
    """
    resolved = resolve_food(item_name)
    if not resolved:
        return None

    return {
        "canonical": resolved["canonical"],
        "category": resolved["category"],
        "store_unit": resolved.get("store_unit", resolved["default_unit"]),
        "piece_weight_g": resolved.get("piece_weight_g", 0),
        "shelf_life_days": resolved.get("shelf_life_days", 7),
        "image_url": resolved.get("image_url", "")
    }

DESCRIPTOR_WORDS = {
    "fresh", "organic", "diced", "chopped", "sliced", "minced", "grated",
    "peeled", "raw", "cooked", "ripe", "bunch", "bunch of", "large", "small",
    "medium", "whole", "red", "green", "yellow", "white", "black"
}

def convert_to_store_unit(quantity: float, input_unit: str, metadata: Dict) -> float:
    """
    Convert user-entered quantity into canonical storage unit.
    Handles:
    - Cups, Tbsp, Tsp, Oz, Lbs, Grams, Kg, Ml, Liter, Pieces.
    - Piece -> Kg/Grams (e.g. 5 tomatoes -> 0.4 kg)
    - Kg -> Piece (e.g. 1 kg cabbage -> 1.43 pieces)
    """
    store_unit = metadata["store_unit"].lower().strip()
    piece_weight_g = metadata.get("piece_weight_g", 0)
    input_unit = input_unit.lower().strip()
    quantity = float(quantity)

    # 1. Normalize input unit strings
    if input_unit in ['kgs', 'kilogram', 'kilograms']: input_unit = 'kg'
    if input_unit in ['gm', 'gms', 'gram', 'grams']: input_unit = 'g'
    if input_unit in ['ltr', 'liter', 'liters', 'l']: input_unit = 'liter'
    if input_unit in ['milli', 'milliliter', 'milliliters', 'ml']: input_unit = 'ml'
    if input_unit in ['pc', 'pcs', 'piece', 'pieces', 'no', 'nos', 'unit', 'units', 'pack', 'box']: input_unit = 'pieces'
    if input_unit in ['cup', 'cups']: input_unit = 'cup'
    if input_unit in ['tbsp', 'tablespoon', 'tablespoons']: input_unit = 'tbsp'
    if input_unit in ['tsp', 'teaspoon', 'teaspoons']: input_unit = 'tsp'
    if input_unit in ['oz', 'ounce', 'ounces']: input_unit = 'oz'
    if input_unit in ['lb', 'lbs', 'pound', 'pounds']: input_unit = 'lb'

    # Normalize store_unit aliases
    if store_unit in ['ltr', 'l']: store_unit = 'liter'
    if store_unit in ['pc', 'pcs', 'unit', 'units']: store_unit = 'pieces'

    # 2. Same unit -> no conversion needed
    if input_unit == store_unit:
        return round(quantity, 3)

    # 3. CONVERT INPUT TO INTERMEDIATE BASE QUANTITY (in g or ml or pieces)
    weight_in_g = None
    volume_in_ml = None

    if input_unit == 'g': weight_in_g = quantity
    elif input_unit == 'kg': weight_in_g = quantity * 1000.0
    elif input_unit == 'lb': weight_in_g = quantity * 453.592
    elif input_unit == 'oz': weight_in_g = quantity * 28.3495
    elif input_unit == 'tbsp':
        weight_in_g = quantity * 15.0
        volume_in_ml = quantity * 15.0
    elif input_unit == 'tsp':
        weight_in_g = quantity * 5.0
        volume_in_ml = quantity * 5.0
    elif input_unit == 'cup':
        weight_in_g = quantity * 240.0
        volume_in_ml = quantity * 240.0
    elif input_unit == 'ml': volume_in_ml = quantity
    elif input_unit == 'liter': volume_in_ml = quantity * 1000.0

    # 4. CONVERT TO CANONICAL STORE UNIT
    if store_unit == 'kg' and weight_in_g is not None:
        return round(weight_in_g / 1000.0, 3)
    if store_unit == 'g' and weight_in_g is not None:
        return round(weight_in_g, 3)
    if store_unit == 'liter' and volume_in_ml is not None:
        return round(volume_in_ml / 1000.0, 3)
    if store_unit == 'ml' and volume_in_ml is not None:
        return round(volume_in_ml, 3)

    # 5. PIECE <-> WEIGHT/VOLUME CONVERSIONS using piece_weight_g
    if piece_weight_g > 0:
        if input_unit == 'pieces':
            total_g = quantity * piece_weight_g
            if store_unit == 'kg': return round(total_g / 1000.0, 3)
            if store_unit == 'g': return round(total_g, 3)
            if store_unit == 'liter': return round(total_g / 1000.0, 3)
        if store_unit == 'pieces' and weight_in_g is not None:
            return round(weight_in_g / piece_weight_g, 2)

    return round(quantity, 3)

def resolve_food(name: str) -> Dict | None:
    if not FOOD_LOOKUP: load_food_index()
    name_clean = name.lower().strip()
    if name_clean in FOOD_LOOKUP: return FOOD_LOOKUP[name_clean]

    # Strip common descriptor words e.g. "organic diced tomato" -> "tomato"
    words = [w for w in name_clean.split() if w not in DESCRIPTOR_WORDS]
    stripped_name = " ".join(words).strip()
    if stripped_name and stripped_name in FOOD_LOOKUP:
        return FOOD_LOOKUP[stripped_name]

    tokens = set(name_clean.split())
    sorted_keys = sorted(FOOD_LOOKUP.keys(), key=len, reverse=True)

    for key in sorted_keys:
        if key in tokens: return FOOD_LOOKUP[key]
        if len(key) > 4 and key in name_clean: return FOOD_LOOKUP[key]

    if fuzz and process:
        match = process.extractOne(stripped_name or name_clean, FOOD_LOOKUP.keys(), scorer=fuzz.token_set_ratio)
        if match:
            best_match, score, _ = match
            if score >= 80: return FOOD_LOOKUP[best_match]

    return None

def _match_items(query: str, limit: int = 10, use_fuzzy: bool = False) -> List[Dict]:
    if not FOOD_INDEX: load_food_index()
    query = query.lower().strip()
    results = []
    
    for item in FOOD_INDEX:
        if item["name"].startswith(query):
            results.append({"item": item, "score": 100, "display": item["name"]})
            continue
        for alias in item["aliases"]:
            if alias.startswith(query):
                results.append({"item": item, "score": 90, "display": alias})
                break
                
    if use_fuzzy and len(results) < limit and fuzz:
        for item in FOOD_INDEX:
            if any(r["item"]["id"] == item["id"] for r in results): continue
            score = fuzz.partial_ratio(query, item["name"])
            if score > 80:
                results.append({"item": item, "score": score, "display": item["name"]})
                
    results.sort(key=lambda x: x["score"], reverse=True)
    
    seen = set()
    deduped = []
    for entry in results:
        item = entry["item"]
        if item["id"] in seen: continue
        seen.add(item["id"])
        deduped.append(entry)
        
    return deduped[:limit]

def suggest_items(user_id: str, query: str, limit: int = 5, use_fuzzy: bool = False):
    candidates = _match_items(query, limit=limit * 3, use_fuzzy=use_fuzzy)
    if not candidates: return []
    usage = get_item_usage(user_id)
    
    def score(entry: Dict) -> int:
        item = entry["item"]
        return (usage.get(item["name"], 0) * 10) + entry["score"]
        
    ranked = sorted(candidates, key=score, reverse=True)
    result = []
    for entry in ranked[:limit]:
        item = entry["item"]
        canonical = item["name"]
        result.append({
            "display": entry["display"],
            "canonical": canonical,
            "category": item["category"],
            "default_unit": item["default_unit"],
            "avg_weight_g": item["avg_weight_g"],
            "store_unit": item.get("store_unit", item["default_unit"]),
            "score": entry["score"]
        })
    return result