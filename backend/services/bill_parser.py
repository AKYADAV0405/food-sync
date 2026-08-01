import re
import io
from rapidfuzz import process, fuzz
try:
    import pytesseract
except Exception as _e:
    pytesseract = None
from PIL import Image


# Try to import resolve_food to enrich data for main.py
try:
    from services.food_index import resolve_food, get_all_canonical_names, get_all_matchable_names
except ImportError:
    # Fallback or circular import handling
    def resolve_food(name): return None
    def get_all_canonical_names(): return []
    def get_all_matchable_names(): return []

# --- CONFIGURATION ---

# Ingestion-Layer PII Redaction Patterns
PII_PATTERNS = [
    r"\b(?:\d[ -]*?){13,16}\b",                                   # Credit/Debit Card Numbers
    r"\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b",  # Phone Numbers
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",     # Email Addresses
    r"(?i)\b(?:visa|mastercard|amex|card\s*#|auth|terminal|approval|trace)\b.*" # Card Slips
]

def redact_pii_from_ocr_text(text: str) -> str:
    """
    Ingestion-Layer PII Redaction: Automatically strips sensitive financial and personal data
    (card numbers, phone numbers, emails, transaction auth tags) before LLM or DB storage.
    """
    if not text: return ""
    cleaned = text
    for pattern in PII_PATTERNS:
        cleaned = re.sub(pattern, "[PII_REDACTED]", cleaned)
    return cleaned

# Aggressive Noise Patterns based on logs
NOISE_PATTERNS = [
    r"^\W+$", r"^\d+$", r"^\d+\.\d+$", 
    r"(?i)total", r"(?i)subtotal", r"(?i)gst", r"(?i)date", 
    r"(?i)cash", r"(?i)change", r"(?i)amount", r"(?i)qty", r"(?i)rate", 
    r"(?i)mrp", r"(?i)discount", r"(?i)tax", r"(?i)invoice", r"(?i)bill", 
    r"(?i)tel", r"(?i)ph", r"(?i)thank", r"(?i)visit", r"(?i)save", 
    r"(?i)net", r"(?i)gross", r"(?i)order", r"(?i)delivered", r"(?i)fee", 
    r"(?i)charge", r"(?i)help", r"(?i)items", r"(?i)unit", r"(?i)pack",
    r"^[0-9\W]+$", r"^[\W_]+$"
]

# --- CORE PARSING LOGIC ---

def extract_qty_unit(text: str) -> tuple[float, str]:
    """Extract quantity and unit from text (e.g., 'Tomato 500g' -> 500.0, 'g')."""
    # Expanded regex to handle more unit variations and spacing
    match = re.search(r"(\d+(\.\d+)?)\s*(kg|kgs|g|gm|gms|l|ltr|ml|pc|pcs|pieces|pkt|packet)\b", text, re.IGNORECASE)
    if match:
        try:
            qty = float(match.group(1))
            unit = match.group(3).lower()
            
            # Normalize units
            if unit in ['gm', 'gms']: unit = 'g'
            if unit in ['kgs']: unit = 'kg'
            if unit in ['ltr']: unit = 'l'
            if unit in ['pcs', 'pc', 'pkt', 'packet', 'pieces']: unit = 'pieces'
            
            return qty, unit
        except ValueError:
            pass
    return 1.0, "pieces"

def parse_ocr_line(text: str) -> dict | None:
    """Parses a single line: cleans PII, cleans noise, extracts quantity, isolates food name."""
    if not text: return None
    text = redact_pii_from_ocr_text(text.strip())
    if len(text) < 3 or "[PII_REDACTED]" in text: return None

    for pattern in NOISE_PATTERNS:
        if re.search(pattern, text): return None

    # 1. Remove Price (numbers at end of line)
    text_no_price = re.sub(r"\s+\d+(\.\d+)?$", "", text)
    
    # 2. Extract Quantity/Unit
    qty, unit = extract_qty_unit(text_no_price)
    
    # 3. Isolate Name
    # Remove the qty+unit pattern if it exists (e.g. "500g")
    text_name_only = re.sub(r"\s+\d+(\.\d+)?\s*(kg|kgs|g|gm|gms|l|ltr|ml|pc|pcs|pieces|pkt|packet)\.?", "", text_no_price, flags=re.IGNORECASE)
    
    # CRITICAL FIX: Also remove unit suffixes attached to words (e.g. "cabbagepcs")
    text_name_only = re.sub(r"(kg|kgs|g|gm|gms|l|ltr|ml|pc|pcs|pieces|pkt|packet)$", "", text_name_only, flags=re.IGNORECASE)

    # 4. Remove leading numbers/symbols (e.g. "1. Tomato")
    cleaned_name = re.sub(r"^[\d\.\-\s]+", "", text_name_only).strip()
    
    # Filter out garbage like "» pe » Tunit"
    if len(cleaned_name) < 3 or re.search(r"[»«@#$]", cleaned_name):
        return None

    return {"cleaned_name": cleaned_name, "qty": qty, "unit": unit}

def process_bill_text(raw_lines: list[str], food_master_list: list[str]) -> list[dict]:
    """
    Main Logic: Parses lines and Fuzzy Matches against master list.
    """
    detected_items = []
    
    # Ensure we have a master list if none provided
    if not food_master_list:
        try:
            food_master_list = get_all_matchable_names()
        except:
            food_master_list = []

    print(f"[DEBUG] Processing {len(raw_lines)} lines against {len(food_master_list)} master items.")

    for line in raw_lines:
        parsed = parse_ocr_line(line)
        if not parsed: 
            continue
            
        name_candidate = parsed["cleaned_name"]
        
        # 1. Try RESOLVE_FOOD first (Exact/Substring match)
        # This fixes "Carrot Ooty" -> "Carrot" deterministically
        info = resolve_food(name_candidate)
        
        if info:
            print(f"[DEBUG] Direct/Substring Match: '{name_candidate}' -> '{info['canonical']}'")
            detected_items.append({
                "original_text": line,
                "cleaned_text": name_candidate,
                "matched_item": info['canonical'],
                "confidence": 100.0,
                "quantity": parsed["qty"],
                "unit": parsed["unit"],
                "resolved": True,
                "canonical": info['canonical'],
                "category": info['category'],
                "raw": line, "match": info['canonical'], "score": 100.0, "name": info['canonical']
            })
            continue

        # 2. Fuzzy match (Fallback for typos like "Tmto")
        match = process.extractOne(name_candidate, food_master_list, scorer=fuzz.token_set_ratio)
        
        if match:
            matched_string, score, index = match
            
        
            if score >= 55:
                # Guard: Dates (Fruit) vs Metadata
                if matched_string.lower() == "dates" and re.search(r"\d", name_candidate): 
                    continue

                info = resolve_food(matched_string)
                category = info['category'] if info else 'others'
                canonical = info['canonical'] if info else matched_string
                
                print(f"[DEBUG] Fuzzy Match: '{name_candidate}' -> '{canonical}' (Score: {score})")

                detected_items.append({
                    "original_text": line,
                    "cleaned_text": name_candidate,
                    "matched_item": matched_string,
                    "confidence": round(score, 2),
                    "quantity": parsed["qty"],
                    "unit": parsed["unit"],
                    "resolved": True,
                    "canonical": canonical,
                    "category": category,
                    "raw": line, "match": matched_string, "score": round(score, 2), "name": canonical 
                })
            else:
                print(f"[DEBUG] Rejected low score: '{name_candidate}' -> '{matched_string}' (Score: {score})")
                
    return detected_items

# --- MAIN API ENTRY POINTS ---

def parse_bill_bytes(file_bytes: bytes) -> list[dict]:
    """API Entry Point."""
    image = Image.open(io.BytesIO(file_bytes))
    raw_text = pytesseract.image_to_string(image)
    return process_bill_text(raw_text.split('\n'), [])

# --- HELPER FUNCTIONS ---

def preprocess_image(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data))

def is_valid_token(word: str) -> bool:
    word = word.strip().lower()
    if len(word) < 2: return False
    return bool(re.search(r"[a-z]", word))

def ocr_image_bytes(data: bytes) -> list[tuple[str, int]]:
    image = Image.open(io.BytesIO(data))
    ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    lines = {}
    n = len(ocr_data['text'])
    for i in range(n):
        conf = int(ocr_data['conf'][i])
        if conf < 0: continue
        text = ocr_data['text'][i].strip()
        if not text: continue
        line_num = ocr_data['line_num'][i]
        if line_num not in lines:
            lines[line_num] = {'words': [], 'confs': []}
        lines[line_num]['words'].append(text)
        lines[line_num]['confs'].append(conf)
    result = []
    for ln in sorted(lines.keys()):
        line_str = " ".join(lines[ln]['words'])
        if not line_str: continue
        avg_conf = sum(lines[ln]['confs']) / len(lines[ln]['confs'])
        result.append((line_str, int(avg_conf)))
    return result

# --- LEGACY WRAPPERS ---

def ocr_words(image: Image.Image) -> list[str]:
    raw_text = pytesseract.image_to_string(image)
    return raw_text.split('\n')

def fuzzy_match_ocr_words(raw_lines: list[str], food_master_list: list[str] = None) -> list[dict]:
    # Ignore passed list, use robust internal list
    return process_bill_text(raw_lines, [])