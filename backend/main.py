
# -------- IMPORTS (move all to top) -------- #
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from db.inventory import (
    get_inventory,
    add_inventory_item,
    remove_inventory_item
)
from services.food_index import load_food_index, suggest_items
from services.bill_parser import parse_bill_bytes

# -------- END IMPORTS -------- #


# -------- Shopping List Confirmation -------- #

# ...existing code...

# Place this after app = FastAPI()
app = FastAPI()

class ConfirmedShoppingItem(BaseModel):
    raw_name: str
    confirmed: str
    quantity: int = 1
    unit: str = "unit"
    category: str | None = None

@app.post("/shopping-list/confirm")
def confirm_shopping_list(items: list[ConfirmedShoppingItem]):
    """
    Accepts a list of confirmed shopping list items from the user and adds them to inventory.
    Also stores user-specific alias if raw_name != confirmed.
    """
    # Optionally: import/store alias logic here
    added = []
    for item in items:
        # Store alias if user corrected the name
        if item.raw_name.strip().lower() != item.confirmed.strip().lower():
            # TODO: Store alias for this user (Phase 2D)
            pass
        add_inventory_item(
            user_id=USER_ID,
            item=item.confirmed,
            quantity=item.quantity,
            unit=item.unit,
            category=item.category,
        )
        added.append(item.confirmed)
    return {"added": added}

# -------- IMPORTS (move all to top) -------- #
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from db.inventory import (
    get_inventory,
    add_inventory_item,
    remove_inventory_item
)
from services.food_index import load_food_index, suggest_items
from services.bill_parser import parse_bill_bytes

# -------- END IMPORTS -------- #

app = FastAPI()

# -------- Shopping List Upload / OCR -------- #

class ShoppingListItem(BaseModel):
    raw_name: str
    suggestions: List[str]
    confirmed: str | None = None

@app.post("/shopping-list/upload")
async def upload_shopping_list(file: UploadFile = File(...)):
    """
    Accept a shopping list image (handwritten or typed), run OCR, extract item names,
    and suggest possible matches for each item. Returns suggestions for user confirmation.
    """
    from services.bill_parser import ocr_image_bytes, is_valid_token
    data = await file.read()
    ocr_lines = ocr_image_bytes(data)
    # Only keep lines with min confidence >= 60
    filtered = [(line, conf) for line, conf in ocr_lines if conf >= 60]
    # Remove lines that look like prices or totals
    ignore_patterns = [
        r"\btotal\b", r"\bgst\b", r"\bfee\b", r"\bcharge\b", r"\bsummary\b",
        r"\bhandling\b", r"\bsurge\b", r"\bitem total\b", r"\bdelivery\b",
        r"\bamount\b", r"\bpayable\b", r"\bdiscount\b", r"\bmrp\b",
        r"\bprice\b", r"\bvalue\b", r"\btax\b", r"\bsgst\b", r"\bcgst\b",
        r"\bnet\b", r"\bpaid\b", r"\bchange\b", r"\bcredit\b", r"\bdebit\b",
        r"\bpayment\b", r"\bcard\b", r"\bcash\b", r"\bround off\b",
        r"\u20b9", r"\brs\b", r"inr", r"\d+\.\d{2}$"
    ]
    import re
    ignore_re = re.compile("|".join(ignore_patterns), re.IGNORECASE)
    # OCR cleanup: ignore invalid tokens
    filtered = [(l, conf) for l, conf in filtered if not ignore_re.search(l) and is_valid_token(l)]
    # Suggest items for each line
    suggestions = []
    for raw, conf in filtered:
        sugg = suggest_items(USER_ID, raw)
        suggestions.append({
            "raw_name": raw,
            "confidence": conf,
            "suggestions": sugg,
            "confirmed": None
        })
    return {"items": suggestions}

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# TEMP user (we will replace later with auth)
USER_ID = "abhishek"

# Load food index on startup
load_food_index()

@app.get("/")
def root():
    return {"status": "Food Sync backend running"}


# -------- INVENTORY APIs -------- #

@app.get("/inventory")
def inventory():
    return get_inventory(USER_ID)


class InventoryItem(BaseModel):
    item: str
    quantity: int
    unit: str
    category: str | None = None


@app.post("/inventory/add")
def add_inventory(data: InventoryItem):
    return add_inventory_item(
        user_id=USER_ID,
        item=data.item,
        quantity=data.quantity,
        unit=data.unit,
        category=data.category,
    )


@app.post("/inventory/remove")
def remove_inventory(data: InventoryItem):
    return remove_inventory_item(
        user_id=USER_ID,
        item=data.item,
        quantity=data.quantity
    )


# -------- Suggestions API -------- #

@app.get("/suggest")
def get_suggestions(q: str):
    return suggest_items(USER_ID, q)


# -------- Bill Upload / OCR -------- #


@app.post("/bill/upload")
async def upload_bill(file: UploadFile = File(...)):
    """
    Accept a bill image, run OCR + parsing + alias/category resolution,
    and add resolved items into the user's inventory.

    Returns the parsed items (including unresolved ones) so the UI
    can show a "Detected items" list.
    """
    data = await file.read()
    items = parse_bill_bytes(data)

    added = []
    for it in items:
        if not it["resolved"]:
            continue
        add_inventory_item(
            user_id=USER_ID,
            item=it["canonical"],
            quantity=int(it["quantity"]),
            unit=it["unit"],
            category=it["category"],
        )
        added.append(it)

    return {"detected": items, "added": added}
