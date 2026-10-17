from typing import List, Dict, Any
from db.inventory import get_inventory
from services.recipe_engine import suggest_recipes_for_item

def get_spoilage_alerts(user_id: str) -> Dict[str, Any]:
    """
    Scans user inventory and generates prioritized spoilage alerts:
    - CRITICAL_2_DAY: items with days_left <= 2 (Urgent 48-hour spoilage alert!)
    - WARNING_5_DAY: items with 2 < days_left <= 5
    Attaches top recipe suggestion and action routes:
      cook_url: "/meal-planning"
      donate_url: "/donations"
    """
    inventory = get_inventory(user_id)
    critical_alerts = []
    warning_alerts = []

    for item in inventory:
        item_name = item.get("item", "Item")
        qty = item.get("quantity", 1.0)
        unit = item.get("unit", "pieces")
        days_left = int(item.get("days_left", 7))
        category = item.get("category", "others")

        # Get top recipe suggestion
        suggestions = suggest_recipes_for_item(item_name)
        top_recipe = None
        if suggestions and len(suggestions) > 0:
            top_recipe = {
                "name": suggestions[0].get("name") or suggestions[0].get("title"),
                "time": suggestions[0].get("time", "25 mins"),
                "cuisine": suggestions[0].get("cuisine", "Home-style")
            }

        alert_payload = {
            "item": item_name.title(),
            "quantity": qty,
            "unit": unit,
            "days_left": days_left,
            "category": category,
            "top_recipe_suggestion": top_recipe,
            "cook_url": "/meal-planning",
            "donate_url": "/donations"
        }

        if days_left <= 2:
            alert_payload["urgency"] = "CRITICAL_2_DAY"
            alert_payload["message"] = f"Urgent 48-Hour Alert: {qty} {unit} of {item_name.title()} expires in {days_left} day{'s' if days_left != 1 else ''}!"
            critical_alerts.append(alert_payload)
        elif days_left <= 5:
            alert_payload["urgency"] = "WARNING_5_DAY"
            alert_payload["message"] = f"Upcoming: {item_name.title()} should be consumed within {days_left} days."
            warning_alerts.append(alert_payload)

    critical_alerts.sort(key=lambda x: x["days_left"])
    warning_alerts.sort(key=lambda x: x["days_left"])

    total_unread = len(critical_alerts) + len(warning_alerts)

    return {
        "status": "success",
        "unread_count": total_unread,
        "critical_count": len(critical_alerts),
        "critical_alerts": critical_alerts,
        "warning_alerts": warning_alerts,
        "all_alerts": critical_alerts + warning_alerts
    }
