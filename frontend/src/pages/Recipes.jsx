import { useEffect, useMemo, useState } from "react";
import "../assets/styles/recipes.css";

const BASE_URL = "http://127.0.0.1:8000";

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("");
  const [cuisines, setCuisines] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const loadRecipes = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append("q", searchQuery.trim());
      }
      if (selectedCuisine) {
        params.append("cuisine", selectedCuisine);
      }
      params.append("limit", "100");

      const res = await fetch(`${BASE_URL}/recipes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load recipes");
      const data = await res.json();
      setRecipes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Failed to load recipes. Please try again.");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCuisines = async () => {
    try {
      const res = await fetch(`${BASE_URL}/recipes/cuisines`);
      if (!res.ok) throw new Error("Failed to load cuisines");
      const data = await res.json();
      setCuisines(Array.isArray(data) ? data : []);
    } catch (err) {
      // Silently fail for cuisines
      setCuisines([]);
    }
  };

  useEffect(() => {
    loadCuisines();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadRecipes();
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedCuisine]);

  const filteredRecipes = useMemo(() => {
    return recipes;
  }, [recipes]);

  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
  };

  const closeModal = () => {
    setSelectedRecipe(null);
  };

  const formatTime = (minutes) => {
    if (!minutes || minutes === 0) return "N/A";
    if (minutes < 60) return `${minutes} mins`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="recipes-page">
      <div className="recipes-header">
        <div>
          <h1>Recipes</h1>
          <p className="recipes-subtitle">
            Discover delicious recipes and find dishes you can make with your
            ingredients.
          </p>
        </div>

        <div className="recipes-filters">
          <button
            type="button"
            className={
              selectedCuisine === ""
                ? "recipes-filter active"
                : "recipes-filter"
            }
            onClick={() => setSelectedCuisine("")}
          >
            All Cuisines
          </button>
          {cuisines.map((cuisine) => (
            <button
              key={cuisine}
              type="button"
              className={
                selectedCuisine === cuisine
                  ? "recipes-filter active"
                  : "recipes-filter"
              }
              onClick={() => setSelectedCuisine(cuisine)}
            >
              {cuisine}
            </button>
          ))}
        </div>

        <div className="recipes-search">
          <div className="form-group">
            <label htmlFor="recipe-search">Search Recipes</label>
            <input
              id="recipe-search"
              type="text"
              placeholder="Search by name or ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ minWidth: "180px" }}>
            <label htmlFor="cuisine-select">Cuisine</label>
            <select
              id="cuisine-select"
              value={selectedCuisine}
              onChange={(e) => setSelectedCuisine(e.target.value)}
            >
              <option value="">All</option>
              {cuisines.map((cuisine) => (
                <option key={cuisine} value={cuisine}>
                  {cuisine}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="recipes-error">{error}</p>}

      {loading && (
        <p className="recipes-loading">Loading recipes...</p>
      )}

      {!loading && filteredRecipes.length === 0 && !error && (
        <p className="recipes-loading">
          No recipes found. Try adjusting your search or filters.
        </p>
      )}

      {!loading && filteredRecipes.length > 0 && (
        <div className="recipes-grid">
          {filteredRecipes.map((recipe, index) => (
            <div
              className="recipe-card"
              key={`${recipe.name}-${index}`}
              onClick={() => handleRecipeClick(recipe)}
            >
              {recipe.image_url && (
                <img
                  src={recipe.image_url}
                  alt={recipe.name}
                  className="recipe-card-image"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              )}
              <div className="recipe-card-content">
                <div className="recipe-card-header">
                  <h3>{recipe.name}</h3>
                  {recipe.cuisine && (
                    <span className="recipe-card-cuisine">
                      {recipe.cuisine}
                    </span>
                  )}
                </div>
                <div className="recipe-card-meta">
                  <span className="recipe-card-time">
                    ⏱️ {formatTime(recipe.time)}
                  </span>
                  {recipe.ingredient_count > 0 && (
                    <span>📦 {recipe.ingredient_count} ingredients</span>
                  )}
                </div>
                {recipe.ingredients && recipe.ingredients.length > 0 && (
                  <div className="recipe-card-ingredients">
                    <div className="recipe-card-ingredients-title">
                      Ingredients:
                    </div>
                    <div className="recipe-card-ingredients-list">
                      {recipe.ingredients.slice(0, 5).map((ing, idx) => (
                        <span key={idx} className="recipe-card-ingredient-tag">
                          {ing}
                        </span>
                      ))}
                      {recipe.ingredients.length > 5 && (
                        <span className="recipe-card-ingredient-tag">
                          +{recipe.ingredients.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="recipe-card-actions">
                  <button
                    className="recipe-card-button primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRecipeClick(recipe);
                    }}
                  >
                    View Recipe
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRecipe && (
        <div className="recipe-modal" onClick={closeModal}>
          <div
            className="recipe-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="recipe-modal-close" onClick={closeModal}>
              ×
            </button>
            {selectedRecipe.image_url && (
              <img
                src={selectedRecipe.image_url}
                alt={selectedRecipe.name}
                className="recipe-modal-image"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            )}
            <div className="recipe-modal-body">
              <div className="recipe-modal-header">
                <div>
                  <h2 className="recipe-modal-title">{selectedRecipe.name}</h2>
                  <div className="recipe-modal-meta">
                    {selectedRecipe.cuisine && (
                      <span>🍽️ {selectedRecipe.cuisine}</span>
                    )}
                    <span>⏱️ {formatTime(selectedRecipe.time)}</span>
                    {selectedRecipe.ingredient_count > 0 && (
                      <span>📦 {selectedRecipe.ingredient_count} ingredients</span>
                    )}
                  </div>
                </div>
              </div>

              {selectedRecipe.ingredients &&
                selectedRecipe.ingredients.length > 0 && (
                  <div className="recipe-modal-section">
                    <h3 className="recipe-modal-section-title">Ingredients</h3>
                    <ul className="recipe-modal-ingredients-list">
                      {selectedRecipe.ingredients.map((ing, idx) => (
                        <li key={idx}>{ing}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {selectedRecipe.instructions && (
                <div className="recipe-modal-section">
                  <h3 className="recipe-modal-section-title">Instructions</h3>
                  <div className="recipe-modal-instructions">
                    {selectedRecipe.instructions}
                  </div>
                </div>
              )}

              {selectedRecipe.url && (
                <a
                  href={selectedRecipe.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="recipe-modal-link"
                >
                  View Full Recipe →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

