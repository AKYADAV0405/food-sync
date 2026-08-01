import csv
import json
from datetime import datetime
import re
import os
import random  # <--- Essential for shuffling
import sqlite3

# Database configuration
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(backend_dir, "data", "recipes.db")

# --- HELPER: SAFE JSON LOAD ---
def safe_json_loads(val, default=None):
    if default is None:
        default = []
    if not val:
        return default
    if isinstance(val, (list, dict)):
        return val
    try:
        return json.loads(val)
    except Exception:
        return default

def slugify(text: str) -> str:
    if not text:
        return ""
    s = str(text).lower().strip()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')


# --- 1. KITCHEN STAPLES ---
COMMON_STAPLES = {
    "salt", "water", "oil", "sugar", "ice cubes", "ice",
    "turmeric", "turmeric powder", "haldi",
    "red chilli", "red chilli powder", "mirchi", "chili powder", "chilli powder",
    "coriander", "coriander powder", "dhania", "coriander leaves",
    "cumin", "cumin seeds", "jeera",
    "mustard", "mustard seeds", "rai",
    "garam masala", "hing", "asafoetida",
    "ginger", "garlic", "ginger garlic paste", 
    "lemon", "lemon juice",
    "ghee", "curry leaves",
    "black pepper", "pepper", "oil",
    "green chilli", "green chili", "hari mirchi"
}

# --- EXACT HIGH-RESOLUTION RECIPE IMAGE MAPPING ---
EXACT_RECIPE_IMAGE_MAP = {
    # Paneer Dishes
    "paneer butter masala": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80",
    "shahi paneer": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80",
    "kadai paneer": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80",
    "paneer tikka": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80",
    "matar paneer": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80",
    "palak paneer": "https://images.unsplash.com/photo-1610057099443-f63a1428f44a?auto=format&fit=crop&w=600&q=80",
    "paneer bhurji": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80",
    
    # Dal / Lentils
    "dal makhani": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80",
    "dal tadka": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80",
    "dal fry": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80",
    "chana masala": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80",
    "chole": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80",
    "rajma": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80",
    
    # Chicken / Meat
    "butter chicken": "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80",
    "chicken curry": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80",
    "chicken tikka masala": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80",
    "chicken biryani": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
    "mutton curry": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80",
    
    # Rice / Biryani / Pulao
    "biryani": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
    "veg biryani": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
    "pulao": "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80",
    "fried rice": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80",
    "jeera rice": "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80",
    
    # South Indian / Breakfast
    "dosa": "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80",
    "masala dosa": "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80",
    "idli": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80",
    "poha": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80",
    "upma": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80",
    "paratha": "https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=600&q=80",
    "aloo paratha": "https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=600&q=80",
    
    # Veg Sabzi
    "aloo gobi": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
    "aloo matar": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
    "bhindi": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
    "baingan": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
    "pav bhaji": "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=600&q=80",
    "samosa": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
    
    # Health / Light
    "salad": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80",
    "soup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80",
    "khichdi": "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=600&q=80",
    "oats": "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=600&q=80",
    "sprouts": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80",
}

DEFAULT_RECIPE_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80"

def get_exact_recipe_image_url(recipe_name: str, existing_url: str = None) -> str:
    """
    Returns high-resolution exact food photograph matching the recipe name.
    """
    if existing_url and isinstance(existing_url, str) and existing_url.startswith("http") and "via.placeholder.com" not in existing_url and "placeholder" not in existing_url:
        return existing_url
    
    name_lower = str(recipe_name or "").strip().lower()
    for key, url in EXACT_RECIPE_IMAGE_MAP.items():
        if key in name_lower or name_lower in key:
            return url
            
    # Category / Ingredient fallback matching
    if any(k in name_lower for k in ["paneer", "tofu"]):
        return EXACT_RECIPE_IMAGE_MAP["paneer butter masala"]
    if any(k in name_lower for k in ["chicken", "mutton"]):
        return EXACT_RECIPE_IMAGE_MAP["butter chicken"]
    if any(k in name_lower for k in ["dal", "lentil", "rajma", "chana", "chole"]):
        return EXACT_RECIPE_IMAGE_MAP["dal tadka"]
    if any(k in name_lower for k in ["rice", "biryani", "pulao", "khichdi"]):
        return EXACT_RECIPE_IMAGE_MAP["biryani"]
    if any(k in name_lower for k in ["dosa", "idli", "poha", "upma", "paratha", "puri", "bhatura"]):
        return EXACT_RECIPE_IMAGE_MAP["dosa"]
    if any(k in name_lower for k in ["salad", "sprouts", "bowl"]):
        return EXACT_RECIPE_IMAGE_MAP["salad"]
    if any(k in name_lower for k in ["soup", "broth"]):
        return EXACT_RECIPE_IMAGE_MAP["soup"]

    return DEFAULT_RECIPE_IMAGE


# --- PARSING HELPER ---
def parse_ingredient_qty(ing_str):
    """
    Extracts '2 onions' -> name='onions', qty=2.0, unit='pieces'
    """
    match = re.search(r"(\d+(?:[\.,]\d+)?(?:/\d+)?)\s*(tablespoon|tbsp|teaspoon|tsp|cup|g|gm|kg|ml|l|pcs|nos|piece|pieces)", ing_str, re.IGNORECASE)
    qty = 1.0
    unit = "pieces" 
    name = ing_str
    
    if match:
        qty_str = match.group(1)
        unit_str = match.group(2).lower()
        if unit_str in ['gm', 'gms']: unit = 'g'
        elif unit_str in ['pcs', 'nos', 'piece', 'pieces']: unit = 'pieces'
        elif unit_str in ['tbsp']: unit = 'tablespoon'
        elif unit_str in ['tsp']: unit = 'teaspoon'
        else: unit = unit_str

        try:
            if "/" in qty_str:
                n, d = qty_str.split('/')
                qty = float(n) / float(d)
            else:
                qty = float(qty_str.replace(',', '.'))
        except ValueError:
            qty = 1.0
            
        name = ing_str.replace(match.group(0), "").strip()
        name = re.sub(r"\s+of\s+", " ", name, flags=re.IGNORECASE).strip()
        name = name.strip(" ,.-")
    
    return name, qty, unit

def load_recipe_database():
    """Ensure that the SQLite database exists."""
    if not os.path.exists(DB_PATH):
        print(f"[WARNING] Recipe database not found at {DB_PATH}.")


def get_current_meal_time():
    hour = datetime.now().hour
    if 5 <= hour < 11: return "Breakfast"
    elif 11 <= hour < 16: return "Lunch"
    elif 16 <= hour < 19: return "Snack" 
    else: return "Dinner"

# --- SMART MATCH ---
def suggest_recipes_strict_match(focus_item: str, user_inventory_items: list[str]):
    load_recipe_database()
    current_time_slot = get_current_meal_time()
    matches = []
    inventory_set = set(item.lower().strip() for item in user_inventory_items)
    focus_item_lower = focus_item.lower().strip()

    if not focus_item_lower:
        return []

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Filter using SQL LIKE query for focus item
    cursor.execute(
        "SELECT * FROM recipes WHERE search_text LIKE ?",
        (f"%{focus_item_lower}%",)
    )
    rows = cursor.fetchall()
    conn.close()

    for row in rows:
        m_type = str(row["meal_type"] or "")
        r_name = str(row["name"] or "Recipe")
        c_type = str(row["cuisine"] or "")
        s_text = str(row["search_text"] or "")

        exact_photo = get_exact_recipe_image_url(r_name, row["image_url"] or "")
        recipe = {
            "id": row["id"],
            "slug": slugify(r_name),
            "RecipeName": r_name,
            "name": r_name,
            "title": r_name,

            "meal_type": m_type,
            "Cuisine": c_type,
            "cuisine": c_type,
            "Ingredients": row["ingredients"] or "",
            "ingredients_raw": safe_json_loads(row["ingredients_raw"]),
            "parsed_ingredients": safe_json_loads(row["parsed_ingredients"]),
            "search_text": s_text,
            "instructions": row["instructions"] or "",
            "image": exact_photo,
            "image_url": exact_photo,
            "time": row["time"] or "30"
        }
        
        missing = []
        for ing_str in recipe["ingredients_raw"]:
            ing_lower = str(ing_str).lower()
            if any(s in ing_lower for s in COMMON_STAPLES): continue
            if any(i in ing_lower for i in inventory_set): continue
            missing.append(ing_str)

        if len(missing) <= 3:
            score = 100 - (len(missing) * 10)
            if current_time_slot.lower() in m_type.lower(): score += 20
            r = recipe.copy()
            r["missing_count"] = len(missing)
            matches.append({ "recipe": r, "score": score })
    
    matches.sort(key=lambda x: x["score"], reverse=True)
    return [m["recipe"] for m in matches[:20]]

# --- MEAL PLANNER ---
def generate_multi_day_plan(days: int, inventory_items: list[str], expiring_items: list[str]):
    load_recipe_database()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if inventory_items:
        query_parts = ["search_text LIKE ?"] * len(inventory_items)
        query_str = f"SELECT * FROM recipes WHERE {' OR '.join(query_parts)} LIMIT 100"
        params = [f"%{item.lower().strip()}%" for item in inventory_items]
        cursor.execute(query_str, params)
    else:
        cursor.execute("SELECT * FROM recipes LIMIT 100")
        
    rows = cursor.fetchall()
    conn.close()

    plan = []
    used_names = set()
    breakfast_pool = []
    main_pool = []
    inventory_set = set(item.lower().strip() for item in inventory_items) if inventory_items else set()
    
    for row in rows:
        m_type = str(row["meal_type"] or "")
        r_name = str(row["name"] or "Recipe")
        c_type = str(row["cuisine"] or "")
        s_text = str(row["search_text"] or "")

        recipe = {
            "id": row["id"],
            "slug": slugify(r_name),
            "RecipeName": r_name,
            "name": r_name,
            "meal_type": m_type,
            "Cuisine": c_type,
            "cuisine": c_type,
            "Ingredients": row["ingredients"] or "",
            "ingredients_raw": safe_json_loads(row["ingredients_raw"]),
            "parsed_ingredients": safe_json_loads(row["parsed_ingredients"]),
            "search_text": s_text,
            "instructions": row["instructions"] or "",
            "image": row["image_url"] or "",
            "image_url": row["image_url"] or "",
            "time": row["time"] or "30"
        }
        
        missing = 0
        for ing_str in recipe["ingredients_raw"]:
            ing_lower = str(ing_str).lower()
            if any(s in ing_lower for s in COMMON_STAPLES): continue
            if any(i in ing_lower for i in inventory_set): continue
            missing += 1
        
        if missing <= 5 or not inventory_items:
            if "breakfast" in m_type.lower(): breakfast_pool.append(recipe)
            else: main_pool.append(recipe)
            
    random.shuffle(breakfast_pool)
    random.shuffle(main_pool)

    # Fallback pool if breakfast_pool or main_pool are small
    all_pool = breakfast_pool + main_pool

    for d in range(1, days+1):
        day = {"day": d, "breakfast": None, "lunch": None, "dinner": None}
        
        # Breakfast
        for r in (breakfast_pool or all_pool):
            if r["name"] not in used_names:
                day["breakfast"] = r; used_names.add(r["name"]); break
        
        # Lunch (Try Expiring)
        lunch_set = False
        if expiring_items:
            target = expiring_items[0].lower()
            for r in main_pool:
                if r["name"] not in used_names and target in r["search_text"].lower():
                    day["lunch"] = r; used_names.add(r["name"]); lunch_set=True; break
        if not lunch_set:
             for r in (main_pool or all_pool):
                if r["name"] not in used_names: day["lunch"] = r; used_names.add(r["name"]); break
        
        # Dinner
        for r in (main_pool or all_pool):
            if r["name"] not in used_names: day["dinner"] = r; used_names.add(r["name"]); break
        
        plan.append(day)
    return plan


STATE_CUISINE_MAP = {
    "punjab": ["punjabi", "north indian"],
    "delhi": ["north indian", "punjabi", "mughlai"],
    "south india": ["south indian", "chettinad", "kerala", "andhra"],
    "tamil nadu": ["south indian", "chettinad", "tamil"],
    "kerala": ["kerala", "south indian"],
    "karnataka": ["karnataka", "south indian", "udupi"],
    "andhra": ["andhra", "south indian", "hyderabadi"],
    "telangana": ["hyderabadi", "andhra", "south indian"],
    "maharashtra": ["maharashtrian", "kolhapuri", "malvani", "goan"],
    "mumbai": ["maharashtrian", "street food", "north indian"],
    "gujarat": ["gujarati", "kathiyawadi"],
    "rajasthan": ["rajasthani", "marwari"],
    "bengal": ["bengali", "east indian"],
    "west bengal": ["bengali", "east indian"],
    "kolkata": ["bengali", "east indian"],
    "goa": ["goan", "konkani"],
    "uttar pradesh": ["awadhi", "north indian", "mughlai"],
    "bihar": ["bihari", "north indian"]
}

def generate_culinary_masterclass(recipe):
    name_lower = recipe["name"].lower()
    instructions = recipe.get("instructions", "")
    
    technique = "Bhuna & Reduction"
    skill_level = "Intermediate 🍲"
    pro_tip = "Sauté spices until aromatic oil separates from the masala base."

    if any(k in name_lower for k in ["dal", "sambar", "rasam", "soup", "curry"]):
        technique = "Tadka (Spice Tempering)"
        skill_level = "Beginner 🍳"
        pro_tip = "Crackle mustard & cumin seeds in warm ghee/oil to release aromatic essential oils before adding to lentils."
    elif any(k in name_lower for k in ["biryani", "pulao", "rice"]):
        technique = "Dum (Steam Infusion Simmering)"
        skill_level = "Masterclass Chef 👨‍🍳"
        pro_tip = "Seal pot tightly so whole spices infuse deep into parboiled basmati grains."
    elif any(k in name_lower for k in ["paneer", "tikka", "roast", "kabab"]):
        technique = "High-Heat Searing & Marination"
        skill_level = "Intermediate 🍲"
        pro_tip = "Marinate with curd & garam masala for 15 mins to lock in moisture."
    elif any(k in name_lower for k in ["dosa", "paratha", "roti", "puri", "chappati"]):
        technique = "Dough Kneading & Temperature Griddle Control"
        skill_level = "Intermediate 🍲"
        pro_tip = "Ensure griddle is evenly hot so flatbreads puff up gracefully."

    steps = []
    if instructions:
        if isinstance(instructions, list):
            raw_steps = instructions
        else:
            raw_steps = [s.strip() for s in str(instructions).split(".") if len(s.strip()) > 5]
        for idx, s in enumerate(raw_steps[:5], 1):
            steps.append({
                "step_num": idx,
                "title": f"Step {idx}",
                "instruction": s,
                "estimated_mins": 5
            })
    else:
        steps = [
            {"step_num": 1, "title": "Prep & Chop", "instruction": "Wash and finely chop fresh ingredients and measure dry spices.", "estimated_mins": 5},
            {"step_num": 2, "title": "Aromatic Base", "instruction": "Heat oil in pan, crackle cumin seeds, and sauté onions & ginger-garlic till golden.", "estimated_mins": 7},
            {"step_num": 3, "title": "Combine & Simmer", "instruction": "Add main ingredients, dry spice powders, and simmer on medium flame till tender.", "estimated_mins": 12},
            {"step_num": 4, "title": "Garnish & Serve", "instruction": "Garnish with fresh coriander leaves and serve warm.", "estimated_mins": 2}
        ]

    return {
        "technique": technique,
        "skill_level": skill_level,
        "pro_tip": pro_tip,
        "step_by_step_guide": steps
    }


HIGH_PROTEIN_KEYWORDS = {
    "paneer", "soya", "soy", "egg", "chicken", "dal", "chana", "rajma", 
    "tofu", "sprouts", "fish", "mutton", "moong", "lentil", "curd", 
    "greek yogurt", "besan", "sattu", "prawn", "kabab", "tikka"
}

LOW_CALORIE_KEYWORDS = {
    "salad", "soup", "steamed", "roast", "sauteed", "sprouts", 
    "khichdi", "oats", "cucumber", "dalia", "poha", "upma"
}


def generate_market_depletion_meal_plan(
    days: int = 7,
    market_day: int = 3,
    user_inventory_raw: list = None,
    profile_data: dict = None,
    favorite_recipes: list = None,
    plan_goal: str = "zero_waste"
):
    """
    Advanced Multi-Factor Personalized & Goal-Optimized Meal Engine:
    Supports: zero_waste, high_protein, low_calorie, quick_easy, balanced modes.
    """
    load_recipe_database()
    if user_inventory_raw is None: user_inventory_raw = []
    if profile_data is None: profile_data = {}
    if favorite_recipes is None: favorite_recipes = []

    native_state = str(profile_data.get("native_state", "")).strip().lower()
    current_location = str(profile_data.get("current_location", "")).strip().lower()
    dietary_pref = str(profile_data.get("dietary_preferences", "")).strip().lower()

    # Map state & location to regional cuisines
    target_cuisines = set()
    for loc in [native_state, current_location]:
        if loc:
            for key, cuisines in STATE_CUISINE_MAP.items():
                if key in loc or loc in key:
                    target_cuisines.update(cuisines)

    # Virtual stock tracking
    stock_tracker = {}
    item_expirations = {}
    for item in user_inventory_raw:
        name = item.get("item", "").strip().lower()
        qty = float(item.get("quantity", 1.0))
        days_left = float(item.get("days_left", 7.0))
        if name and qty > 0:
            stock_tracker[name] = qty
            item_expirations[name] = days_left

    urgent_items = [name for name, d_left in item_expirations.items() if d_left <= market_day]
    regular_items = [name for name in stock_tracker.keys() if name not in urgent_items]
    all_inv_items = urgent_items + regular_items

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM recipes LIMIT 300")
    rows = cursor.fetchall()
    conn.close()

    recipe_pool = []
    for row in rows:
        m_type = str(row["meal_type"] or "")
        r_name = str(row["name"] or "Recipe")
        c_type = str(row["cuisine"] or "").lower()

        # Strict dietary filtering
        if "veg" in dietary_pref and "non" not in dietary_pref:
            if any(non_veg_kw in r_name.lower() or non_veg_kw in str(row["ingredients"]).lower() for non_veg_kw in ["chicken", "mutton", "fish", "egg", "prawn", "beef", "pork"]):
                continue

        exact_photo = get_exact_recipe_image_url(r_name, str(row["image_url"] or ""))
        recipe_pool.append({
            "id": row["id"],
            "slug": slugify(r_name),
            "RecipeName": r_name,
            "name": r_name,
            "title": r_name,
            "meal_type": m_type,

            "cuisine": str(row["cuisine"] or ""),
            "ingredients_raw": safe_json_loads(row["ingredients_raw"]),
            "parsed_ingredients": safe_json_loads(row["parsed_ingredients"]),
            "search_text": str(row["search_text"] or "").lower(),
            "instructions": str(row["instructions"] or ""),
            "image_url": exact_photo,
            "image": exact_photo,
            "time": str(row["time"] or "30")
        })

    plan = []
    used_names = set()
    depletion_milestones = []
    market_shopping_list = {}
    regional_matches_count = 0
    favorites_count = 0
    high_protein_count = 0
    techniques_used = set()

    for d in range(1, days + 1):
        is_pre_market = (d <= market_day)
        day_entry = {"day": d, "is_market_day": (d == market_day), "breakfast": None, "lunch": None, "dinner": None}

        for meal_slot in ["breakfast", "lunch", "dinner"]:
            best_recipe = None
            best_score = -999

            for r in recipe_pool:
                if r["name"] in used_names:
                    continue
                
                slot_match = 15 if (meal_slot == "breakfast" and "breakfast" in r["meal_type"].lower()) or \
                                   (meal_slot != "breakfast" and "breakfast" not in r["meal_type"].lower()) else 0

                s_text = r["search_text"]
                r_cuisine = r["cuisine"].lower()

                # 1. Regional Cuisine Matching (+25)
                regional_score = 0
                if target_cuisines and any(tc in r_cuisine or tc in s_text for tc in target_cuisines):
                    regional_score = 25

                # 2. User Favorite / Liked Recipe Boost (+30)
                favorite_score = 0
                if favorite_recipes and any(fav.lower() in r["name"].lower() for fav in favorite_recipes if fav):
                    favorite_score = 30

                # 3. Goal-Based Multipliers (+35 / +30)
                goal_score = 0
                if plan_goal == "high_protein":
                    if any(hp in s_text for hp in HIGH_PROTEIN_KEYWORDS):
                        goal_score = 35
                elif plan_goal == "low_calorie":
                    if any(lc in s_text for lc in LOW_CALORIE_KEYWORDS):
                        goal_score = 30
                elif plan_goal == "quick_easy":
                    try:
                        prep_time = int(str(r.get("time", "30")).replace("mins", "").strip())
                        if prep_time <= 25:
                            goal_score = 30
                    except Exception:
                        pass

                # 4. Essential Pantry Items Inventory Score (+20 / +12)
                inv_match_score = 0
                for item in urgent_items:
                    if stock_tracker.get(item, 0) > 0 and item in s_text:
                        inv_match_score += 20
                for item in regular_items:
                    if stock_tracker.get(item, 0) > 0 and item in s_text:
                        inv_match_score += 12

                total_score = slot_match + regional_score + favorite_score + goal_score + inv_match_score + random.randint(0, 4)
                if total_score > best_score:
                    best_score = total_score
                    best_recipe = r

            if not best_recipe:
                for r in recipe_pool:
                    if r["name"] not in used_names:
                        best_recipe = r
                        break

            if best_recipe:
                used_names.add(best_recipe["name"])
                
                r_c = best_recipe["cuisine"].lower()
                if target_cuisines and any(tc in r_c or tc in best_recipe["search_text"] for tc in target_cuisines):
                    regional_matches_count += 1
                if favorite_recipes and any(fav.lower() in best_recipe["name"].lower() for fav in favorite_recipes if fav):
                    favorites_count += 1

                masterclass = generate_culinary_masterclass(best_recipe)
                best_recipe["cooking_masterclass"] = masterclass
                techniques_used.add(masterclass["technique"])

                day_entry[meal_slot] = best_recipe

                for ing in best_recipe.get("parsed_ingredients", []):
                    ing_name = ing.get("item", "").strip().lower()
                    ing_qty = float(ing.get("quantity", 0.5))

                    for p_item in list(stock_tracker.keys()):
                        if p_item in ing_name or ing_name in p_item:
                            prev_qty = stock_tracker[p_item]
                            if prev_qty > 0:
                                stock_tracker[p_item] = max(0.0, prev_qty - 0.5)
                                if stock_tracker[p_item] <= 0 and is_pre_market:
                                    depletion_milestones.append({
                                        "item": p_item.capitalize(),
                                        "depleted_on_day": d,
                                        "meal": meal_slot.capitalize(),
                                        "zero_waste": True
                                    })

                    if not is_pre_market or not any(p in ing_name for p in stock_tracker if stock_tracker[p] > 0):
                        if ing_name and ing_name not in COMMON_STAPLES:
                            market_shopping_list[ing_name] = market_shopping_list.get(ing_name, 0.0) + ing_qty

        plan.append(day_entry)

    total_urgent = len(urgent_items)
    depleted_urgent = sum(1 for item in urgent_items if stock_tracker.get(item, 0) <= 0)
    zero_waste_score = round((depleted_urgent / total_urgent * 100), 0) if total_urgent > 0 else 100

    shopping_list_formatted = [
        {"item": k.capitalize(), "quantity": round(v, 2), "unit": "unit"}
        for k, v in market_shopping_list.items()
    ]

    total_meals = days * 3
    regional_affinity_pct = round((regional_matches_count / total_meals * 100), 0) if total_meals > 0 else 85
    pantry_utilization_pct = round((len(depletion_milestones) / max(1, len(all_inv_items)) * 100), 0)

    personalization_analytics = {
        "regional_affinity_score": min(100, int(regional_affinity_pct + 45)),
        "pantry_utilization_score": min(100, int(pantry_utilization_pct + 50)),
        "zero_waste_score": int(zero_waste_score),
        "favorite_boost_applied": favorites_count,
        "native_state_matched": profile_data.get("native_state") or "Universal",
        "current_location_matched": profile_data.get("current_location") or "Universal",
        "techniques_mastered": list(techniques_used)[:5]
    }

    return {
        "plan": plan,
        "market_day": market_day,
        "depletion_milestones": depletion_milestones,
        "zero_waste_score": int(zero_waste_score),
        "market_shopping_list": shopping_list_formatted[:10],
        "personalization_analytics": personalization_analytics
    }

# --- GET ALL (For Scrolling Page) ---
def get_all_recipes(q: str = None, cuisine: str = None, limit: int = 100):
    load_recipe_database()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = "SELECT * FROM recipes WHERE 1=1"
    params = []
    
    if q:
        query += " AND (name LIKE ? OR search_text LIKE ?)"
        params.extend([f"%{q}%", f"%{q}%"])
        
    if cuisine:
        query += " AND cuisine LIKE ?"
        params.append(f"%{cuisine}%")
        
    query += " LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    recipes = []
    for row in rows:
        r_name = row["name"]
        recipes.append({
            "id": row["id"],
            "slug": slugify(r_name),
            "RecipeName": row["name"],
            "name": row["name"],
            "meal_type": row["meal_type"],
            "Cuisine": row["cuisine"],
            "cuisine": row["cuisine"],
            "Ingredients": row["ingredients"],
            "ingredients_raw": safe_json_loads(row["ingredients_raw"]),
            "parsed_ingredients": safe_json_loads(row["parsed_ingredients"]),
            "search_text": row["search_text"],
            "instructions": row["instructions"],
            "image": row["image_url"],
            "image_url": row["image_url"],
            "time": row["time"]
        })
    return recipes

def get_all_cuisines():
    load_recipe_database()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT cuisine FROM recipes WHERE cuisine IS NOT NULL AND cuisine != '' ORDER BY cuisine")
    rows = cursor.fetchall()
    conn.close()
    return [row["cuisine"] for row in rows]


# --- HELPERS ---
def suggest_recipes_for_item(item_name: str):
    load_recipe_database()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT * FROM recipes WHERE search_text LIKE ? LIMIT 20",
        (f"%{item_name.lower().strip()}%",)
    )
    rows = cursor.fetchall()
    conn.close()
    
    recipes = []
    for row in rows:
        r_name = row["name"]
        recipes.append({
            "id": row["id"],
            "slug": slugify(r_name),
            "RecipeName": row["name"],
            "name": row["name"],
            "meal_type": row["meal_type"],
            "Cuisine": row["cuisine"],
            "cuisine": row["cuisine"],
            "Ingredients": row["ingredients"],
            "ingredients_raw": safe_json_loads(row["ingredients_raw"]),
            "parsed_ingredients": safe_json_loads(row["parsed_ingredients"]),
            "search_text": row["search_text"],
            "instructions": row["instructions"],
            "image": row["image_url"],
            "image_url": row["image_url"],
            "time": row["time"]
        })
    return recipes

# --- INGREDIENT SUBSTITUTION MAP ---
INGREDIENT_SUBSTITUTES = {
    "paneer": ["tofu", "ricotta", "cottage cheese"],
    "tofu": ["paneer", "ricotta"],
    "butter": ["ghee", "olive oil", "vegetable oil", "margarine"],
    "ghee": ["butter", "coconut oil", "vegetable oil"],
    "curd": ["yogurt", "sour cream", "buttermilk"],
    "yogurt": ["curd", "sour cream", "greek yogurt"],
    "lemon": ["lime", "vinegar", "amchur", "lemon juice"],
    "lime": ["lemon", "vinegar", "amchur"],
    "tomato": ["tomato puree", "tomato paste", "tamarind"],
    "sugar": ["jaggery", "honey", "maple syrup", "brown sugar"],
    "jaggery": ["sugar", "honey", "brown sugar"],
    "milk": ["almond milk", "soy milk", "oat milk", "coconut milk"],
    "chicken": ["turkey", "tofu", "paneer", "soy chunks"],
    "cream": ["malai", "coconut cream", "cashew paste"],
    "corn flour": ["arrowroot", "tapioca starch", "all purpose flour"],
    "all purpose flour": ["wheat flour", "atta", "maida"]
}

def suggest_recipes_by_ingredients(ingredients: list[str]):
    """
    Reverse-search recipes matching user ingredients with automatic substitution evaluation.
    """
    load_recipe_database()
    if not ingredients:
        return []

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    user_set = set(ing.lower().strip() for ing in ingredients if ing)
    
    # Expand set with direct substitutes
    expanded_set = set(user_set)
    substitute_map = {}
    for ing in user_set:
        for key, subs in INGREDIENT_SUBSTITUTES.items():
            if key in ing:
                for s in subs:
                    expanded_set.add(s)
                    substitute_map[s] = ing

    query_parts = ["search_text LIKE ?"] * len(user_set)
    query_str = f"SELECT * FROM recipes WHERE {' OR '.join(query_parts)} LIMIT 100"
    params = [f"%{ing}%" for ing in user_set]

    cursor.execute(query_str, params)
    rows = cursor.fetchall()
    conn.close()

    scored = []
    for row in rows:
        recipe_raw_ings = json.loads(row["ingredients_raw"])
        matched_ings = []
        substitutions_used = []
        missing_ings = []

        for r_ing in recipe_raw_ings:
            r_lower = r_ing.lower()
            if any(staple in r_lower for staple in COMMON_STAPLES):
                continue

            matched = False
            for user_ing in user_set:
                if user_ing in r_lower:
                    matched_ings.append(r_ing)
                    matched = True
                    break
            
            if not matched:
                for sub_ing in expanded_set:
                    if sub_ing in r_lower:
                        original_needed = substitute_map.get(sub_ing, sub_ing)
                        substitutions_used.append({
                            "recipe_requires": r_ing,
                            "user_has": original_needed,
                            "substitute": sub_ing
                        })
                        matched_ings.append(r_ing)
                        matched = True
                        break

            if not matched:
                missing_ings.append(r_ing)

        total_key_ings = len(matched_ings) + len(missing_ings)
        coverage_ratio = len(matched_ings) / total_key_ings if total_key_ings > 0 else 0.0

        if coverage_ratio >= 0.3:
            score = int(coverage_ratio * 100) - (len(missing_ings) * 5)
            scored.append({
                "name": row["name"],
                "title": row["name"],
                "cuisine": row["cuisine"],

                "meal_type": row["meal_type"],
                "time": row["time"],
                "image_url": row["image_url"],
                "instructions": row["instructions"],
                "ingredients_raw": recipe_raw_ings,
                "parsed_ingredients": json.loads(row["parsed_ingredients"]),
                "score": max(10, score),
                "coverage_ratio": round(coverage_ratio, 2),
                "matched_count": len(matched_ings),
                "missing_count": len(missing_ings),
                "missing_ingredients": missing_ings,
                "substitutions_used": substitutions_used
            })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:20]