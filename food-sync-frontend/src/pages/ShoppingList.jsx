import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import "../assets/styles/shopping_list.css"; 

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function ShoppingList() {
  const { getAuthHeaders, currentUser } = useAuth();
  
  const [list, setList] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("pieces");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- Load List ---
  const fetchList = async () => {
    try {
      const res = await fetch(`${BASE_URL}/shopping-list`, { headers: getAuthHeaders() });
      if(res.ok) {
        const data = await res.json();
        setList(data);
      }
    } catch(e) {
      console.error("Fetch list failed", e);
    }
  };

  useEffect(() => {
    if (currentUser) fetchList();
  }, [currentUser]);

  // --- Autocomplete ---
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setNewItem(val);
    if (val.length > 1) {
       fetch(`${BASE_URL}/suggest?q=${val}`)
         .then(r => r.json())
         .then(data => setSuggestions(data))
         .catch(() => setSuggestions([]));
    } else {
       setSuggestions([]);
    }
  };

  const selectSuggestion = (s) => {
    setNewItem(s.canonical);
    setUnit(s.default_unit || "pieces");
    setSuggestions([]);
  };

  // --- Actions ---

  // FIX APPLIED HERE: Updates list immediately after adding
  const addItem = async (e) => {
    e.preventDefault();
    if(!newItem) return;

    try {
      const res = await fetch(`${BASE_URL}/shopping-list/add`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ item: newItem, quantity: quantity, unit: unit })
      });

      if (res.ok) {
        const updatedList = await res.json(); // Get the new list from backend
        setList(updatedList); // Update UI immediately
        
        // Reset inputs
        setNewItem("");
        setQuantity(1);
      }
    } catch (error) {
      console.error("Failed to add item", error);
    }
  };

  const toggleCheck = async (item) => {
    const originalList = [...list];
    
    // Optimistic toggle
    setList(prev => prev.map(it => 
      it.item === item.item ? { ...it, checked: !it.checked } : it
    ));

    try {
      const res = await fetch(`${BASE_URL}/shopping-list/toggle`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ item: item.item })
      });
      if (!res.ok) throw new Error("Toggle check failed");
      const updatedList = await res.json();
      setList(updatedList);
    } catch (error) {
      console.error("Failed to toggle item", error);
      setList(originalList); // Rollback
    }
  };

  const removeItem = async (item) => {
    const originalList = [...list];
    // Optimistic Update: remove item locally
    setList(prev => prev.filter(it => it.item !== item.item));

    try {
      const res = await fetch(`${BASE_URL}/shopping-list/remove`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ item: item.item })
      });
      if (!res.ok) throw new Error("Remove failed");
      const updatedList = await res.json();
      setList(updatedList);
    } catch (error) {
      console.error("Failed to remove item", error);
      setList(originalList); // Rollback on error
    }
  };

  const handleBuy = async () => {
    if(!window.confirm("Move checked items to Inventory?")) return;
    setLoading(true);
    await fetch(`${BASE_URL}/shopping-list/buy`, {
        method: 'POST',
        headers: getAuthHeaders()
    });
    await fetchList();
    setLoading(false);
    alert("Items added to your Inventory! 🎒");
  };

  const handleWhatsAppShare = () => {
    if (list.length === 0) return;

    // Separate pending and checked items
    const pendingItems = list.filter(i => !i.checked);
    const boughtItems = list.filter(i => i.checked);

    let message = `*My Grocery Shopping List* 🛒\n\n`;

    if (pendingItems.length > 0) {
      message += `*Pending Items:*\n`;
      pendingItems.forEach(item => {
        message += `- [ ] ${item.item} (${item.quantity} ${item.unit})\n`;
      });
      message += `\n`;
    }

    if (boughtItems.length > 0) {
      message += `*Bought Items:*\n`;
      boughtItems.forEach(item => {
        message += `- [x] ~${item.item}~ (${item.quantity} ${item.unit})\n`;
      });
    }

    const encodedMessage = encodeURIComponent(message.trim());
    window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
  };

  return (
    <div className="shopping-list-page">
      <header className="inventory-header">
         <h1>🛒 Shopping List</h1>
         <p>Plan your next grocery run. Checked items move to Inventory.</p>
      </header>

      {/* Add Item Form */}
      <form onSubmit={addItem} className="shopping-form">
        <div className="search-group">
            <input 
              type="text" 
              value={newItem} 
              onChange={handleSearchChange} 
              placeholder="Add item (e.g. Milk)..." 
              className="search-input"
              style={{width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0'}}
            />
            {suggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {suggestions.slice(0,5).map(s => (
                      <div key={s.canonical} className="suggestion-item" onClick={() => selectSuggestion(s)}>
                        {s.display}
                      </div>
                  ))}
                </div>
            )}
        </div>

        <div className="qty-group">
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="0.1" step="any" />
            <select value={unit} onChange={e => setUnit(e.target.value)}>
                <option>pieces</option>
                <option>kg</option>
                <option>liter</option>
                <option>pack</option>
                <option>box</option>
            </select>
        </div>

        <button type="submit" className="add-btn">Add</button>
      </form>

      {/* List Display */}
      <div className="shopping-list-container">
         {list.length === 0 && <p className="empty-msg">Your list is empty. Start adding items!</p>}
         
         {list.map((item, idx) => (
             <div key={idx} className={`shopping-item-card ${item.checked ? 'checked' : ''}`}>
                 <div className="item-left">
                     <input 
                        type="checkbox" 
                        checked={item.checked} 
                        onChange={() => toggleCheck(item)} 
                        className="checkbox-custom"
                     />
                     <div className="item-info">
                        <h3>{item.item}</h3>
                        <span>{item.quantity} {item.unit}</span>
                     </div>
                 </div>
                 <button onClick={() => removeItem(item)} className="delete-btn" title="Remove item">✕</button>
             </div>
         ))}
      </div>

      {/* Action Bar */}
      {list.length > 0 && (
          <div className="buy-action-bar" style={{ display: "flex", gap: "10px" }}>
              <button
                 type="button"
                 onClick={handleWhatsAppShare}
                 className="share-whatsapp-btn"
                 style={{
                     background: "#25D366",
                     color: "white",
                     border: "none",
                     padding: "1rem 2rem",
                     borderRadius: "50px",
                     fontSize: "1.1rem",
                     fontWeight: "bold",
                     cursor: "pointer",
                     boxShadow: "0 4px 15px rgba(37, 211, 102, 0.3)",
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                     transition: "all 0.2s ease"
                 }}
              >
                 🟢 Share List
              </button>
              {list.some(i => i.checked) && (
                  <button onClick={handleBuy} disabled={loading} className="buy-btn">
                     {loading ? "Syncing..." : "🛍️ Done Shopping"}
                  </button>
              )}
          </div>
      )}
    </div>
  );
}