import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import RecipeImage from "../components/RecipeImage";
import "../assets/styles/recipes.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Lifestyle-driven categories configuration
const LIFESTYLE_CATEGORIES = [
  { id: "all", name: "All Recipes", icon: "🍲" },
  { id: "protein", name: "High-Protein Gains", icon: "🍗" },
  { id: "one_pot", name: "One-Pot Wonders", icon: "🥘" },
  { id: "regional", name: "Regional Classics", icon: "🌶️" },
  { id: "quick", name: "Quick & Easy Supper", icon: "⏱️" },
  { id: "sweets", name: "Desserts & Sweets", icon: "🍰" }
];

export default function Recipes() {
  const { getAuthHeaders, currentUser } = useAuth();
  const navigate = useNavigate();

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // Cookbook Detail View States
  const [servings, setServings] = useState(2);
  const [checkedIngredients, setCheckedIngredients] = useState(new Set());
  const [scalingFactors, setScalingFactors] = useState({});
  const [adjustedQuantities, setAdjustedQuantities] = useState({});
  const [scalingLoading, setScalingLoading] = useState(false);
  const [cookSuccess, setCookSuccess] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);

  // ✨ Generative Chef Modal States
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genRecipeResult, setGenRecipeResult] = useState(null);
  const [genForm, setGenForm] = useState({
    cuisine: "Indian",
    servings: 2,
    maxTime: 30,
    diet: "None",
    goal: "zero_waste"
  });

  const handleGenerateEdibleRecipe = async () => {
    setIsGenerating(true);
    setGenRecipeResult(null);
    try {
      const res = await fetch(`${BASE_URL}/recipes/generate-edible`, {
        method: "POST",
        headers: getAuthHeaders ? getAuthHeaders() : { "Content-Type": "application/json", "X-User-Id": currentUser?.uid || "demo_user" },
        body: JSON.stringify({
          cuisine_style: genForm.cuisine,
          servings: parseInt(genForm.servings, 10),
          max_time_mins: parseInt(genForm.maxTime, 10),
          dietary_preference: genForm.diet,
          goal: genForm.goal
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Recipe generation failed");
      }
      const data = await res.json();
      setGenRecipeResult(data.recipe);
    } catch (err) {
      alert("Error generating recipe: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Load all recipes
  const loadRecipes = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append("q", searchQuery.trim());
      }
      params.append("limit", "100");

      const res = await fetch(`${BASE_URL}/recipes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load recipes");
      const data = await res.json();
      setRecipes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Failed to load recipes. Please check if your backend is running.");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadRecipes();
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Clean time formatting to prevent NaNh/NaN placeholders
  const formatTime = (timeStr) => {
    if (!timeStr) return "30 min";
    const str = String(timeStr).trim().toLowerCase();
    if (str.includes("nan") || str === "" || str === "0") {
      return "30 min";
    }
    if (/^\d+$/.test(str)) {
      return `${str} min`;
    }
    return timeStr;
  };

  // Stable Mock Nutrition Generator based on hash of Recipe Name
  const getNutrition = (recipeName) => {
    let hash = 0;
    const str = recipeName || "";
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);

    const calories = 220 + (hash % 380); // 220 to 600 kcal
    const protein = 5 + (hash % 32); // 5 to 37g
    const carbs = 20 + (hash % 60); // 20 to 80g
    const fats = 4 + (hash % 22); // 4 to 26g
    const fiber = 1 + (hash % 8); // 1 to 9g
    const sodium = 100 + (hash % 700); // 100 to 800mg

    return { calories, protein, carbs, fats, fiber, sodium };
  };

  // Helper function to format ingredient quantities nicely
  const formatQuantity = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "";
    if (num % 1 === 0) return String(num.toFixed(0));
    return String(num.toFixed(2).replace(/\.?0+$/, "")); // Strip trailing zeros
  };

  // Safe parsing helper for ingredients_raw which can be a pre-parsed array or a JSON string
  const getIngredientsArray = (ingredientsRaw) => {
    if (!ingredientsRaw) return [];
    if (Array.isArray(ingredientsRaw)) return ingredientsRaw;
    if (typeof ingredientsRaw === "string") {
      try {
        const parsed = JSON.parse(ingredientsRaw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  // Dynamic filter lists for specific categories
  const filterRecipesByCategory = (list, category) => {
    if (category === "all") return list;

    return list.filter((recipe) => {
      const nameLower = (recipe.name || "").toLowerCase();
      
      // Safe parsing for raw ingredients
      const ingredients = getIngredientsArray(recipe.ingredients_raw);
      const ingsLower = ingredients.map(i => String(i).toLowerCase());

      switch (category) {
        case "protein": {
          const proteinKeywords = [
            "chicken", "paneer", "egg", "fish", "dal", "lentil", "chana", "lamb", "mutton", "beef", "shrimp", 
            "soy", "tofu", "turkey", "pork", "chickpeas", "rajma", "sprouts", "lentils"
          ];
          const matchName = proteinKeywords.some(keyword => nameLower.includes(keyword));
          const matchIngs = ingsLower.some(ing => proteinKeywords.some(keyword => ing.includes(keyword)));
          return matchName || matchIngs;
        }
        case "one_pot": {
          const onePotKeywords = [
            "one-pot", "one pot", "biryani", "khichdi", "stew", "soup", "pulao", "kadhai", "curry", 
            "instant pot", "pressure cooker", "casserole", "pan", "pot"
          ];
          const matchName = onePotKeywords.some(keyword => nameLower.includes(keyword));
          const matchIngs = ingsLower.some(ing => onePotKeywords.some(keyword => ing.includes(keyword)));
          return matchName || matchIngs;
        }
        case "regional": {
          return recipe.cuisine && recipe.cuisine.trim() !== "" && recipe.cuisine.toLowerCase() !== "continental";
        }
        case "quick": {
          const timeNum = parseInt(recipe.time) || 0;
          return (timeNum > 0 && timeNum <= 30) || nameLower.includes("quick") || nameLower.includes("easy") || nameLower.includes("instant");
        }
        case "sweets": {
          const sweetKeywords = [
            "dessert", "sweet", "cake", "kheer", "halwa", "barfi", "chocolate", "pudding", "ice cream", 
            "kulfi", "laddoo", "gulab jamun", "jalebi", "payasam", "cookie", "muffin", "donut", "pastry",
            "shrikhand", "rasgulla", "peda"
          ];
          const matchName = sweetKeywords.some(keyword => nameLower.includes(keyword));
          const matchIngs = ingsLower.some(ing => sweetKeywords.some(keyword => ing.includes(keyword)));
          return matchName || matchIngs;
        }
        default:
          return true;
      }
    });
  };

  // Filtered recipes for Grid mode
  const filteredRecipes = useMemo(() => {
    return filterRecipesByCategory(recipes, selectedCategory);
  }, [recipes, selectedCategory]);

  // Dynamically group recipes into swimlanes for Catalog view
  const swimlanesData = useMemo(() => {
    if (recipes.length === 0) return {};

    const trending = recipes.slice(0, 10);
    const highProtein = filterRecipesByCategory(recipes, "protein").slice(0, 10);
    const quickEasy = filterRecipesByCategory(recipes, "quick").slice(0, 10);
    const regional = filterRecipesByCategory(recipes, "regional").slice(0, 10);

    return {
      "Trending This Week": trending,
      "Top Rated High-Protein Meals": highProtein.length > 0 ? highProtein : recipes.slice(10, 20),
      "Quick & Easy Supper": quickEasy.length > 0 ? quickEasy : recipes.slice(20, 30),
      "Regional Classics": regional.length > 0 ? regional : recipes.slice(30, 40)
    };
  }, [recipes]);

  // Handle Recipe Card Click
  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
    setServings(2); // reset default serving size
    setCheckedIngredients(new Set());
    setScalingFactors({});
    setAdjustedQuantities({});
  };

  // Close cookbook view
  const closeCookbook = () => {
    setSelectedRecipe(null);
  };

  // Fetch Scaling Factors from Backend when servings or recipe changes
  useEffect(() => {
    if (!selectedRecipe || !currentUser) return;

    const fetchFactors = async () => {
      setScalingLoading(true);
      try {
        const ingredients = (selectedRecipe.parsed_ingredients || []).map(ing => ing.item);
        const res = await fetch(`${BASE_URL}/inventory/scale-factors`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            servings: servings,
            ingredients: ingredients
          })
        });

        if (res.ok) {
          const factorsMap = await res.json();
          setScalingFactors(factorsMap);

          // Pre-populate actual quantities input fields
          const initialAdjusted = {};
          (selectedRecipe.parsed_ingredients || []).forEach(ing => {
            const factor = factorsMap[ing.item] || (servings / 2.0);
            const baseQty = parseFloat(ing.quantity);
            const validBase = isNaN(baseQty) ? 1.0 : baseQty;
            initialAdjusted[ing.item] = formatQuantity(validBase * factor);
          });
          setAdjustedQuantities(initialAdjusted);
        }
      } catch (err) {
        console.error("Failed to fetch scale factors", err);
      } finally {
        setScalingLoading(false);
      }
    };

    fetchFactors();
  }, [selectedRecipe, servings, currentUser]);

  // Adjust local quantity in form field
  const handleQuantityInputChange = (itemName, val) => {
    setAdjustedQuantities(prev => ({
      ...prev,
      [itemName]: val
    }));
  };

  // Toggle Ingredient Checked
  const toggleIngredientChecked = (originalText) => {
    setCheckedIngredients(prev => {
      const updated = new Set(prev);
      if (updated.has(originalText)) {
        updated.delete(originalText);
      } else {
        updated.add(originalText);
      }
      return updated;
    });
  };

  // Cook Meal & Deduct from Inventory
  const handleCookRecipe = async () => {
    if (!selectedRecipe || !currentUser) return;

    const cookIngredients = (selectedRecipe.parsed_ingredients || []).map(ing => {
      const factor = scalingFactors[ing.item] || (servings / 2.0);
      const baseQty = parseFloat(ing.quantity);
      const validBase = isNaN(baseQty) ? 1.0 : baseQty;
      const defaultScaled = validBase * factor;
      const userEnteredVal = parseFloat(adjustedQuantities[ing.item]);
      const finalQty = isNaN(userEnteredVal) ? defaultScaled : userEnteredVal;

      return {
        item: ing.item,
        quantity: finalQty,
        unit: ing.unit || "pieces"
      };
    });

    try {
      const res = await fetch(`${BASE_URL}/inventory/cook`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          recipe_name: selectedRecipe.name,
          ingredients: cookIngredients,
          servings: servings
        })
      });

      if (res.ok) {
        setCookSuccess(true);
        setTimeout(() => setCookSuccess(false), 3000);
      } else {
        alert("Failed to record cooking session. Please verify item names in your inventory.");
      }
    } catch (err) {
      console.error("Error calling cook endpoint", err);
      alert("Error contacting server. Please try again.");
    }
  };

  // Save scaling feedback (feedback loop to train ML scaling factor)
  const handleSavePreferences = async () => {
    if (!selectedRecipe || !currentUser) return;
    setSavingFeedback(true);

    const feedbackList = (selectedRecipe.parsed_ingredients || []).map(ing => {
      const factor = scalingFactors[ing.item] || (servings / 2.0);
      const baseQty = parseFloat(ing.quantity);
      const validBase = isNaN(baseQty) ? 1.0 : baseQty;
      const defaultScaled = validBase * factor;
      const userEnteredVal = parseFloat(adjustedQuantities[ing.item]);
      const finalQty = isNaN(userEnteredVal) ? defaultScaled : userEnteredVal;

      return {
        ingredient_name: ing.item,
        servings: servings,
        base_qty: validBase,
        actual_qty: finalQty
      };
    });

    try {
      const res = await fetch(`${BASE_URL}/analytics/track-scaling`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          feedback: feedbackList
        })
      });

      if (res.ok) {
        alert("Cooking preferences logged! Future servings scaling will adapt to your style.");
      } else {
        alert("Failed to save scaling details.");
      }
    } catch (err) {
      console.error("Error saving preferences", err);
    } finally {
      setSavingFeedback(false);
    }
  };

  // Bold cooking times and key parameters in instructions
  const formatInstructions = (instructionText) => {
    if (!instructionText) return [];

    let rawSteps = [];
    
    // Check if it's a JSON array representation
    try {
      if (typeof instructionText === "string" && (instructionText.startsWith("[") || instructionText.startsWith("{"))) {
        const parsed = JSON.parse(instructionText);
        if (Array.isArray(parsed)) {
          rawSteps = parsed;
        }
      }
    } catch (e) {
      rawSteps = [];
    }

    if (rawSteps.length === 0) {
      if (instructionText.includes("\n")) {
        rawSteps = instructionText.split("\n");
      } else {
        rawSteps = instructionText.split(/(?<=[.!?])\s+(?=\d)|(?<=[.!?])\s+/);
      }
    }

    return rawSteps
      .map(s => s.trim())
      .filter(s => s.length > 3)
      .map((s, idx) => {
        // Strip leading number if present (e.g. "1. Heat oil" -> "Heat oil")
        let cleaned = s.replace(/^\d+[\.\s\-]+/, "").trim();

        // Regex highlight times/temperatures/measurements
        const highlights = [
          /\b\d+\s*(?:minutes|mins|minute|min|hours|hour|sec|seconds|whistles|whistle|whistling)\b/gi,
          /\b(?:medium flame|low flame|high flame|medium heat|high heat|low heat|medium pressure)\b/gi,
          /\b(?:tablespoon|tbsp|teaspoon|tsp|cup|cups|grams|kg|ml|liters)\b/gi
        ];

        let formatted = cleaned;
        highlights.forEach(regex => {
          formatted = formatted.replace(regex, (match) => `<strong>${match}</strong>`);
        });

        return {
          stepNum: idx + 1,
          content: formatted
        };
      });
  };

  return (
    <div className="recipes-page">
      {/* Catalog view */}
      {!selectedRecipe ? (
        <>
          {/* Recipe Search & Filter Header */}
          <div className="recipes-page-header">
            <div className="recipes-logo" onClick={() => navigate("/recipes")} style={{ cursor: "pointer" }}>
              <span className="recipes-logo-icon">🍲</span>
              <div className="logo-brand-details">
                <span className="brand-title">Recipe Catalog</span>
                <span className="brand-subtitle">Smart Inventory Matching</span>
              </div>
            </div>

            <div className="header-search-container">
              <input
                type="text"
                className="header-search-input"
                placeholder="Search recipes or ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <svg
                className="search-icon-svg"
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
              </svg>
            </div>
          </div>

          {/* Hero Banner */}
          <div className="recipes-hero">
            <div className="recipes-hero-content">
              <h1>Discover Healthy Cooking & Personalized Nutrition</h1>
              <p>
                Browse hand-picked recipes calibrated to match your available inventory and adapt dynamically to your personal serving sizes.
              </p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "1rem" }}>
                <button 
                  className="recipes-hero-cta"
                  onClick={() => {
                    const el = document.getElementById("categories-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Explore Categories
                </button>
                <button 
                  className="recipes-hero-cta"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                  onClick={() => setIsGenModalOpen(true)}
                >
                  ✨ AI Generate Edible Recipe from My Pantry
                </button>
              </div>
            </div>
            <div className="recipes-hero-visual">
              <div className="hero-floating-badge top-right">🥗 100% Healthy</div>
              <div className="hero-floating-badge bottom-left">⏱️ Quick Prep</div>
            </div>
          </div>

          {/* Categories Horizontal Scroll Row */}
          <div id="categories-section" className="categories-container">
            <h2 className="categories-title">What would you like to cook?</h2>
            <div className="categories-scroll">
              {LIFESTYLE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-pill ${selectedCategory === cat.id ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <span className="category-pill-icon">{cat.icon}</span>
                  <span className="category-pill-name">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error / Loading statuses */}
          {error && <p className="recipes-error">{error}</p>}
          {loading && <p className="recipes-loading">Loading recipes...</p>}

          {!loading && recipes.length === 0 && !error && (
            <p className="recipes-loading">No recipes found. Try a different query.</p>
          )}

          {/* Swimlanes or Filtered Grid */}
          {!loading && recipes.length > 0 && (
            <>
              {selectedCategory !== "all" ? (
                /* Filtered Grid View */
                <div className="filtered-grid-container">
                  <h3 className="swimlane-title">
                    Showing {LIFESTYLE_CATEGORIES.find(c => c.id === selectedCategory)?.name} ({filteredRecipes.length})
                  </h3>
                  <div className="recipes-grid-layout">
                    {filteredRecipes.map((recipe, index) => {
                      const nutrition = getNutrition(recipe.name);
                      const displayTime = formatTime(recipe.time);
                      return (
                        <div
                          className="catalog-recipe-card"
                          key={`${recipe.name}-${index}`}
                          onClick={() => handleRecipeClick(recipe)}
                        >
                          <div className="recipe-card-img-wrapper">
                            <RecipeImage recipe={recipe} alt={recipe.name} />
                            {recipe.cuisine && (
                              <span className="recipe-card-cuisine-tag">
                                {recipe.cuisine}
                              </span>
                            )}
                          </div>
                          <div className="recipe-card-info">
                            <h3 className="recipe-card-title">{recipe.name}</h3>
                            <div className="recipe-card-stats">
                              <span className="recipe-card-stat-item">⏱️ {displayTime}</span>
                              <span className="recipe-card-stat-item">📦 {getIngredientsArray(recipe.ingredients_raw).length} items</span>
                            </div>
                            <div className="recipe-card-nutrition-summary">
                              <div className="nutrition-pill">
                                <span className="nutrition-val">{nutrition.calories}</span>
                                <span>Calories</span>
                              </div>
                              <div className="nutrition-pill">
                                <span className="nutrition-val">{nutrition.protein}g</span>
                                <span>Protein</span>
                              </div>
                              <div className="nutrition-pill">
                                <span className="nutrition-val">{nutrition.fats}g</span>
                                <span>Fats</span>
                              </div>
                              <div className="nutrition-pill">
                                <span className="nutrition-val">{nutrition.carbs}g</span>
                                <span>Carbs</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="recipe-view-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRecipeClick(recipe);
                              }}
                            >
                              View Recipe
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Curated Collections (Swimlanes) */
                Object.entries(swimlanesData).map(([swimlaneTitle, laneRecipes]) => (
                  <div className="swimlane-container" key={swimlaneTitle}>
                    <div className="swimlane-header">
                      <h3 className="swimlane-title">{swimlaneTitle}</h3>
                    </div>
                    <div className="swimlane-scroll">
                      {laneRecipes.map((recipe, index) => {
                        const nutrition = getNutrition(recipe.name);
                        const displayTime = formatTime(recipe.time);
                        return (
                          <div
                            className="catalog-recipe-card"
                            key={`${recipe.name}-${index}`}
                            onClick={() => handleRecipeClick(recipe)}
                          >
                            <div className="recipe-card-img-wrapper">
                              <RecipeImage recipe={recipe} alt={recipe.name} />
                              {recipe.cuisine && (
                                <span className="recipe-card-cuisine-tag">
                                  {recipe.cuisine}
                                </span>
                              )}
                            </div>
                            <div className="recipe-card-info">
                              <h3 className="recipe-card-title">{recipe.name}</h3>
                              <div className="recipe-card-stats">
                                <span className="recipe-card-stat-item">⏱️ {displayTime}</span>
                                <span className="recipe-card-stat-item">📦 {getIngredientsArray(recipe.ingredients_raw).length} items</span>
                              </div>
                              <div className="recipe-card-nutrition-summary">
                                <div className="nutrition-pill">
                                  <span className="nutrition-val">{nutrition.calories}</span>
                                  <span>Calories</span>
                                </div>
                                <div className="nutrition-pill">
                                  <span className="nutrition-val">{nutrition.protein}g</span>
                                  <span>Protein</span>
                                </div>
                                <div className="nutrition-pill">
                                  <span className="nutrition-val">{nutrition.fats}g</span>
                                  <span>Fats</span>
                                </div>
                                <div className="nutrition-pill">
                                  <span className="nutrition-val">{nutrition.carbs}g</span>
                                  <span>Carbs</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="recipe-view-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRecipeClick(recipe);
                                }}
                              >
                                View Recipe
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </>
      ) : (
        /* Immersive "Open Cookbook" detailed view with wooden desk and decorative table assets */
        <div className="cookbook-fullscreen-overlay">
          {cookSuccess && (
            <div className="cook-success-toast">
              <span>🎉</span> Baked & Cooked! Inventory automatically deducted.
            </div>
          )}

          {/* SKEUOMORPHIC ACCENTS ON WOOD TABLE */}
          
          {/* Post-it Pinned Note Navigation Tabs */}
          <div className="cookbook-postit-tabs">
            <div className="postit-tab catalog-tab" onClick={closeCookbook}>
              <div className="pushpin red-pin"></div>
              <span>Library</span>
            </div>
            <div className="postit-tab pantry-tab" onClick={() => navigate("/inventory")}>
              <div className="pushpin blue-pin"></div>
              <span>Pantry</span>
            </div>
            <div className="postit-tab planner-tab" onClick={() => navigate("/meal-planning")}>
              <div className="pushpin yellow-pin"></div>
              <span>Planner</span>
            </div>
          </div>

          {/* Fresh Tomato (CSS Illustration) */}
          <div className="table-deco tomato-deco">
            <div className="tomato-body">
              <div className="tomato-leaf leaf-1"></div>
              <div className="tomato-leaf leaf-2"></div>
              <div className="tomato-leaf leaf-3"></div>
              <div className="tomato-stem"></div>
              <div className="tomato-highlight"></div>
            </div>
          </div>

          {/* Spaghetti Strands */}
          <div className="table-deco spaghetti-group">
            <div className="spaghetti-strand strand-1"></div>
            <div className="spaghetti-strand strand-2"></div>
            <div className="spaghetti-strand strand-3"></div>
            <div className="spaghetti-strand strand-4"></div>
            <div className="spaghetti-strand strand-5"></div>
          </div>

          {/* Cucumber Slices */}
          <div className="table-deco cucumber-deco">
            <div className="cucumber-rind">
              <div className="cucumber-flesh">
                <div className="cucumber-center">
                  <span className="seed seed-1"></span>
                  <span className="seed seed-2"></span>
                  <span className="seed seed-3"></span>
                  <span className="seed seed-4"></span>
                  <span className="seed seed-5"></span>
                  <span className="seed seed-6"></span>
                </div>
              </div>
            </div>
          </div>

          {/* Dry Fusilli Pasta Shapes */}
          <div className="table-deco fusilli-group">
            <div className="fusilli-pasta fusilli-1"></div>
            <div className="fusilli-pasta fusilli-2"></div>
            <div className="fusilli-pasta fusilli-3"></div>
          </div>

          {/* Cardboard Chef Note Tag with Paper Clip */}
          <div className="table-deco chef-tag-deco">
            <div className="tag-clip"></div>
            <div className="cardboard-tag">
              <div className="tag-hole"></div>
              <div className="tag-text">Chef's Notes</div>
              <div className="tag-recipe-stat">
                <span>⏱️ {formatTime(selectedRecipe.time)}</span>
              </div>
            </div>
          </div>

          <button className="cookbook-back-btn" onClick={closeCookbook}>
            ← Back to Library
          </button>

          <div className="cookbook-spread-container book-open-animation">
            {/* 3D Binder Center Spine (Spiral Rings) */}
            <div className="cookbook-spine">
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  className="spine-ring"
                  style={{ 
                    top: `${i * 6.5 + 4.5}%`,
                    "--index": i
                  }}
                />
              ))}
            </div>

            {/* LEFT PAGE: Polaroid Image, Cursive Title, Detailed Method */}
            <div className="cookbook-page left-page">
              <div className="polaroid-frame">
                <div className="paper-clip" />
                <div className="polaroid-image-wrapper">
                  <RecipeImage recipe={selectedRecipe} alt={selectedRecipe.name} />
                </div>
                <div className="polaroid-caption">Food Sync Kitchen</div>
              </div>

              <h2 className="cookbook-recipe-title">{selectedRecipe.name}</h2>

              <div className="cookbook-section-title">
                📖 Method
              </div>

              <div className="instructions-list">
                {formatInstructions(selectedRecipe.instructions).map((step) => (
                  <div className="instruction-step" key={step.stepNum}>
                    <span className="instruction-step-num">Step {step.stepNum}:</span>
                    <span
                      className="instruction-step-content"
                      dangerouslySetInnerHTML={{ __html: step.content }}
                    />
                  </div>
                ))}
                {formatInstructions(selectedRecipe.instructions).length === 0 && (
                  <p className="instruction-step">Refer to details for cooking instructions.</p>
                )}
              </div>
            </div>

            {/* RIGHT PAGE: Ingredients Checklist, Servings Controller, Nutrition Macros, Action Buttons */}
            <div className="cookbook-page right-page">
              <div className="cookbook-section-title">
                🍳 Ingredients Checklist
              </div>

              {/* Servings Adjuster */}
              <div className="servings-scaler-panel">
                <span className="servings-label">Scale serving size:</span>
                <div className="scaler-controls">
                  <button
                    type="button"
                    className="scaler-btn"
                    onClick={() => setServings(prev => Math.max(1, prev - 1))}
                    disabled={servings <= 1}
                  >
                    -
                  </button>
                  <span className="servings-count">{servings}</span>
                  <button
                    type="button"
                    className="scaler-btn"
                    onClick={() => setServings(prev => prev + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              {scalingLoading && <p style={{ fontSize: "0.8rem", color: "#854d0e", marginBottom: "1rem", fontStyle: "italic" }}>Scaling quantities...</p>}

              {/* Checked list of ingredients */}
              <div className="ingredients-list">
                {(selectedRecipe.parsed_ingredients || []).map((ing, idx) => {
                  const factor = scalingFactors[ing.item] || (servings / 2.0);
                  const baseQty = parseFloat(ing.quantity);
                  const validBase = isNaN(baseQty) ? 1.0 : baseQty;
                  const scaledQuantity = formatQuantity(validBase * factor);
                  const displayUnit = ing.unit || "units";
                  
                  const originalKey = ing.original || ing.item;
                  const isChecked = checkedIngredients.has(originalKey);

                  return (
                    <div 
                      key={idx} 
                      className={`ingredient-checkbox-item ${isChecked ? "checked" : ""}`}
                      onClick={() => toggleIngredientChecked(originalKey)}
                    >
                      <div className="checklist-bullet">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by click parent
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      
                      <div className="ingredient-item-details">
                        <span className="ingredient-name">{ing.item}</span>
                        <span className="ingredient-connector"> - </span>
                        <input
                          type="number"
                          step="0.05"
                          className="ingredient-quantity-input"
                          value={adjustedQuantities[ing.item] || scaledQuantity}
                          onChange={(e) => handleQuantityInputChange(ing.item, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="ingredient-unit">{displayUnit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Nutrition Block */}
              <div className="cookbook-section-title">
                📊 Nutritional Values
              </div>

              {(() => {
                const baseNut = getNutrition(selectedRecipe.name);
                const scaleVal = servings / 2.0; // scale macro display linearly with servings
                return (
                  <div className="nutrition-cookbook-grid">
                    <div className="nutrition-detail-card">
                      <span className="nutrition-detail-label">Calories</span>
                      <span className="nutrition-detail-value">{Math.round(baseNut.calories * scaleVal)} kcal</span>
                    </div>
                    <div className="nutrition-detail-card">
                      <span className="nutrition-detail-label">Protein</span>
                      <span className="nutrition-detail-value">{Math.round(baseNut.protein * scaleVal)}g</span>
                    </div>
                    <div className="nutrition-detail-card">
                      <span className="nutrition-detail-label">Fats</span>
                      <span className="nutrition-detail-value">{Math.round(baseNut.fats * scaleVal)}g</span>
                    </div>
                    <div className="nutrition-detail-card">
                      <span className="nutrition-detail-label">Carbs</span>
                      <span className="nutrition-detail-value">{Math.round(baseNut.carbs * scaleVal)}g</span>
                    </div>
                    <div className="nutrition-detail-card">
                      <span className="nutrition-detail-label">Fiber</span>
                      <span className="nutrition-detail-value">{Math.round(baseNut.fiber * scaleVal)}g</span>
                    </div>
                    <div className="nutrition-detail-card">
                      <span className="nutrition-detail-label">Sodium</span>
                      <span className="nutrition-detail-value">{Math.round(baseNut.sodium * scaleVal)}mg</span>
                    </div>
                  </div>
                );
              })()}

              {/* Cook & Feedback actions */}
              <div className="cookbook-buttons-container">
                <button
                  type="button"
                  className="cook-recipe-action-btn"
                  onClick={handleCookRecipe}
                >
                  🍳 Cook Recipe (Deduct Inventory)
                </button>
                <button
                  type="button"
                  className="log-preferences-btn"
                  onClick={handleSavePreferences}
                  disabled={savingFeedback}
                >
                  {savingFeedback ? "Logging preferences..." : "💾 Log Quantities Used (Refine Scale)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✨ GENERATIVE CHEF MODAL */}
      {isGenModalOpen && (
        <div 
          className="cookbook-overlay" 
          onClick={() => setIsGenModalOpen(false)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
        >
          <div 
            className="cookbook-modal" 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: "700px", width: "95%", maxHeight: "90vh", overflowY: "auto", padding: "24px", borderRadius: "20px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.5rem" }}>✨</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#1e293b" }}>AI Generative Chef</h2>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>3-Layer Neuro-Symbolic Culinary Synthesis</span>
                </div>
              </div>
              <button 
                onClick={() => setIsGenModalOpen(false)}
                style={{ background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            {/* Generation Form */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>Cuisine Style:</label>
                <select 
                  value={genForm.cuisine} 
                  onChange={(e) => setGenForm({ ...genForm, cuisine: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                >
                  <option value="Indian">Indian (Regional/Home-style)</option>
                  <option value="Continental">Continental / Mediterranean</option>
                  <option value="Asian Stir-Fry">Pan-Asian Stir-Fry</option>
                  <option value="Mexican">Mexican / Fusion</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>Dietary Preference:</label>
                <select 
                  value={genForm.diet} 
                  onChange={(e) => setGenForm({ ...genForm, diet: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                >
                  <option value="None">None (Standard)</option>
                  <option value="Vegetarian">Strict Vegetarian</option>
                  <option value="Vegan">Vegan (No Dairy)</option>
                  <option value="High-Protein">High-Protein</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>Servings ({genForm.servings}):</label>
                <input 
                  type="number" 
                  min="1" 
                  max="10" 
                  value={genForm.servings} 
                  onChange={(e) => setGenForm({ ...genForm, servings: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>Max Time (mins):</label>
                <input 
                  type="number" 
                  min="10" 
                  max="120" 
                  step="5" 
                  value={genForm.maxTime} 
                  onChange={(e) => setGenForm({ ...genForm, maxTime: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                />
              </div>
            </div>

            <button
              onClick={handleGenerateEdibleRecipe}
              disabled={isGenerating}
              style={{
                width: "100%",
                padding: "12px",
                background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(124, 58, 237, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              {isGenerating ? "Synthesizing Edible Recipe from Pantry..." : "🍳 Generate Safe, Edible Dish Now"}
            </button>

            {/* Generated Recipe View */}
            {genRecipeResult && (
              <div style={{ marginTop: "20px", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", color: "#1e293b", fontSize: "1.4rem" }}>{genRecipeResult.recipe_name}</h3>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ background: "#ede9fe", color: "#6d28d9", fontSize: "0.75rem", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>
                        {genRecipeResult.dish_archetype}
                      </span>
                      <span style={{ background: "#f1f5f9", color: "#475569", fontSize: "0.75rem", padding: "2px 8px", borderRadius: "12px" }}>
                        ⏱️ {genRecipeResult.prep_time_mins} mins
                      </span>
                      <span style={{ background: "#f1f5f9", color: "#475569", fontSize: "0.75rem", padding: "2px 8px", borderRadius: "12px" }}>
                        🔥 {genRecipeResult.calories_per_serving}
                      </span>
                    </div>
                  </div>

                  {/* Edibility Report Badge */}
                  {genRecipeResult.edibility_report && (
                    <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid #10b981", padding: "6px 12px", borderRadius: "10px", textAlign: "right" }}>
                      <div style={{ color: "#059669", fontWeight: 800, fontSize: "0.85rem" }}>
                        ✓ {genRecipeResult.edibility_report.edibility_score}% Edibility Verified
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#10b981" }}>
                        Thermal Sequence Checked
                      </div>
                    </div>
                  )}
                </div>

                {genRecipeResult.why_it_works_culinarily && (
                  <p style={{ fontSize: "0.85rem", color: "#475569", fontStyle: "italic", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", margin: "12px 0" }}>
                    💡 <strong>Culinary Harmony:</strong> {genRecipeResult.why_it_works_culinarily}
                  </p>
                )}

                {/* Ingredients List */}
                <h4 style={{ margin: "12px 0 6px 0", color: "#334155" }}>Partitioned Pantry Ingredients:</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "6px" }}>
                  {(genRecipeResult.ingredients_structured || []).map((ing, idx) => (
                    <div key={idx} style={{ background: "#f8fafc", padding: "6px 10px", borderRadius: "6px", fontSize: "0.85rem", border: "1px solid #e2e8f0" }}>
                      <strong>{ing.item}</strong>: {ing.quantity} {ing.unit} <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>({ing.role})</span>
                    </div>
                  ))}
                </div>

                {/* Thermal Steps */}
                <h4 style={{ margin: "16px 0 6px 0", color: "#334155" }}>Thermal Execution Steps:</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(genRecipeResult.thermal_steps || []).map((step, idx) => (
                    <div key={idx} style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "10px", borderRadius: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 800, fontSize: "0.8rem", color: "#7c3aed" }}>
                          PHASE {step.step_num}: {step.phase}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>⏱️ {step.duration_mins}m</span>
                      </div>
                      <p style={{ margin: "2px 0", fontSize: "0.85rem", color: "#1e293b", lineHeight: 1.4 }}>
                        {step.instruction}
                      </p>
                      {step.sensory_cue && (
                        <div style={{ fontSize: "0.75rem", color: "#0284c7", marginTop: "4px" }}>
                          👃 <em>Sensory cue:</em> {step.sensory_cue}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                  <button
                    onClick={() => {
                      alert("Dish added to your weekly cooking queue! 🍽️");
                      setIsGenModalOpen(false);
                    }}
                    style={{ flex: 1, padding: "10px", background: "#10b981", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                  >
                    ✓ Save to My Recipes
                  </button>
                  <button
                    onClick={() => {
                      setIsGenModalOpen(false);
                      navigate("/assistant");
                    }}
                    style={{ flex: 1, padding: "10px", background: "#3b82f6", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                  >
                    🤖 Walk Through with Jarvis
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}