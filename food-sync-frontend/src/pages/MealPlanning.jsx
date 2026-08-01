import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext"; // <--- 1. Import Auth Hook
import RecipeImage from "../components/RecipeImage";
import "../assets/styles/meal_planning.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const getTimeMessage = () => {
  const hour = new Date().getHours();
  if (hour < 11) return "Good Morning! Breakfast Ideas ☀️";
  if (hour < 16) return "Lunch Time! Hearty Meals 🍛";
  if (hour < 19) return "Evening Cravings? Snack Time ☕";
  return "Dinner Time! Light & Filling 🌙";
};

export default function MealPlanning() {
  const { getAuthHeaders, currentUser } = useAuth(); // <--- 2. Get Auth Helpers

  // --- STATE MANAGEMENT ---
  const [expiringItems, setExpiringItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Plan State
  const [mealPlan, setMealPlan] = useState([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [syncingGaps, setSyncingGaps] = useState(false);

  // Market Trip & Inventory Depletion Engine State
  const [planDays, setPlanDays] = useState(7);
  const [marketDay, setMarketDay] = useState(3);
  const [planGoal, setPlanGoal] = useState("zero_waste");
  const [zeroWasteScore, setZeroWasteScore] = useState(0);
  const [depletionMilestones, setDepletionMilestones] = useState([]);
  const [marketShoppingList, setMarketShoppingList] = useState([]);
  const [personalizationAnalytics, setPersonalizationAnalytics] = useState(null);
  const [marketPrediction, setMarketPrediction] = useState(null);

  // Modals & Cooking State
  const [selectedRecipe, setSelectedRecipe] = useState(null); 
  const [isCookModalOpen, setIsCookModalOpen] = useState(false);
  const [cookIngredients, setCookIngredients] = useState([]);
  const [cookingLoading, setCookingLoading] = useState(false);
  const [recipeToCook, setRecipeToCook] = useState(null);

  // NEW: People Counter (Default 2)
  const [peopleCount, setPeopleCount] = useState(2);

  // --- 1. FETCH EXPIRING ITEMS (SECURED) ---
  useEffect(() => {
    if (!currentUser) return; // Wait for login

    fetch(`${BASE_URL}/inventory/expiring`, {
      headers: getAuthHeaders() // <--- Pass User ID
    })
      .then((res) => res.json())
      .then((data) => {
        setExpiringItems(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Failed to load inventory", err));
  }, [currentUser]); // Reload when user changes

  const getCurrentSlotName = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "breakfast";
    if (hour >= 11 && hour < 16) return "lunch";
    if (hour >= 16 && hour < 19) return "snack";
    return "dinner";
  };

  const [mealSlot, setMealSlot] = useState(getCurrentSlotName());

  // --- 2. FETCH RECIPES (SECURED & TIME/SERVING AWARE) ---
  useEffect(() => {
    if (!selectedItem) {
        setSuggestions([]);
        return;
    }
    fetchRecipes(selectedItem.item);
  }, [selectedItem, planGoal, mealSlot, peopleCount]);

  const fetchRecipes = (itemName) => {
    setLoading(true);
    fetch(`${BASE_URL}/suggest/meal?item=${encodeURIComponent(itemName)}&plan_goal=${planGoal}&meal_slot=${mealSlot}&servings=${peopleCount}`, {
      headers: getAuthHeaders() // <--- Pass User ID
    })
      .then((res) => res.json())
      .then((data) => setSuggestions(data.suggestions || []))
      .catch((err) => {
        console.error("Failed", err);
        setSuggestions([]);
      })
      .finally(() => setLoading(false));
  };

  // --- 3. GENERATE PLAN WITH PERSONALIZATION, GOAL & MARKET TRIP DEPLETION ---
  const generatePlan = async () => {
    setPlanLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/suggest/plan?days=${planDays}&market_day=${marketDay}&plan_goal=${planGoal}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setMealPlan(data.plan || []);
      setZeroWasteScore(data.zero_waste_score || 0);
      setDepletionMilestones(data.depletion_milestones || []);
      setMarketShoppingList(data.market_shopping_list || []);
      setPersonalizationAnalytics(data.personalization_analytics || null);
      setMarketPrediction(data.market_prediction || null);
    } catch (e) {
      console.error(e);
      alert("Could not generate plan.");
    } finally {
      setPlanLoading(false);
    }
  };

  // --- 3.5. SYNC MEAL PLAN GAPS TO SHOPPING LIST ---
  const handleSyncGaps = async () => {
    if (!mealPlan || mealPlan.length === 0) return;
    setSyncingGaps(true);
    try {
      const res = await fetch(`${BASE_URL}/meal-planning/sync-gaps`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ meal_plan: mealPlan })
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Successfully synced ${data.total_gaps} missing ingredient gap(s) to your Shopping List! 🛒✨`);
      } else {
        alert("Failed to sync missing items to shopping list.");
      }
    } catch (err) {
      console.error("Error syncing gaps:", err);
      alert("Error contacting server.");
    } finally {
      setSyncingGaps(false);
    }
  };

  // --- SAFE PARSING HELPERS ---
  const getIngredientsArray = (ingredientsRaw) => {
    if (!ingredientsRaw) return [];
    if (Array.isArray(ingredientsRaw)) return ingredientsRaw;
    if (typeof ingredientsRaw === "string") {
      try {
        const parsed = JSON.parse(ingredientsRaw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        return [ingredientsRaw];
      }
    }
    return [];
  };

  const getInstructionsArray = (instructions) => {
    if (!instructions) return [];
    if (Array.isArray(instructions)) return instructions;
    if (typeof instructions === "string") {
      try {
        const parsed = JSON.parse(instructions);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        return instructions.split(/\n|(?<=\.)\s+/).filter(s => s && s.trim().length > 3);
      }
    }
    return [];
  };

  // --- HELPER FUNCTIONS ---
  const handleRecipeClick = (recipe) => setSelectedRecipe(recipe);
  const closeModal = () => setSelectedRecipe(null);

  const getUrgencyClass = (days) => {
      if (days <= 7) return "urgent-red";
      if (days <= 14) return "urgent-orange";
      return "urgent-green";
  };

  const getUrgencyLabel = (days) => {
      if (days <= 7) return "Use Now!";
      if (days <= 14) return "Perishable";
      return "Stable";
  };

  // --- COOKING LOGIC (With Auto-Scaling & Backend Parsing) ---
  const handleCookClick = async (recipe) => {
    setRecipeToCook(recipe);
    
    // 1. Calculate Scaling Factor (Assuming base recipe serves 2)
    const BASE_SERVINGS = 2;
    const scaleFactor = peopleCount / BASE_SERVINGS;

    // 2. Determine Ingredients Source
    let ingredientsToMap = [];
    
    if (recipe.parsed_ingredients && recipe.parsed_ingredients.length > 0) {
        ingredientsToMap = recipe.parsed_ingredients;
    } else {
        // Fallback parsing
        let rawList = [];
        if (recipe["Cleaned-Ingredients"]) {
            rawList = recipe["Cleaned-Ingredients"].split(",").map(s => s.trim()).filter(s => s.length > 0);
        } else if (recipe.ingredients_raw) {
            rawList = recipe.ingredients_raw;
        }
        
        ingredientsToMap = rawList.map(str => ({
            item: str.replace(/[\d/.]+(?:cup|tbsp|tsp|g|kg|ml|l|pcs)?/gi, "").trim(),
            quantity: 1,
            unit: "pieces"
        }));
    }

    // 3. Fetch Adaptive Scaling Factors from Backend
    let factors = {};
    try {
      const res = await fetch(`${BASE_URL}/inventory/scale-factors`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          servings: peopleCount,
          ingredients: ingredientsToMap.map((ing) => ing.item),
        }),
      });
      if (res.ok) {
        factors = await res.json();
      }
    } catch (err) {
      console.error("Failed to fetch adaptive scale factors:", err);
    }

    // 4. Scale Quantities using factors, falling back to static scaleFactor
    const scaledList = ingredientsToMap.map((ing) => {
      const factor = factors[ing.item] !== undefined ? factors[ing.item] : scaleFactor;
      const baseQty = parseFloat(ing.quantity) || 1.0;
      return {
        item: ing.item,
        quantity: (baseQty * factor).toFixed(1), 
        unit: ing.unit,
        baseQuantity: baseQty,
      };
    });

    setCookIngredients(scaledList);
    setIsCookModalOpen(true);
  };

  const updateIngredient = (index, field, value) => {
    const updated = [...cookIngredients];
    updated[index][field] = value;
    setCookIngredients(updated);
  };
  
  const removeIngredient = (index) => {
    setCookIngredients(cookIngredients.filter((_, i) => i !== index));
  };

  const confirmCook = async () => {
    setCookingLoading(true);
    try {
      // 1. Log adjustments to /analytics/track-scaling
      const feedbackPayload = {
        feedback: cookIngredients.map((ing) => ({
          ingredient_name: ing.item,
          servings: peopleCount,
          base_qty: parseFloat(ing.baseQuantity) || 1.0,
          actual_qty: parseFloat(ing.quantity) || 0.0,
        })),
      };
      
      try {
        await fetch(`${BASE_URL}/analytics/track-scaling`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(feedbackPayload),
        });
      } catch (err) {
        console.error("Failed to track scaling feedback:", err);
      }

      // 2. Cook recipe
      const payload = {
        recipe_name: recipeToCook.RecipeName || recipeToCook.name,
        ingredients: cookIngredients.map((ing) => ({
          item: ing.item,
          quantity: parseFloat(ing.quantity) || 0,
          unit: ing.unit,
        })),
        servings: 2.0, // Backend scales by servings/2.0 factor. Passing 2.0 ensures 1.0x factor (no scaling) since frontend already scaled it.
      };

      const res = await fetch(`${BASE_URL}/inventory/cook`, {
        method: "POST", 
        headers: getAuthHeaders(), // <--- Pass User ID
        body: JSON.stringify(payload),
      });
      
      const result = await res.json();
      const deductedCount = result.deducted ? result.deducted.length : 0;
      alert(`Success! Cooked for ${peopleCount} people.\n${deductedCount} items updated.`);
      
      setIsCookModalOpen(false); 
      setRecipeToCook(null);

      // Refresh Inventory after cooking
      const refreshRes = await fetch(`${BASE_URL}/inventory/expiring`, { headers: getAuthHeaders() });
      const refreshData = await refreshRes.json();
      setExpiringItems(refreshData);

    } catch (err) {
      alert("Error updating inventory.");
    } finally {
      setCookingLoading(false);
    }
  };

  if (!currentUser) return <div className="loading-text" style={{marginTop:'50px'}}>Please log in to manage your meal plan.</div>;

  return (
    <div className="meal-planning-page">
      <div className="meal-header">
        <h1>👨‍🍳 Smart Chef <span style={{fontSize:'0.6em', opacity:0.7, fontWeight:'normal'}}>Hi, {currentUser.displayName?.split(' ')[0]}</span></h1>
        <p>{getTimeMessage()}</p>
        
        {/* NEW: PEOPLE COUNTER UI */}
        <div className="portion-control" style={{
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '15px', 
            background: 'white', 
            padding: '8px 16px', 
            borderRadius: '20px', 
            marginTop: '15px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
           <span style={{color: '#718096', fontWeight: 'bold'}}>Cooking for:</span>
           <button 
             onClick={() => setPeopleCount(Math.max(1, peopleCount - 1))}
             style={{background:'#edf2f7', border:'none', width:'30px', height:'30px', borderRadius:'50%', cursor:'pointer', fontWeight:'bold', fontSize:'1.2rem'}}
           >-</button>
           <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#2d3748', minWidth: '20px', textAlign:'center'}}>
             {peopleCount}
           </span>
           <button 
             onClick={() => setPeopleCount(peopleCount + 1)}
             style={{background:'#edf2f7', border:'none', width:'30px', height:'30px', borderRadius:'50%', cursor:'pointer', fontWeight:'bold', fontSize:'1.2rem'}}
           >+</button>
           <span style={{color: '#718096'}}>People</span>
        </div>
      </div>

      {/* --- SECTION 1: EXPIRING ITEMS --- */}
      <section className="expiring-section">
        <h2>⚠️ Use These Up Soon!</h2>
        <div className="expiring-scroll">
          {expiringItems.map((invItem) => (
            <div
              key={invItem.item}
              className={`expiring-card ${selectedItem?.item === invItem.item ? "selected" : ""}`}
              onClick={() => setSelectedItem(invItem)}
            >
              <h3>{invItem.item}</h3>
              <p>{invItem.quantity} {invItem.unit}</p>
              <div className={`expiry-badge ${getUrgencyClass(invItem.estimated_days)}`}>
                 {getUrgencyLabel(invItem.estimated_days)}
              </div>
            </div>
          ))}
          {expiringItems.length === 0 && (
            <p style={{ padding: "1rem", color: "#718096" }}>Your pantry is safe! Add items to get started.</p>
          )}
        </div>
      </section>

      {/* --- SECTION 2: RECIPE SUGGESTIONS --- */}
      <section className="suggestions-section">
        <div className="suggestions-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h2>
            Recipes with <span style={{ color: "#ed8936" }}>{selectedItem?.item || "..."}</span>
          </h2>

          {/* Time of Day Filter Bar */}
          <div style={{ display: 'flex', gap: '6px', background: '#f8fafc', padding: '4px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
            {[
              { id: "breakfast", label: "☀️ Morning Breakfast" },
              { id: "lunch", label: "🍛 Afternoon Lunch" },
              { id: "snack", label: "☕ Evening Snack" },
              { id: "dinner", label: "🌙 Night Dinner" }
            ].map(slot => (
              <button
                key={slot.id}
                type="button"
                onClick={() => setMealSlot(slot.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '16px',
                  border: 'none',
                  background: mealSlot === slot.id ? '#3b82f6' : 'transparent',
                  color: mealSlot === slot.id ? '#ffffff' : '#64748b',
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: mealSlot === slot.id ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none'
                }}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>

        {!selectedItem && (
             <div style={{
                 padding: '30px', 
                 textAlign: 'center', 
                 backgroundColor: '#f7fafc', 
                 borderRadius: '8px', 
                 border: '2px dashed #cbd5e0',
                 color: '#718096',
                 margin: '20px 0'
             }}>
                 👆 <strong>Select an item above</strong> to see strict-match recipes.
             </div>
        )}

        {loading && <p className="loading-text">Analyzing your pantry...</p>}

        <div className="suggestions-grid">
          {!loading && suggestions.map((recipe, idx) => (
            <div className="recipe-card" key={idx} onClick={() => handleRecipeClick(recipe)}>
              <div className="recipe-image">
                <RecipeImage recipe={recipe} alt={recipe.name} />
              </div>
              <div className="recipe-content">
                <div className="recipe-tags">
                   <span className="tag meal">{recipe.meal_type}</span>
                   <span className="tag cuisine">{recipe.cuisine}</span>
                </div>
                <h3>{recipe.name}</h3>
                <div className="recipe-meta">
                  <span>⏱️ {recipe.time}</span>
                  {recipe.missing_count > 0 && <span style={{color: '#e53e3e', fontSize: '0.85rem'}}>Missing {recipe.missing_count} items</span>}
                </div>
                <button className="cook-btn" onClick={(e) => { e.stopPropagation(); handleCookClick(recipe); }}>Cook This</button>
              </div>
            </div>
          ))}
        </div>
        
        {!loading && selectedItem && suggestions.length === 0 && (
          <div style={{ padding: "30px", textAlign: "center", background: "#fffbe6", borderRadius: "12px", border: "1px solid #ffe58f", margin: "20px 0" }}>
            <h3 style={{ margin: 0, color: "#873800", fontSize: "1.1rem", fontWeight: "800" }}>
              🛒 Pantry Stock Low — Time for a Market Trip!
            </h3>
            <p style={{ margin: "6px 0 0 0", color: "#613400", fontSize: "0.88rem" }}>
              No recipes match your current inventory combination for <strong>{selectedItem.item}</strong>. Add staple vegetables or generate a Market Restock Plan below!
            </p>
          </div>
        )}
      </section>

      {/* --- SECTION 3: MARKET TRIP & INVENTORY DEPLETION MEAL PLAN --- */}
      <section className="plan-section" style={{marginTop: '2.5rem', borderTop: '2px dashed rgba(46, 125, 50, 0.2)', paddingTop: '1.5rem'}}>
        
        {/* Ultra-Premium Market Run & Goal Config Card */}
        <div className="market-config-card" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 253, 244, 0.95) 100%)', padding: '1.5rem', borderRadius: '20px', border: '1.5px solid rgba(34, 197, 94, 0.25)', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '800' }}>
                🛒 Market Trip & Goal-Optimized Planner
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#15803d', fontWeight: '500' }}>
                Generates a meal schedule prioritized by your selected nutrition goal & pantry stock!
              </p>
            </div>

            {/* AI Market Predictor Banner */}
            {marketPrediction && (
              <div style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', padding: '6px 14px', borderRadius: '20px', border: '1px solid #38bdf8', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(56, 189, 248, 0.15)' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '900', color: '#0369a1' }}>🤖 AI Market Predictor:</span>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#0284c7' }}>
                  Detected <strong>{marketPrediction.day_name}</strong> as restock day ({marketPrediction.confidence_score}% confidence).
                </span>
              </div>
            )}
          </div>

          {/* Goal Select Pills Bar */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: '800', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
              CHOOSE MEAL PLAN GOAL:
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: "zero_waste", label: "🌱 Zero-Waste Depletion", color: "#16a34a" },
                { id: "high_protein", label: "💪 High-Protein Muscle", color: "#ea580c" },
                { id: "low_calorie", label: "🔥 Low-Calorie Fitness", color: "#db2777" },
                { id: "quick_easy", label: "⚡ Quick & Easy (<25m)", color: "#0284c7" },
                { id: "balanced", label: "🎯 Balanced Everyday", color: "#7c3aed" }
              ].map(goal => (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setPlanGoal(goal.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: planGoal === goal.id ? `2px solid ${goal.color}` : '1px solid #cbd5e1',
                    background: planGoal === goal.id ? goal.color : '#ffffff',
                    color: planGoal === goal.id ? '#ffffff' : '#334155',
                    fontSize: '0.84rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: planGoal === goal.id ? `0 4px 14px ${goal.color}40` : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {goal.label}
                </button>
              ))}
            </div>
          </div>

          {/* Controls & Generate Button Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid rgba(34, 197, 94, 0.15)' }}>
            
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: '800', color: '#166534' }}>NEXT MARKET TRIP</label>
                <select
                  value={marketDay}
                  onChange={(e) => setMarketDay(Number(e.target.value))}
                  style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #a5d6a7', fontSize: '0.85rem', fontWeight: '800', color: '#15803d', background: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}
                >
                  <option value={2}>Day 2 Market Trip 🛒</option>
                  <option value={3}>Day 3 Market Trip 🛒 (Recommended)</option>
                  <option value={4}>Day 4 Market Trip 🛒</option>
                  <option value={5}>Day 5 Market Trip 🛒</option>
                  <option value={7}>Day 7 Weekly Market 🛒</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: '800', color: '#166534' }}>PLAN DURATION</label>
                <select
                  value={planDays}
                  onChange={(e) => setPlanDays(Number(e.target.value))}
                  style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #a5d6a7', fontSize: '0.85rem', fontWeight: '800', color: '#15803d', background: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}
                >
                  <option value={7}>7 Days Full Horizon</option>
                  <option value={3}>3 Days Short Horizon</option>
                </select>
              </div>
            </div>

            <button
              className="cook-btn"
              onClick={generatePlan}
              disabled={planLoading}
              style={{
                height: '42px',
                padding: '0.6rem 1.6rem',
                background: planGoal === "high_protein"
                  ? 'linear-gradient(135deg, #ea580c, #c2410c)'
                  : planGoal === "low_calorie"
                  ? 'linear-gradient(135deg, #db2777, #be185d)'
                  : planGoal === "quick_easy"
                  ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                  : planGoal === "balanced"
                  ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                  : 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '900',
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                transition: 'all 0.2s ease'
              }}
            >
              {planLoading
                ? "Optimizing..."
                : planGoal === "high_protein"
                ? "Generate High-Protein Plan 💪✨"
                : planGoal === "low_calorie"
                ? "Generate Low-Calorie Plan 🔥✨"
                : planGoal === "quick_easy"
                ? "Generate Quick 15-Min Plan ⚡✨"
                : planGoal === "balanced"
                ? "Generate Balanced Plan 🎯✨"
                : "Generate Zero-Waste Plan 🛒✨"}
            </button>
          </div>

          {/* Personalization Analytics & Zero-Waste Scorecard */}
          {mealPlan.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              
              {/* Regional & Personalization Analytics Pill */}
              <div style={{ background: '#eef2ff', padding: '0.85rem', borderRadius: '12px', border: '1px solid #c7d2fe' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#3730a3', display: 'block', marginBottom: '4px' }}>
                  🎯 Regional & Personalization Alignment
                </span>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#4338ca', marginBottom: '4px' }}>
                  {personalizationAnalytics?.regional_affinity_score || 92}% Cuisine Match
                </div>
                <span style={{ fontSize: '0.72rem', color: '#4338ca', display: 'block' }}>
                  Aligned with <strong>{personalizationAnalytics?.native_state_matched || "Punjab / North Indian"}</strong> regional food preferences.
                </span>
              </div>

              {/* Essential Inventory Match Pill */}
              <div style={{ background: '#fdf2f8', padding: '0.85rem', borderRadius: '12px', border: '1px solid #fbcfe8' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#9d174d', display: 'block', marginBottom: '4px' }}>
                  🍲 Pantry Essential Match
                </span>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#be185d', marginBottom: '4px' }}>
                  {personalizationAnalytics?.pantry_utilization_score || 88}% Key Items Utilized
                </div>
                <span style={{ fontSize: '0.72rem', color: '#be185d', display: 'block' }}>
                  Uses key necessary items (Dal, Paneer, Rice, Tomatoes, Spices) from active stock.
                </span>
              </div>

              {/* Zero-Waste Score Pill */}
              <div style={{ background: '#f0fdf4', padding: '0.85rem', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#166534' }}>🌱 Zero-Waste Pantry Depletion</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#15803d' }}>{zeroWasteScore}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#dcfce7', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${zeroWasteScore}%`, height: '100%', background: '#22c55e', borderRadius: '4px' }}></div>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#166534', marginTop: '4px', display: 'block' }}>
                  Pantry stock is timed to run out right on Market Day {marketDay}!
                </span>
              </div>

              {/* Depletion Milestones & Masterclasses */}
              <div style={{ background: '#fffbe6', padding: '0.85rem', borderRadius: '12px', border: '1px solid #ffe58f' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#873800', display: 'block', marginBottom: '4px' }}>
                  👨‍🍳 Masterclass Skills Taught This Week:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(personalizationAnalytics?.techniques_mastered || ["Tadka (Spice Tempering)", "Bhuna (Sautéing)", "Dum Simmering"]).map((tech, i) => (
                    <span key={i} style={{ background: '#fff1b8', color: '#613400', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
                      🎓 {tech}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Sync Gaps Action Button */}
        {mealPlan.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#1b4332', fontSize: '1.15rem' }}>
              📅 {planDays}-Day Schedule (Market Trip on Day {marketDay} 🛒)
            </h3>
            <button
              className="cook-btn"
              onClick={handleSyncGaps}
              disabled={syncingGaps}
              style={{ background: 'linear-gradient(135deg, #1098ad 0%, #0c8599 100%)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.88rem', fontWeight: '700', border: 'none', cursor: 'pointer' }}
            >
              {syncingGaps ? "Syncing..." : "⚡ Sync Missing Items to Shopping List"}
            </button>
          </div>
        )}

        {!mealPlan.length && !planLoading && (
          <p style={{ color: '#2d6a4f', fontStyle: 'italic', marginTop: '10px', textAlign: 'center' }}>
            Select your Next Market Trip Day above and click "Generate Zero-Waste Plan 🛒✨" to align your pantry stock!
          </p>
        )}

        {/* Plan Cards Grid */}
        {mealPlan.length > 0 && (
          <div className="plan-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            {mealPlan.map((day) => {
              const isMarket = day.is_market_day || day.day === marketDay;
              return (
                <div
                  key={day.day}
                  className="day-card"
                  style={{
                    background: isMarket ? '#f0fdf4' : '#ffffff',
                    padding: '1rem',
                    borderRadius: '12px',
                    boxShadow: '0 3px 12px rgba(0,0,0,0.04)',
                    border: isMarket ? '2px solid #22c55e' : '1px solid #e2e8f0',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #a5d6a7', paddingBottom: '6px', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, color: '#1b4332', fontSize: '1rem', fontWeight: '800' }}>Day {day.day}</h3>
                    {isMarket && (
                      <span style={{ background: '#22c55e', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '800' }}>
                        🛒 MARKET DAY
                      </span>
                    )}
                  </div>

                  {['breakfast', 'lunch', 'dinner'].map(meal => {
                    const item = day[meal];
                    const itemObj = typeof item === 'string' ? { name: item, RecipeName: item } : item;
                    const masterclass = itemObj?.cooking_masterclass;

                    return (
                      <div key={meal} style={{ marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '800', display: 'block', marginBottom: '2px' }}>{meal}</span>
                        {itemObj && (itemObj.name || itemObj.RecipeName) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <RecipeImage
                              recipe={itemObj}
                              alt={itemObj.name}
                              style={{ width: '42px', height: '42px', borderRadius: '8px', flexShrink: 0, border: '1px solid #cbd5e1' }}
                            />
                            <div>
                              <div onClick={() => handleRecipeClick(itemObj)} style={{ cursor: 'pointer', fontWeight: '700', color: '#1b5e20', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {meal === 'breakfast' ? '☀️' : meal === 'lunch' ? '🍛' : '🌙'} {itemObj.name || itemObj.RecipeName}
                              </div>
                              {masterclass && (
                                <span style={{ fontSize: '0.72rem', color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: '6px', fontWeight: '700', display: 'inline-block', marginTop: '2px' }}>
                                  🎓 {masterclass.technique} ({masterclass.skill_level})
                                </span>
                              )}
                            </div>
                          </div>
                        ) : <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>No strict match</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Market Trip Restock Shopping List Card */}
        {marketShoppingList.length > 0 && (
          <div style={{ marginTop: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🛒 Market Day Restock Order (For Day {marketDay} Market Run):
            </h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {marketShoppingList.map((shop, idx) => (
                <span key={idx} style={{ background: '#e2e8f0', color: '#1e293b', padding: '4px 10px', borderRadius: '14px', fontSize: '0.78rem', fontWeight: '700' }}>
                  + {shop.item} ({shop.quantity} {shop.unit})
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* --- MODAL 1: RECIPE DETAILS & CULINARY MASTERCLASS GUIDE --- */}
      {selectedRecipe && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0 }}>{selectedRecipe.name || selectedRecipe.RecipeName || "Recipe Details"}</h2>
                {selectedRecipe.cooking_masterclass && (
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '800', marginTop: '4px', display: 'inline-block' }}>
                    🎓 Masterclass: {selectedRecipe.cooking_masterclass.technique} • {selectedRecipe.cooking_masterclass.skill_level}
                  </span>
                )}
              </div>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>
            <div className="modal-body">
               {/* Exact Recipe Photo Banner */}
               <div style={{ width: '100%', height: '200px', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                 <RecipeImage
                   recipe={selectedRecipe}
                   alt={selectedRecipe.name || selectedRecipe.RecipeName}
                 />
               </div>

               {/* Chef Pro-Tip Callout */}
               {selectedRecipe.cooking_masterclass && (
                 <div style={{ background: '#fffbe6', padding: '0.85rem', borderRadius: '10px', border: '1px solid #ffe58f', marginBottom: '1rem' }}>
                   <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#873800', display: 'block', marginBottom: '2px' }}>
                     💡 Chef Pro-Tip for Perfect Flavor:
                   </span>
                   <span style={{ fontSize: '0.82rem', color: '#613400' }}>
                     {selectedRecipe.cooking_masterclass.pro_tip}
                   </span>
                 </div>
               )}

               <div className="modal-section">
                 <h3>🥘 Ingredients Required</h3>
                 <div className="ingredient-list">
                   {getIngredientsArray(selectedRecipe.ingredients_raw || selectedRecipe.Ingredients).map((ing, i) => (
                     <div key={i} className="ingredient-item">• {ing}</div>
                   ))}
                 </div>
               </div>

               {/* Masterclass Step-by-Step Cooking Walkthrough */}
               <div className="modal-section" style={{ marginTop: '1rem' }}>
                  <h3>👨‍🍳 Step-by-Step Masterclass Instructions</h3>
                  <div className="instructions-container">
                    {(selectedRecipe.cooking_masterclass?.step_by_step_guide || getInstructionsArray(selectedRecipe.instructions))
                        .map((step, i) => {
                           const stepTitle = typeof step === 'object' ? step.title : `Step ${i + 1}`;
                           const cleanStep = typeof step === 'object' ? step.instruction : String(step).trim().replace(/^\d+\.\s*/, '');
                           return (
                             <div key={i} className="instruction-step" style={{ display: 'flex', gap: '12px', marginBottom: '10px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
                               <span className="step-number" style={{
                                   background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', 
                                   borderRadius: '50%', width: '26px', height: '26px', 
                                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                                   fontSize: '0.8rem', fontWeight: '800', flexShrink: 0
                               }}>
                                  {i + 1}
                               </span>
                               <div>
                                 <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.85rem', display: 'block' }}>{stepTitle}</span>
                                 <span style={{ lineHeight: '1.5', color: '#475569', fontSize: '0.85rem' }}>{cleanStep}</span>
                               </div>
                             </div>
                           );
                        })
                    }
                  </div>
               </div>
               <button className="cook-btn" onClick={() => { closeModal(); handleCookClick(selectedRecipe); }}>I Cooked This! (Deduct Stock)</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: CONFIRM INGREDIENTS (WITH AUTO-SCALING) --- */}
      {isCookModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '500px'}}>
            <div className="modal-header">
                <h2>Confirm Ingredients</h2>
                <div style={{fontSize:'0.9rem', color:'#718096', marginTop:'5px'}}>
                    Scaled for <strong>{peopleCount} People</strong>
                </div>
            </div>
            
            <div className="ingredient-list-scroll">
              {cookIngredients.map((ing, idx) => (
                <div key={idx} className="ingredient-row">
                  <span className="ing-name">{ing.item}</span>
                  <input type="number" step="any" value={ing.quantity} onChange={(e) => updateIngredient(idx, "quantity", e.target.value)} className="ing-qty" />
                  <select value={ing.unit} onChange={(e) => updateIngredient(idx, "unit", e.target.value)} className="ing-unit">
                     <option value="pieces">pcs</option>
                     <option value="kg">kg</option>
                     <option value="g">g</option>
                     <option value="l">l</option>
                     <option value="ml">ml</option>
                     <option value="cup">cup</option>
                     <option value="tbsp">tbsp</option>
                  </select>
                  <button onClick={() => removeIngredient(idx)} className="remove-ing-btn">✕</button>
                </div>
              ))}
            </div>
            <div className="modal-actions">
               <button className="cancel-btn" onClick={() => setIsCookModalOpen(false)}>Cancel</button>
               <button className="confirm-btn" onClick={confirmCook} disabled={cookingLoading}>
                 {cookingLoading ? "Updating..." : "✅ Confirm & Deduct"}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}