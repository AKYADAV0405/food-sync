/**
 * Dynamic Recipe Image Resolution & Fallback System
 * 
 * Supports:
 * 1. Dynamic local asset lookup based on recipe ID or exact Slug
 * 2. Valid external image URL check
 * 3. High-definition category-specific fallback image selection
 */

// Category & Keyword specific fallback image library (Curated high-quality food photos)
export const CATEGORY_FALLBACK_IMAGES = {
  curry: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80",
  paneer: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80",
  dal: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80",
  rice: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
  south_indian: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80",
  soup: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80",
  dessert: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80",
  snack: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
  pasta: "https://images.unsplash.com/photo-1621996346565-e3d5d6281318?auto=format&fit=crop&w=600&q=80",
  meat: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80",
  default: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80"
};

// Dynamically discover any static recipe assets in local bundle
const localAssetModules = import.meta.glob('/src/assets/images/recipes/*.{png,jpg,jpeg,webp,svg}', { eager: true, import: 'default' });

// Pre-index local assets by id or slug
const localImageMap = {};
for (const path in localAssetModules) {
  const filename = path.split('/').pop();
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')).toLowerCase();
  localImageMap[nameWithoutExt] = localAssetModules[path];
}

/**
 * Determines category key based on recipe attributes
 */
export function getCategoryFallback(recipe) {
  if (!recipe) return CATEGORY_FALLBACK_IMAGES.default;

  const name = String(recipe.name || recipe.RecipeName || "").toLowerCase();
  const cuisine = String(recipe.cuisine || recipe.Cuisine || "").toLowerCase();
  const ingredients = Array.isArray(recipe.ingredients_raw) 
    ? recipe.ingredients_raw.join(" ").toLowerCase() 
    : String(recipe.Ingredients || "").toLowerCase();

  const combinedText = `${name} ${cuisine} ${ingredients}`;

  if (combinedText.includes("paneer") || combinedText.includes("tofu")) {
    return CATEGORY_FALLBACK_IMAGES.paneer;
  }
  if (combinedText.includes("biryani") || combinedText.includes("pulao") || combinedText.includes("fried rice") || combinedText.includes("khichdi")) {
    return CATEGORY_FALLBACK_IMAGES.rice;
  }
  if (combinedText.includes("dosa") || combinedText.includes("idli") || combinedText.includes("vada") || combinedText.includes("uttapam") || cuisine.includes("south indian")) {
    return CATEGORY_FALLBACK_IMAGES.south_indian;
  }
  if (combinedText.includes("dal") || combinedText.includes("lentil") || combinedText.includes("rajma") || combinedText.includes("chana") || combinedText.includes("chole")) {
    return CATEGORY_FALLBACK_IMAGES.dal;
  }
  if (combinedText.includes("chicken") || combinedText.includes("mutton") || combinedText.includes("fish") || combinedText.includes("lamb") || combinedText.includes("egg")) {
    return CATEGORY_FALLBACK_IMAGES.meat;
  }
  if (combinedText.includes("salad") || combinedText.includes("sprouts") || combinedText.includes("bowl")) {
    return CATEGORY_FALLBACK_IMAGES.salad;
  }
  if (combinedText.includes("soup") || combinedText.includes("broth") || combinedText.includes("shorba")) {
    return CATEGORY_FALLBACK_IMAGES.soup;
  }
  if (combinedText.includes("kheer") || combinedText.includes("halwa") || combinedText.includes("cake") || combinedText.includes("sweet") || combinedText.includes("dessert") || combinedText.includes("jamun")) {
    return CATEGORY_FALLBACK_IMAGES.dessert;
  }
  if (combinedText.includes("pasta") || combinedText.includes("spaghetti") || combinedText.includes("macaroni") || combinedText.includes("noodle")) {
    return CATEGORY_FALLBACK_IMAGES.pasta;
  }
  if (combinedText.includes("curry") || combinedText.includes("gravy") || combinedText.includes("masala") || combinedText.includes("korma") || combinedText.includes("kadhai")) {
    return CATEGORY_FALLBACK_IMAGES.curry;
  }
  if (combinedText.includes("samosa") || combinedText.includes("tikki") || combinedText.includes("pakora") || combinedText.includes("snack") || combinedText.includes("bhaji")) {
    return CATEGORY_FALLBACK_IMAGES.snack;
  }

  return CATEGORY_FALLBACK_IMAGES.default;
}

/**
 * Main dynamic image resolution utility
 * @param {Object|string|number} recipeOrId - Recipe object or ID/slug
 * @returns {string} - Resolved Image URL
 */
export function resolveRecipeImage(recipeOrId) {
  if (!recipeOrId) return CATEGORY_FALLBACK_IMAGES.default;

  let recipe = typeof recipeOrId === 'object' ? recipeOrId : { id: recipeOrId, slug: String(recipeOrId) };
  
  const id = recipe.id ? String(recipe.id) : null;
  const slug = recipe.slug ? String(recipe.slug).toLowerCase() : null;
  const nameSlug = recipe.name ? recipe.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null;

  // 1. Check local assets map by id, recipe_<id>, slug, or nameSlug
  if (id) {
    if (localImageMap[`recipe_${id}`]) return localImageMap[`recipe_${id}`];
    if (localImageMap[id]) return localImageMap[id];
  }
  if (slug && localImageMap[slug]) return localImageMap[slug];
  if (nameSlug && localImageMap[nameSlug]) return localImageMap[nameSlug];

  // 2. Check provided external image_url or image property
  const existingUrl = (recipe.image_url || recipe.image || "").trim();
  if (
    existingUrl && 
    typeof existingUrl === 'string' && 
    existingUrl.startsWith("http") && 
    !existingUrl.includes("via.placeholder.com") &&
    !existingUrl.includes("placeholder")
  ) {
    return existingUrl;
  }

  // 3. Fallback to category-specific image
  return getCategoryFallback(recipe);
}
