import math
from db.firestore import db

# Define ingredient keywords for category-based scaling
SPICES = {
    "salt", "pepper", "black pepper", "turmeric", "haldi", "chilli", "mirchi",
    "chili powder", "chilli powder", "cumin", "jeera", "mustard", "rai",
    "garam masala", "hing", "asafoetida", "ginger", "garlic", "coriander powder",
    "dhania", "clove", "cinnamon", "cardamom", "spices", "seasoning", "oregano",
    "basil", "thyme", "rosemary", "parsley", "paprika", "nutmeg", "vanilla",
    "fennel", "saffron"
}

STAPLES = {
    "oil", "ghee", "butter", "water", "vegetable oil", "mustard oil", "olive oil",
    "rice", "flour", "sugar", "atta", "maida", "suji", "semolina", "pasta",
    "milk", "curd", "yogurt", "cream", "coconut milk", "broth", "stock"
}

def get_ingredient_category(ingredient_name: str) -> str:
    """
    Categorize ingredient into Core, Spice, or Staple.
    """
    name_lower = ingredient_name.lower().strip()
    
    if any(spice in name_lower for spice in SPICES):
        return "Spice"
    if any(staple in name_lower for staple in STAPLES):
        return "Staple"
        
    return "Core"

def get_base_scaling_factor(ingredient_name: str, servings: float) -> float:
    """
    Apply category-specific base scaling:
    - Core ingredients scale linearly: Factor = servings / 2.0
    - Spices/seasonings scale sub-linearly: Factor = (servings / 2.0) ^ 0.65
    - Staples/fats/liquids scale sub-linearly: Factor = (servings / 2.0) ^ 0.75
    """
    base_ratio = servings / 2.0
    if base_ratio <= 0:
        return 0.0

    category = get_ingredient_category(ingredient_name)
    
    if category == "Spice":
        return math.pow(base_ratio, 0.65)
    elif category == "Staple":
        return math.pow(base_ratio, 0.75)
    
    # Core scales linearly
    return base_ratio

def fit_regression(points: list) -> tuple:
    """
    Fits a power law model: ratio = a * (servings / 2.0) ^ p
    using OLS linear regression in log-log space:
      ln(ratio) = ln(a) + p * ln(servings / 2.0)
      Let Y = ln(ratio), X = ln(servings / 2.0)
      Fits Y = intercept + p * X
    Returns (a, p) if successfully fitted, otherwise (None, None).
    """
    # Filter points where servings/2.0 > 0 and ratio > 0 to compute logs
    valid_points = []
    for servings, ratio in points:
        x = servings / 2.0
        y = ratio
        if x > 0 and y > 0:
            try:
                valid_points.append((math.log(x), math.log(y)))
            except ValueError:
                pass
                
    n = len(valid_points)
    # We need at least 2 distinct X points to fit a linear regression slope
    if n < 2:
        return None, None
        
    sum_x = sum(pt[0] for pt in valid_points)
    sum_y = sum(pt[1] for pt in valid_points)
    sum_xx = sum(pt[0]**2 for pt in valid_points)
    sum_xy = sum(pt[0]*pt[1] for pt in valid_points)
    
    denominator = n * sum_xx - sum_x**2
    if abs(denominator) < 1e-9:
        # Avoid division by zero when all X values are identical
        return None, None
        
    p = (n * sum_xy - sum_x * sum_y) / denominator
    intercept = (sum_y - p * sum_x) / n
    try:
        a = math.exp(intercept)
        return a, p
    except OverflowError:
        return None, None

def get_adaptive_scaling_factor(user_id: str, ingredient_name: str, servings: float) -> float:
    """
    Calculate the scaling factor using smart defaults and personalized user feedback.
    1. Check for ingredient-specific regression fit
    2. Check for category-specific regression fit
    3. Calculate category-level average adjustment ratios
    4. Fall back to smart default sub-linear scaling
    """
    category = get_ingredient_category(ingredient_name)
    base_factor = get_base_scaling_factor(ingredient_name, servings)
    
    try:
        # Stream the user's scaling feedback records from Firestore
        feedback_ref = (
            db.collection("users")
            .document(user_id)
            .collection("scaling_feedback")
        )
        docs = feedback_ref.stream()
        
        all_points_by_category = []
        ing_points = []
        
        ing_name_lower = ingredient_name.lower().strip()
        
        for doc in docs:
            doc_id = doc.id.lower().strip()
            doc_data = doc.to_dict() or {}
            history = doc_data.get("history", [])
            
            doc_category = get_ingredient_category(doc_id)
            
            for pt in history:
                pt_servings = pt.get("servings", 2.0)
                pt_ratio = pt.get("ratio", 1.0)
                if pt_servings > 0 and pt_ratio > 0:
                    point = (pt_servings, pt_ratio)
                    if doc_category == category:
                        all_points_by_category.append(point)
                    if doc_id == ing_name_lower:
                        ing_points.append(point)
        
        # Step 1: Specific ingredient-level power-law regression model
        a_ing, p_ing = fit_regression(ing_points)
        if a_ing is not None and p_ing is not None:
            base_ratio = servings / 2.0
            if base_ratio > 0:
                # Blend user personalized regression (70%) with base factor (30%)
                personalized_factor = a_ing * math.pow(base_ratio, p_ing)
                return (personalized_factor * 0.7) + (base_factor * 0.3)
                
        # Step 2: Category-level power-law regression model
        a_cat, p_cat = fit_regression(all_points_by_category)
        if a_cat is not None and p_cat is not None:
            base_ratio = servings / 2.0
            if base_ratio > 0:
                personalized_factor = a_cat * math.pow(base_ratio, p_cat)
                return (personalized_factor * 0.7) + (base_factor * 0.3)
                
        # Step 3: Average adjustment ratio over the category
        if all_points_by_category:
            adjustments = []
            for pt_servings, pt_ratio in all_points_by_category:
                pt_base_factor = get_base_scaling_factor(ingredient_name, pt_servings)
                if pt_base_factor > 0:
                    adjustments.append(pt_ratio / pt_base_factor)
            if adjustments:
                avg_cat_adj = sum(adjustments) / len(adjustments)
                # Blend average adjustment (70%) with math default (30%)
                blended_adj = (avg_cat_adj * 0.7) + (1.0 * 0.3)
                return base_factor * blended_adj
                
    except Exception as e:
        print(f"[Adaptive Scaler] Error calculating adaptive scaling factor: {e}")
        
    return base_factor

def save_scaling_feedback(user_id: str, ingredient_name: str, servings: float, base_qty: float, actual_qty: float):
    """
    Persist user adjustments (feedback loop) to train their personalized scaling factors.
    """
    if base_qty <= 0 or actual_qty <= 0:
        return
        
    ratio = actual_qty / base_qty
    try:
        doc_ref = (
            db.collection("users")
            .document(user_id)
            .collection("scaling_feedback")
            .document(ingredient_name.lower().strip())
        )
        doc = doc_ref.get()
        
        history_point = {
            "servings": servings,
            "ratio": ratio,
            "actual_qty": actual_qty,
            "base_qty": base_qty
        }
        
        if doc.exists:
            current_data = doc.to_dict() or {}
            history = current_data.get("history", [])
            # Keep history to last 15 points to build a decent dataset for regression
            history.append(history_point)
            if len(history) > 15:
                history = history[-15:]
            doc_ref.update({"history": history})
        else:
            doc_ref.set({"history": [history_point]})
            
    except Exception as e:
        print(f"[Adaptive Scaler] Error saving scaling feedback: {e}")
