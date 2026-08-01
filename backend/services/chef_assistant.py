import os
import json
from openai import OpenAI
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Explicitly load env variables from backend directory
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dotenv_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path=dotenv_path)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

class RecipeActionPayload(BaseModel):
    recipe_name: str = Field(description="Name of suggested dish.")
    ingredients: list[str] = Field(description="List of ingredients with quantities.")
    instructions: list[str] = Field(description="Step by step cooking instructions.")
    calories: str | None = Field(default="350 kcal", description="Estimated calories.")

class SinglePassChatResponse(BaseModel):
    intent: str = Field(description="Must be one of: 'CHAT', 'CREATE_RECIPE', 'NAVIGATION', 'REJECT_RECIPE'.")
    response_text: str = Field(description="Dynamic, conversational response to the user's prompt.")
    recipe_action: RecipeActionPayload | None = Field(default=None, description="Populated ONLY if intent is 'CREATE_RECIPE'.")

KNOWN_HERO_FOODS = {
    "garlic butter chicken": {
        "name": "Garlic Butter Chicken Stir-Fry",
        "calories": "380 kcal",
        "ingredients": ["250g Chicken breast, sliced", "2 tbsp Butter", "4 cloves Garlic, minced", "1 cup Broccoli florets", "1 tbsp Soy sauce"],
        "instructions": [
            "Melt butter in a skillet over medium-high heat and sauté minced garlic for 30 seconds.",
            "Add sliced chicken breast and sear until golden brown on all sides (6-8 minutes).",
            "Toss in broccoli florets, soy sauce, and black pepper, stirring for 3-4 minutes until chicken reaches 165°F.",
            "Remove from heat, plate warm, and enjoy!"
        ]
    },
    "chicken": {
        "name": "Garlic Butter Chicken Stir-Fry",
        "calories": "380 kcal",
        "ingredients": ["250g Chicken breast, sliced", "2 tbsp Butter", "4 cloves Garlic, minced", "1 cup Broccoli florets"],
        "instructions": [
            "Melt butter in a skillet over medium-high heat and sauté minced garlic for 30 seconds.",
            "Add sliced chicken breast and sear until golden brown on all sides (6-8 minutes).",
            "Toss in broccoli florets and cook for 3 minutes.",
            "Plate warm and enjoy!"
        ]
    },
    "paneer": {
        "name": "Quick Kadai Paneer",
        "calories": "410 kcal",
        "ingredients": ["200g Paneer, cubed", "1 Bell pepper, cubed", "1 Onion, chopped", "2 Tomatoes, pureed"],
        "instructions": [
            "Sauté onions and bell pepper in hot oil for 3 minutes.",
            "Add tomato puree and Kadai spices, simmering until oil separates.",
            "Fold in paneer cubes and simmer for 4 minutes."
        ]
    },
    "egg": {
        "name": "Spicy Indian Egg Bhurji",
        "calories": "260 kcal",
        "ingredients": ["3 Eggs, beaten", "1 Onion, chopped", "1 Tomato, chopped", "1 Green chili"],
        "instructions": [
            "Sauté onions and green chili in butter until translucent.",
            "Add tomatoes and spices, cooking until soft.",
            "Pour in beaten eggs and scramble gently on low heat."
        ]
    },
    "eggs": {
        "name": "Spicy Indian Egg Bhurji",
        "calories": "260 kcal",
        "ingredients": ["3 Eggs, beaten", "1 Onion, chopped", "1 Tomato, chopped", "1 Green chili"],
        "instructions": [
            "Sauté onions and green chili in butter until translucent.",
            "Add tomatoes and spices, cooking until soft.",
            "Pour in beaten eggs and scramble gently on low heat."
        ]
    },
    "pasta": {
        "name": "Garlic & Herb Pantry Pasta",
        "calories": "340 kcal",
        "ingredients": ["200g Pasta", "2 tbsp Olive oil", "4 cloves Garlic", "1/2 tsp Red pepper flakes"],
        "instructions": [
            "Boil pasta until al dente.",
            "Sauté garlic and red pepper flakes in olive oil.",
            "Toss pasta with garlic oil and fresh herbs."
        ]
    }
}

def chat_with_chef(
    message: str,
    history: list,
    inventory: list,
    companion_name: str = "Jarvis",
    user_name: str = "friend",
    language: str = "en-US",
    active_recipe_title: str = None,
    active_recipe_ingredients: list = None,
    active_recipe_steps: list = None,
    current_step_number: int = None,
    current_step_description: str = None
) -> dict:
    """
    RAG Chat Assistant with Active Recipe Context & Full Step Walkthrough Overviews:
    Supports requests for 'tell me all the steps at once' without losing active recipe state.
    """
    clean_msg = message.strip().lower()

    # 1. Full Step Walkthrough Request (e.g., "tell me all the steps at once", "read all steps", "show all steps")
    is_all_steps_request = any(phrase in clean_msg for phrase in [
        "all the steps", "all steps", "read all steps", "show all steps", "list all steps", "entire recipe", "complete recipe"
    ])

    if is_all_steps_request and active_recipe_steps and len(active_recipe_steps) > 0:
        formatted_steps = "\n".join([f"Step {i+1}: {s}" for i, s in enumerate(active_recipe_steps)])
        overview_text = (
            f"Here are all the steps for '{active_recipe_title or 'your dish'}' at once:\n\n"
            f"{formatted_steps}\n\n"
            f"Let me know when you're ready for the next step!"
        )
        return {
            "response": overview_text,
            "response_text": overview_text,
            "intent": "CHAT",
            "recipe_action": None
        }

    # 2. Dish Selection / Confirmation Phrases
    is_confirmation = any(phrase in clean_msg for phrase in [
        "lets make", "let's make", "how to make", "tell me how", "show me the steps", "show steps",
        "yes lets do it", "let's do it", "make it", "cook it", "recipe for", "want to make"
    ])

    # Build active recipe context string
    active_recipe_str = ""
    if active_recipe_title or active_recipe_steps:
        steps_list_str = "\n".join([f"Step {i+1}: {s}" for i, s in enumerate(active_recipe_steps or [])])
        active_recipe_str = f"""
ACTIVE COOKING RECIPE CONTEXT:
Recipe Title: '{active_recipe_title}'
Ingredients: {', '.join(active_recipe_ingredients or [])}
Complete Walkthrough Steps:
{steps_list_str}
Current Progress: Step {current_step_number or 1} ({current_step_description or 'In progress'})
"""

    # Format pantry inventory context
    if inventory:
        inventory_items = [f"- {i.get('item','Item')}: {i.get('quantity',0)} {i.get('unit','')}" for i in inventory]
        inventory_str = "\n".join(inventory_items)
    else:
        inventory_str = "No items currently in pantry/inventory."

    rag_str = ""


    system_instruction = f"""Role & Persona:
You are '{companion_name}', a warm, friendly, AI kitchen companion for Food Sync.
User Name: {user_name}
{active_recipe_str}
CRITICAL ACTIVE RECIPE & STEP OVERVIEW RULES:
1. The user is currently cooking '{active_recipe_title or 'a recipe'}'. Here are all the steps: [{', '.join(active_recipe_steps or [])}].
2. If the user asks "tell me all the steps at once", "read all steps", or asks about steps/ingredients for this active recipe, answer directly using the active recipe data above in a clean numbered list (Step 1, Step 2, Step 3...). Set intent = 'CHAT'.
3. Classify the user's message into ONE intent:
   - 'CHAT': General chat, questions about active recipe, or asking for all steps.
   - 'REJECT_RECIPE': User wants a different dish/idea.
   - 'NAVIGATION': Stepping through active recipe ('next', 'back', 'step', 'repeat').
   - 'CREATE_RECIPE': Explicitly requesting a NEW dish or naming new food ingredients.

Return JSON object format:
{{
  "intent": "CHAT | CREATE_RECIPE | NAVIGATION | REJECT_RECIPE",
  "response_text": "Dynamic answer...",
  "recipe_action": null
}}

Pantry Inventory:
{inventory_str}{rag_str}
"""

    if language and language.startswith("hi"):
        system_instruction += "\nIMPORTANT: Write `response_text` in Hindi script (Devanagari) in a warm, friendly companion tone."

    recent_history = history[-6:] if history else []
    openai_messages = [{"role": "system", "content": system_instruction}]

    for msg in recent_history:
        role = msg.role if hasattr(msg, "role") else msg.get("role", "user")
        content = msg.content if hasattr(msg, "content") else msg.get("content", "")
        openai_messages.append({"role": "user" if role == "user" else "assistant", "content": content})

    openai_messages.append({"role": "user", "content": message})

    # 1. Single-Pass Local Ollama Client (llama3.2 / qwen2-vl)
    try:
        client = OpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama", timeout=1.5)

        response = client.chat.completions.create(
            model=OLLAMA_MODEL,
            messages=openai_messages,
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)
        intent = data.get("intent", "CHAT")
        resp_text = data.get("response_text", "")
        recipe_act = data.get("recipe_action")

        if is_confirmation and not recipe_act:
            intent = "CREATE_RECIPE"
            recipe_act = KNOWN_HERO_FOODS["garlic butter chicken"]

        return {
            "response": resp_text or f"Let's make {recipe_act['recipe_name'] if recipe_act else 'something delicious'}!",
            "response_text": resp_text,
            "intent": intent,
            "recipe_action": recipe_act,
            "recipe": recipe_act
        }
    except Exception as ollama_err:
        print(f"[OLLAMA NOTICE] Ollama unavailable ({ollama_err}). Trying Gemini 2.5 Flash API fallback...")

    # 2. Single-Pass Gemini 2.5 Flash API Fallback
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key and api_key != "YOUR_GEMINI_API_KEY_HERE":
        try:
            g_client = genai.Client(api_key=api_key)
            gemini_history = []
            for msg in recent_history:
                role = msg.role if hasattr(msg, "role") else msg.get("role", "user")
                content = msg.content if hasattr(msg, "content") else msg.get("content", "")
                gemini_history.append(types.Content(role="user" if role == "user" else "model", parts=[types.Part.from_text(text=content)]))

            gemini_history.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))

            g_response = g_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=gemini_history,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=SinglePassChatResponse
                )
            )
            data = json.loads(g_response.text)
            intent = data.get("intent", "CHAT")
            resp_text = data.get("response_text", "")
            recipe_act = data.get("recipe_action")

            if is_confirmation and not recipe_act:
                intent = "CREATE_RECIPE"
                recipe_act = KNOWN_HERO_FOODS["garlic butter chicken"]

            return {
                "response": resp_text or f"Let me show you how to make {recipe_act['recipe_name'] if recipe_act else 'your dish'}!",
                "response_text": resp_text,
                "intent": intent,
                "recipe_action": recipe_act,
                "recipe": recipe_act
            }
        except Exception as gemini_err:
            print(f"[GEMINI NOTICE] Gemini API fallback error: {gemini_err}")

    # 3. Deterministic Intent & Recipe Action Fallback
    if is_confirmation or any(k in clean_msg for k in ["chicken", "paneer", "egg", "eggs", "pasta"]):
        target_key = "garlic butter chicken"
        for k in KNOWN_HERO_FOODS:
            if k in clean_msg:
                target_key = k
                break
        matched_recipe = KNOWN_HERO_FOODS[target_key]
        greeting = f"Awesome {user_name}! Let's make {matched_recipe['name']}. Step 1: {matched_recipe['instructions'][0]}"
        return {
            "response": greeting,
            "response_text": greeting,
            "intent": "CREATE_RECIPE",
            "recipe_action": matched_recipe,
            "recipe": matched_recipe
        }

    if any(phrase in clean_msg for phrase in ["something else", "different", "not this", "change"]):
        return {
            "response": f"No problem, {user_name}! What main ingredient or type of cuisine would you prefer instead?",
            "intent": "REJECT_RECIPE",
            "recipe_action": None
        }

    return {
        "response": f"I'm right here with you, {user_name}! Tell me what ingredient or dish you're craving today.",
        "intent": "CHAT",
        "recipe_action": None
    }
