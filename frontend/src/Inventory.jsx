import { useEffect, useState } from "react";

const BASE_URL = "http://127.0.0.1:8000";

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Load inventory
  async function fetchInventory() {
    const res = await fetch(`${BASE_URL}/inventory`);
    const data = await res.json();
    setInventory(data);
  }

  // Add / Increment item
  async function addItem(item, unit = "unit", qty = 1) {
    await fetch(`${BASE_URL}/inventory/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item,
        quantity: qty,
        unit
      })
    });

    fetchInventory();
  }

  // Decrement item
  async function removeItem(item) {
    await fetch(`${BASE_URL}/inventory/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item })
    });

    fetchInventory();
  }

  // Add new item from input
  function handleNewItem() {
    if (!itemName.trim() || quantity <= 0) return;

    addItem(itemName.toLowerCase(), "unit", quantity);
    setItemName("");
    setQuantity(1);
  }

  useEffect(() => {
    fetchInventory();
  }, []);

  return (
    <div style={styles.container}>
      <h2>🧺 My Inventory</h2>

      {/* Add Item Box */}
      <div style={styles.addBox}>
        <input
          placeholder="Enter item name"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />

        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          style={{ width: "70px" }}
        />

        <button
          onClick={handleNewItem}
          disabled={!itemName.trim() || quantity <= 0}
        >
          + Add
        </button>
      </div>

      {/* Inventory List */}
      {inventory.map((item) => (
        <div key={item.item} style={styles.itemRow}>
          <span>{item.item}</span>
          <div>
            <button onClick={() => removeItem(item.item)}>-</button>
            <span style={{ margin: "0 10px" }}>
              {item.quantity} {item.unit}
            </span>
            <button onClick={() => addItem(item.item, item.unit, 1)}>+</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "420px",
    margin: "40px auto",
    padding: "20px",
    border: "1px solid #ddd",
    borderRadius: "10px",
    fontFamily: "Arial"
  },
  addBox: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px"
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "1px solid #eee"
  }
};
