def is_valid_token(word: str) -> bool:
    word = word.strip().lower()
    if len(word) < 2:  # Relaxed for testing
        return False
    if not any(v in word for v in "aeiou"):
        return False
    if not re.search(r"[a-z]", word):
        return False
    if re.fullmatch(r"[\W\d_]+", word):
        return False
    return True
import io
import re
from typing import List, Dict

from services.food_index import resolve_food

try:
    from PIL import Image
    import pytesseract
except ImportError:  # pragma: no cover - optional dependency
    Image = None
    pytesseract = None


UNIT_ALIASES = {
    "kg": "kg",
    "kgs": "kg",
    "g": "g",
    "gram": "g",
    "grams": "g",
    "l": "l",
    "lt": "l",
    "ltr": "l",
    "litre": "l",
    "liter": "l",
    "ml": "ml",
    "pc": "pieces",
    "pcs": "pieces",
    "piece": "pieces",
    "pieces": "pieces",
    "unit": "unit",
    "units": "unit",
}


LINE_RE = re.compile(
    r"""
    ^\s*
    (?P<name>[A-Za-z\s]+?)      # item name (letters and spaces)
    [\s\-:]*
    (?P<qtyunit>(\d+(?:\.\d+)?\s*[A-Za-z]+|\d+(?:\.\d+)?))  # quantity+unit or just quantity
    (?:\s*\((?P<range>[^)]*)\))?  # optional range in parentheses
    .*$
    """,
    re.VERBOSE,
)


def _normalize_unit(raw: str | None) -> str:
    if not raw:
        return "unit"
    key = raw.strip().lower()
    return UNIT_ALIASES.get(key, key)



def ocr_image_bytes(data: bytes) -> list:
    """Run OCR on image bytes using Tesseract, return list of (line, min_confidence) tuples."""
    if not Image or not pytesseract:
        # Fallback: assume the file is already text
        try:
            text = data.decode("utf-8", errors="ignore")
            return [(line, 100) for line in text.splitlines() if line.strip()]
        except Exception:
            return []

    image = Image.open(io.BytesIO(data))
    ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    n = len(ocr_data['level'])
    lines = {}
    for i in range(n):
        line_num = ocr_data['line_num'][i]
        word = ocr_data['text'][i].strip()
        conf_val = ocr_data['conf'][i]
        conf = int(conf_val) if str(conf_val).isdigit() else 0
        if not word:
            continue
        if line_num not in lines:
            lines[line_num] = {'words': [], 'confs': []}
        lines[line_num]['words'].append(word)
        lines[line_num]['confs'].append(conf)
    result = []
    for line in lines.values():
        line_text = ' '.join(line['words'])
        min_conf = min(line['confs']) if line['confs'] else 0
        result.append((line_text, min_conf))
    return result


def parse_bill_text(text: str) -> List[Dict]:
    """
    Parse raw OCR text into structured line items.

    Each item:
      {
        "raw_line": "...",
        "raw_name": "...",
        "quantity": float,
        "unit": "...",
      }
    """
    items: List[Dict] = []
    # Patterns to ignore lines with prices, totals, taxes, fees, etc.
    ignore_patterns = [
        r"\btotal\b", r"\bgst\b", r"\bfee\b", r"\bcharge\b", r"\bsummary\b",
        r"\bhandling\b", r"\bsurge\b", r"\bitem total\b", r"\bdelivery\b",
        r"\bamount\b", r"\bpayable\b", r"\bdiscount\b", r"\bmrp\b",
        r"\bprice\b", r"\bvalue\b", r"\btax\b", r"\bsgst\b", r"\bcgst\b",
        r"\bnet\b", r"\bpaid\b", r"\bchange\b", r"\bcredit\b", r"\bdebit\b",
        r"\bpayment\b", r"\bcard\b", r"\bcash\b", r"\bround off\b",
        r"\u20b9", r"\brs\b", r"inr", r"\d+\.\d{2}$"
    ]
    ignore_re = re.compile("|".join(ignore_patterns), re.IGNORECASE)

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        # Ignore lines matching ignore patterns
        if ignore_re.search(line):
            continue
        # Ignore lines that are mostly numbers or only prices
        if re.fullmatch(r"[\d\s\.,\-\u20b9rsinr]+", line, re.IGNORECASE):
            continue

        m = LINE_RE.match(line)
        if not m:
            continue

        name = m.group("name").strip()
        # OCR cleanup: ignore invalid tokens
        if not is_valid_token(name):
            continue
        qtyunit = m.group("qtyunit")
        range_str = m.group("range")

        # Extract quantity and unit from qtyunit (e.g., '2kg', '500g', '1unit')
        qty = 1.0
        unit_raw = None
        if qtyunit:
            match = re.match(r"(\d+(?:\.\d+)?)([A-Za-z]+)?", qtyunit)
            if match:
                qty = float(match.group(1))
                unit_raw = match.group(2)
        # If range is present, try to extract the average or main value
        if range_str:
            # e.g., '900 - 1000 Gm' -> take the first number
            range_match = re.match(r"(\d+(?:\.\d+)?)(?:\s*\-|\sto\s)?(\d+(?:\.\d+)?)?\s*([A-Za-z]+)?", range_str)
            if range_match:
                qty = float(range_match.group(1))
                if range_match.group(3):
                    unit_raw = range_match.group(3)

        # Confidence score calculation
        confidence = 1.0
        # Lower confidence if name is very short or generic
        if len(name) < 3:
            confidence -= 0.3
        # Lower confidence if no unit or quantity is found
        if not unit_raw:
            confidence -= 0.2
        if not qtyunit:
            confidence -= 0.2
        # Lower confidence if line contains suspicious characters
        if re.search(r"[^A-Za-z0-9\s\-()]+", line):
            confidence -= 0.1
        confidence = max(0.0, min(1.0, confidence))

        items.append(
            {
                "raw_line": raw_line,
                "raw_name": name,
                "quantity": qty,
                "unit": _normalize_unit(unit_raw),
                "confidence": confidence,
            }
        )

    return items


def enrich_items_with_food_index(parsed_items: List[Dict]) -> List[Dict]:
    """
    Use the CSV-based food index to resolve aliases and categories.

    Returns list of:
      {
        "raw_line",
        "raw_name",
        "quantity",
        "unit",
        "canonical",
        "category",
        "default_unit",
        "resolved": bool,
      }
    """
    enriched: List[Dict] = []
    for item in parsed_items:
        raw_name = item["raw_name"]
        info = resolve_food(raw_name)
        confidence = item.get("confidence", 1.0)
        if info:
            # Boost confidence if resolved in food index
            confidence = min(1.0, confidence + 0.2)
            enriched.append(
                {
                    **item,
                    "canonical": info["canonical"],
                    "category": info["category"],
                    "default_unit": info["default_unit"],
                    "resolved": True,
                    "confidence": confidence,
                }
            )
        else:
            # Lower confidence if not resolved
            confidence = max(0.0, confidence - 0.2)
            enriched.append(
                {
                    **item,
                    "canonical": raw_name.lower(),
                    "category": "others",
                    "default_unit": item["unit"],
                    "resolved": False,
                    "confidence": confidence,
                }
            )

    return enriched


def parse_bill_bytes(data: bytes) -> List[Dict]:
    """
    Full pipeline:
      bytes -> OCR -> lines -> parsed items -> alias/category resolution.
    """
    ocr_lines = ocr_image_bytes(data)
    # Debug: print raw OCR output and confidence
    print("---- OCR RAW OUTPUT ----")
    for line, conf in ocr_lines:
        print(f"{line!r} (conf: {conf})")
    print("------------------------")

    # Relaxed confidence threshold for testing
    filtered_lines = [(line, conf) for line, conf in ocr_lines if conf >= 40]

    def extract_food_token(line: str) -> str | None:
        tokens = line.split()
        for token in tokens:
            if is_valid_token(token):
                return token
        return None

    # Line-based parsing: extract first valid food token per line
    items = []
    for line, conf in filtered_lines:
        food_candidate = extract_food_token(line)
        if not food_candidate:
            continue
        # Try to resolve alias/food
        info = resolve_food(food_candidate)
        if info:
            items.append({
                "raw_line": line,
                "raw_name": food_candidate,
                "quantity": 1.0,
                "unit": "unit",
                "canonical": info["canonical"],
                "category": info["category"],
                "default_unit": info["default_unit"],
                "resolved": True,
                "confidence": conf / 100.0,
            })
        else:
            items.append({
                "raw_line": line,
                "raw_name": food_candidate,
                "quantity": 1.0,
                "unit": "unit",
                "canonical": food_candidate.lower(),
                "category": "others",
                "default_unit": "unit",
                "resolved": False,
                "confidence": conf / 100.0,
            })

    return items


