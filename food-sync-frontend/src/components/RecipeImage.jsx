import React, { useState, useEffect } from "react";
import { resolveRecipeImage, getCategoryFallback, CATEGORY_FALLBACK_IMAGES } from "../utils/recipeImageResolver";

/**
 * Universal Recipe Image Component with Loading Skeleton & Category-Specific Fallback
 */
export default function RecipeImage({ recipe, alt, className = "", style = {}, ...props }) {
  const resolvedSrc = resolveRecipeImage(recipe);
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const newSrc = resolveRecipeImage(recipe);
    setCurrentSrc(newSrc);
    setIsLoading(true);
    setHasError(false);
  }, [recipe]);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      // Try category fallback first
      const fallback = getCategoryFallback(recipe);
      if (fallback !== currentSrc) {
        setCurrentSrc(fallback);
      } else {
        // Universal default fallback
        setCurrentSrc(CATEGORY_FALLBACK_IMAGES.default);
      }
    } else {
      // If even fallback fails, set universal default
      setCurrentSrc(CATEGORY_FALLBACK_IMAGES.default);
      setIsLoading(false);
    }
  };

  return (
    <div className={`recipe-image-container ${className}`} style={{ position: "relative", overflow: "hidden", ...style }}>
      {isLoading && (
        <div className="recipe-image-skeleton" aria-hidden="true">
          <div className="skeleton-shimmer"></div>
        </div>
      )}
      <img
        {...props}
        src={currentSrc}
        alt={alt || (recipe ? recipe.name : "Recipe image")}
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          opacity: isLoading ? 0 : 1,
          transition: "opacity 0.3s ease, transform 0.3s ease"
        }}
      />
    </div>
  );
}
