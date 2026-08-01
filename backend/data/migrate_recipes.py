import csv
import json
import os
import re
import sqlite3
import sys

# Add backend directory to sys.path so we can import services.recipe_engine
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from services.recipe_engine import parse_ingredient_qty

DB_PATH = os.path.join(backend_dir, "data", "recipes.db")
CSV_PATH = None

possible_paths = [
    os.path.join(backend_dir, "data", "recipe.csv"),
    os.path.join(backend_dir, "data", "Indori.xlsx - dataset.xlsx.csv"),
    os.path.join(backend_dir, "data", "Cleaned_Indian_Food_Dataset.csv")
]

for path in possible_paths:
    if os.path.exists(path):
        CSV_PATH = path
        break

def migrate():
    if not CSV_PATH:
        print("[ERROR] No recipe CSV file found. Cannot migrate.")
        return

    print(f"[INFO] Found CSV file at: {CSV_PATH}")
    print(f"[INFO] Migrating to SQLite database at: {DB_PATH}")

    # Remove existing db to perform clean migration
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create table
    cursor.execute("""
        CREATE TABLE recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            meal_type TEXT,
            cuisine TEXT,
            ingredients TEXT,
            ingredients_raw TEXT,
            parsed_ingredients TEXT,
            search_text TEXT,
            instructions TEXT,
            image_url TEXT,
            time TEXT
        )
    """)

    # Create index on search_text for fast queries
    cursor.execute("CREATE INDEX idx_recipes_search_text ON recipes (search_text)")
    cursor.execute("CREATE INDEX idx_recipes_name ON recipes (name)")

    seen_names = set()
    count = 0

    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        
        # We will batch insertions for speed
        batch = []
        batch_size = 500
        
        for row in reader:
            name = row.get("Recipe Name") or row.get("TranslatedRecipeName") or "Unknown"
            name = name.strip()
            if not name or name.lower() in seen_names:
                continue
            seen_names.add(name.lower())

            # Ingredients Parsing
            raw_ingreds = row.get("Cleaned-Ingredients") or row.get("New Ingredients") or row.get("Ingredients") or ""
            ingredients_list = []
            if raw_ingreds:
                 cleaned_str = raw_ingreds.replace("[", "").replace("]", "").replace("'", "")
                 parts = cleaned_str.split("\n") if "\n" in cleaned_str else cleaned_str.split(",")
                 ingredients_list = [p.strip() for p in parts if p.strip()]

            parsed_ingredients = []
            for ing in ingredients_list:
                p_name, p_qty, p_unit = parse_ingredient_qty(ing)
                parsed_ingredients.append({
                    "item": p_name, "quantity": p_qty, "unit": p_unit, "original": ing
                })

            cleaned_ingredients_str = ",".join(ingredients_list)

            # Instructions Cleaning (Keep Newlines)
            instructions = row.get("Instructions") or row.get("TranslatedInstructions") or ""
            instructions = instructions.replace("\r", "")
            if "\n" not in instructions and re.search(r'\d+\.', instructions):
                 instructions = re.sub(r'(\d+\.)', r'\n\1', instructions)
            instructions = instructions.strip()

            # Metadata
            meal_type = row.get("Meal", "") or row.get("Type", "Lunch/Dinner")
            cuisine = row.get("Cuisine", "Indian")
            image_url = row.get("Image Link") or row.get("image-url") or "https://via.placeholder.com/300?text=Recipe"
            time_val = row.get("TotalTimeInMins") or "30"
            time_match = re.search(r'\d+', str(time_val))
            time_min = time_match.group() if time_match else "30"
            time_str = f"{time_min} min"

            search_text = f"{name} {' '.join(ingredients_list)}".lower()

            batch.append((
                name,
                meal_type,
                cuisine,
                raw_ingreds,
                json.dumps(ingredients_list),
                json.dumps(parsed_ingredients),
                search_text,
                instructions,
                image_url,
                time_str
            ))

            if len(batch) >= batch_size:
                cursor.executemany("""
                    INSERT INTO recipes (
                        name, meal_type, cuisine, ingredients, ingredients_raw, 
                        parsed_ingredients, search_text, instructions, image_url, time
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, batch)
                conn.commit()
                count += len(batch)
                batch = []

        if batch:
            cursor.executemany("""
                INSERT INTO recipes (
                    name, meal_type, cuisine, ingredients, ingredients_raw, 
                    parsed_ingredients, search_text, instructions, image_url, time
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, batch)
            conn.commit()
            count += len(batch)

    conn.close()
    print(f"[INFO] Migration complete. Loaded {count} recipes successfully.")

if __name__ == "__main__":
    migrate()
