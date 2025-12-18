import { useEffect, useMemo, useState } from "react";
import "../assets/styles/inventory.css";

const BASE_URL = "http://127.0.0.1:8000";
const UNIT_OPTIONS = ["pieces", "kg", "liter", "pack", "box"];

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [form, setForm] = useState({
    item: "",
    canonicalItem: "",
    category: "",
    unit: "pieces",
    quantity: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [billItems, setBillItems] = useState([]);
  const [billLoading, setBillLoading] = useState(false);

  const groupedInventory = useMemo(() => {
    const groups = {};
    for (const item of inventory) {
      const key = item.category || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [inventory]);

  const [activeCategory, setActiveCategory] = useState("all");

  const CATEGORY_ORDER = [
    "vegetables",
    "fruits",
    "pulses_dals",
    "grains_cereals",
    "dairy",
    "spices_condiments",
    "oils_fats",
    "others",
  ];

  const suggestionLabels = useMemo(
    () => suggestions.map((s) => s.display),
    [suggestions]
  );

  const loadInventory = async () => {
    try {
      const res = await fetch(`${BASE_URL}/inventory`);
      const data = await res.json();
      setInventory(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load inventory");
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    const term = form.item.trim();
    if (!term) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const fetchSuggestions = async () => {
      try {
        setSuggestLoading(true);
        const res = await fetch(
          `${BASE_URL}/suggest?q=${encodeURIComponent(term)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("suggest failed");
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setSuggestLoading(false);
      }
    };

    fetchSuggestions();
    return () => controller.abort();
  }, [form.item]);

  const applyDefaultUnitIfMatch = (value) => {
    const lower = value.trim().toLowerCase();
    const match = suggestions.find(
      (s) =>
        s.display.toLowerCase() === lower ||
        s.canonical.toLowerCase() === lower
    );
    if (match) {
      setForm((prev) => ({
        ...prev,
        unit: match.default_unit,
        canonicalItem: match.canonical,
        category: match.category || prev.category,
      }));
    }
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const adjustQuantity = (delta) => {
    setForm((prev) => {
      const next = Math.max(1, (prev.quantity || 1) + delta);
      return { ...prev, quantity: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.item.trim()) {
      setError("Please enter an item name");
      return;
    }

    // Use canonical name if we have it, otherwise fall back to raw input
    const itemName = (form.canonicalItem || form.item).trim();

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/inventory/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: itemName,
          unit: form.unit,
          quantity: form.quantity,
          category: form.category,
        }),
      });
      if (!res.ok) throw new Error("Add failed");
      // Backend returns a message; fetch the latest inventory to reflect DB state
      await loadInventory();
      setForm({
        item: "",
        canonicalItem: "",
        category: "",
        unit: "pieces",
        quantity: 1,
      });
      setSuggestions([]);
    } catch (err) {
      setError("Could not add item. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateExistingQuantity = async (item, delta) => {
    if (!delta) return;
    setError("");

    try {
      const endpoint =
        delta > 0 ? `${BASE_URL}/inventory/add` : `${BASE_URL}/inventory/remove`;
      const body = {
        item: item.item,
        quantity: Math.abs(delta),
        unit: item.unit,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Update failed");
      await loadInventory();
    } catch (err) {
      setError("Could not update quantity. Please try again.");
    }
  };

  const handleBillUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setBillLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${BASE_URL}/bill/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Bill upload failed");
      const data = await res.json();
      setBillItems(data.detected || []);
      await loadInventory();
    } catch (err) {
      setError("Could not process bill. Please try again.");
    } finally {
      setBillLoading(false);
      // reset the input so the same file can be selected again if needed
      event.target.value = "";
    }
  };

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <div>
          <h1>🧺 Inventory</h1>
          <p className="inventory-subtitle">
            Add items with units/quantities and search as you type.
          </p>
        </div>
        <div className="inventory-filters">
          <button
            type="button"
            className={
              activeCategory === "all"
                ? "inventory-filter active"
                : "inventory-filter"
            }
            onClick={() => setActiveCategory("all")}
          >
            All
          </button>
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              className={
                activeCategory === cat
                  ? "inventory-filter active"
                  : "inventory-filter"
              }
              onClick={() => setActiveCategory(cat)}
            >
              {cat === "vegetables" && "Vegetables"}
              {cat === "fruits" && "Fruits"}
              {cat === "pulses_dals" && "Pulses / Dals"}
              {cat === "grains_cereals" && "Grains & Cereals"}
              {cat === "dairy" && "Dairy"}
              {cat === "spices_condiments" && "Spices & Condiments"}
              {cat === "oils_fats" && "Oils & Fats"}
              {cat === "others" && "Packaged / Others"}
            </button>
          ))}
        </div>
        <form className="inventory-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="item">Item</label>
            <input
              id="item"
              type="text"
              value={form.item}
              list="inventory-suggestions"
              placeholder="e.g. Tomatoes"
            onChange={(e) => {
              const value = e.target.value;
              setForm((prev) => ({
                ...prev,
                item: value,
                // reset canonical until we confirm a match again
                canonicalItem: "",
              }));
            }}
            onBlur={(e) => applyDefaultUnitIfMatch(e.target.value)}
            />
            <datalist id="inventory-suggestions">
            {suggestionLabels.map((label) => (
              <option value={label} key={label} />
              ))}
            </datalist>
          </div>

          <div className="form-group inline">
            <label htmlFor="unit">Unit</label>
            <select
              id="unit"
              value={form.unit}
              onChange={(e) => handleChange("unit", e.target.value)}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group inline">
            <label>Quantity</label>
            <div className="quantity-control">
              <button
                type="button"
                onClick={() => adjustQuantity(-1)}
                aria-label="Decrease quantity"
              >
                –
              </button>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) =>
                  handleChange("quantity", Math.max(1, Number(e.target.value)))
                }
              />
              <button
                type="button"
                onClick={() => adjustQuantity(1)}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Adding..." : "Add Item"}
          </button>
        </form>
      </div>

      <div className="inventory-bill-upload">
        <label className="bill-upload-label">
          <span>📤 Upload Bill (image)</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleBillUpload}
            style={{ display: "none" }}
          />
        </label>
        {billLoading && <p className="inventory-bill-status">Scanning bill…</p>}
        {!billLoading && billItems.length > 0 && (
          <div className="inventory-bill-results">
            <p className="inventory-bill-status">
              Detected items (added to inventory):
            </p>
            <ul>
              {billItems.map((bi, idx) => (
                <li key={`${bi.raw_line}-${idx}`}>
                  {bi.raw_name} →{" "}
                  {bi.resolved ? bi.canonical : "unknown item"} (
                  {bi.quantity} {bi.unit})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {error && <p className="inventory-error">{error}</p>}
      {inventory.length === 0 && !error && <p>No items found</p>}

      {CATEGORY_ORDER.map((categoryKey) => {
        const items = groupedInventory[categoryKey] || [];
        if (items.length === 0) return null;
        if (activeCategory !== "all" && activeCategory !== categoryKey) {
          return null;
        }

        const isVegetables = categoryKey === "vegetables";

        return (
          <section className="inventory-section" key={categoryKey}>
            <h2 className="inventory-category-heading">
              {categoryKey === "vegetables" && "🥬 Vegetables"}
              {categoryKey === "fruits" && "🍎 Fruits"}
              {categoryKey === "pulses_dals" && "🫘 Pulses / Dals"}
              {categoryKey === "grains_cereals" && "🌾 Grains & Cereals"}
              {categoryKey === "dairy" && "🥛 Dairy"}
              {categoryKey === "spices_condiments" &&
                "🌶️ Spices & Condiments"}
              {categoryKey === "oils_fats" && "🛢️ Oils & Fats"}
              {categoryKey === "others" && "📦 Packaged / Others"}
            </h2>
            <div className="inventory-grid">
              {items.map((item) => (
                <div className="inventory-card" key={item.item}>
                  <div className="inventory-card-main">
                    <h3>{item.item}</h3>
                    <p>
                      {item.quantity} {item.unit}
                    </p>
                  </div>
                  {isVegetables && (
                    <div className="inventory-card-actions">
                      <button
                        type="button"
                        onClick={() => updateExistingQuantity(item, -1)}
                        aria-label={`Decrease ${item.item}`}
                      >
                        –
                      </button>
                      <span className="inventory-card-qty">
                        {item.quantity} {item.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateExistingQuantity(item, 1)}
                        aria-label={`Increase ${item.item}`}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
