// src/pages/Donations.jsx
import { useState, useEffect } from "react";
import { FaCheckCircle, FaTimesCircle, FaTruck, FaUsers, FaHandHoldingHeart } from "react-icons/fa";
import { useAuth } from "../AuthContext";
import "../assets/styles/donations.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function Donations() {
  const { currentUser, getAuthHeaders } = useAuth();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState("");
  const [newDonation, setNewDonation] = useState({
    donor: currentUser?.displayName || "",
    food_item: "",
    quantity: "",
    unit: "pieces",
    cookingTime: "0",
    area: "",
    pickup_type: "Porch Pickup / Delivery",
    notes: "",
    deduct_from_pantry: true,
  });
  const [message, setMessage] = useState({ text: "", type: "info" });
  const [submitting, setSubmitting] = useState(false);

  // Fetch donations from backend
  const fetchDonations = async (areaFilter = "") => {
    try {
      setLoading(true);
      const url = areaFilter 
        ? `${BASE_URL}/community/donations?area=${encodeURIComponent(areaFilter)}` 
        : `${BASE_URL}/community/donations`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDonations(data);
      }
    } catch (err) {
      console.warn("Failed to load community donations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations(selectedArea);
  }, [selectedArea]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewDonation((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const addDonation = async (e) => {
    if (e) e.preventDefault();
    if (!newDonation.food_item || !newDonation.quantity || !newDonation.area) {
      setMessage({ text: "⚠️ Please fill all required fields: Item, Quantity & Area.", type: "error" });
      return;
    }

    const cookingTimeInt = parseInt(newDonation.cookingTime || "0", 10);
    if (cookingTimeInt > 240) {
      setMessage({ 
        text: "⛔ Food Safety Floor: Cooked food older than 4 hours (240 mins) cannot be distributed.", 
        type: "error" 
      });
      return;
    }

    try {
      setSubmitting(true);
      const headers = getAuthHeaders ? getAuthHeaders() : {
        "Content-Type": "application/json",
        "X-User-Id": currentUser?.uid || "demo_user"
      };

      const payload = {
        donor_name: newDonation.donor || currentUser?.displayName || "Community Foodie",
        food_item: newDonation.food_item,
        quantity: parseFloat(newDonation.quantity),
        unit: newDonation.unit,
        cooking_time_mins: cookingTimeInt,
        area: newDonation.area,
        pickup_type: newDonation.pickup_type,
        notes: newDonation.notes,
        deduct_from_pantry: newDonation.deduct_from_pantry
      };

      const res = await fetch(`${BASE_URL}/community/donations`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to submit donation");
      }

      const resData = await res.json();
      setMessage({ text: "🎉 Food donation listed for the community! Thank you for reducing waste.", type: "success" });
      setNewDonation({
        donor: currentUser?.displayName || "",
        food_item: "",
        quantity: "",
        unit: "pieces",
        cookingTime: "0",
        area: "",
        pickup_type: "Porch Pickup / Delivery",
        notes: "",
        deduct_from_pantry: true,
      });
      fetchDonations(selectedArea);
      setTimeout(() => setMessage({ text: "", type: "info" }), 5000);
    } catch (err) {
      setMessage({ text: `❌ ${err.message}`, type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaim = async (donationId) => {
    const claimer = prompt("Enter your Name or NGO Organization to claim this food:");
    if (!claimer) return;

    try {
      const headers = getAuthHeaders ? getAuthHeaders() : {
        "Content-Type": "application/json",
        "X-User-Id": currentUser?.uid || "demo_user"
      };
      const res = await fetch(`${BASE_URL}/community/donations/${donationId}/claim`, {
        method: "POST",
        headers,
        body: JSON.stringify({ claimer_name: claimer })
      });
      if (res.ok) {
        alert("🎉 Food claimed successfully! Contact details shared.");
        fetchDonations(selectedArea);
      }
    } catch (err) {
      alert("Failed to claim donation: " + err.message);
    }
  };

  return (
    <div className="donations-page">
      <header className="header-container">
        <div className="glass-header" style={{ color: "#ffffff" }}>
          <h1 style={{ color: "#ffffff", textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>
            🌱 Community Food Surplus & Donations
          </h1>
          <p style={{ color: "#f8fafc", fontWeight: 600, textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
            Connect surplus pantry items directly to local shelters, NGOs, and neighbors in need. Zero Food Waste.
          </p>
        </div>
      </header>

      {/* Donation Form */}
      <div className="donation-form-container">
        <h2>Post Food Donation</h2>
        
        {/* Row 1: Food Item & Quantity + Unit */}
        <div className="form-row">
          <input
            className="donation-input"
            type="text"
            name="food_item"
            placeholder="Food Item (e.g., Basmati Rice, Fresh Apples)"
            value={newDonation.food_item}
            onChange={handleInputChange}
            required
          />
          <input
            className="donation-input"
            type="number"
            step="any"
            name="quantity"
            placeholder="Quantity"
            value={newDonation.quantity}
            onChange={handleInputChange}
            required
          />
          <select
            className="donation-input"
            name="unit"
            value={newDonation.unit}
            onChange={handleInputChange}
            style={{ maxWidth: "140px" }}
          >
            <option value="pieces">pieces</option>
            <option value="kg">kg</option>
            <option value="g">grams</option>
            <option value="liter">liters</option>
            <option value="servings">servings</option>
            <option value="packets">packets</option>
          </select>
        </div>

        {/* Row 2: Donor Name & Area */}
        <div className="form-row">
          <input
            className="donation-input"
            type="text"
            name="donor"
            placeholder="Your Name or Organization"
            value={newDonation.donor}
            onChange={handleInputChange}
          />
          <input
            className="donation-input"
            type="text"
            name="area"
            placeholder="Neighborhood / Area (e.g. Indiranagar, Bangalore)"
            value={newDonation.area}
            onChange={handleInputChange}
            required
          />
        </div>

        {/* Row 3: Cooking Time & Pickup Type */}
        <div className="form-row">
          <div style={{ flex: 1, textAlign: "left" }}>
            <label style={{ fontSize: "0.82rem", color: "#4a5568", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Time Since Cooked (mins, 0 for raw pantry items):
            </label>
            <input
              className="donation-input"
              type="number"
              name="cookingTime"
              placeholder="Minutes (0 if fresh/uncooked)"
              value={newDonation.cookingTime}
              onChange={handleInputChange}
            />
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <label style={{ fontSize: "0.82rem", color: "#4a5568", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Handover Method:
            </label>
            <select
              className="donation-input"
              name="pickup_type"
              value={newDonation.pickup_type}
              onChange={handleInputChange}
            >
              <option value="Porch Pickup / Delivery">Porch Pickup / Doorstep</option>
              <option value="Direct Handover">Direct Handover</option>
              <option value="Area-based Pooling Hub">Area-based Pooling Hub</option>
            </select>
          </div>
        </div>

        {/* Row 4: Notes & Pantry Deduction Checkbox */}
        <div className="form-row" style={{ alignItems: "center" }}>
          <input
            className="donation-input"
            type="text"
            name="notes"
            placeholder="Optional Notes (e.g., Refrigerated, Vegetarian, Packaging info)"
            value={newDonation.notes}
            onChange={handleInputChange}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "10px 0", justifyContent: "flex-start" }}>
          <input
            type="checkbox"
            id="deduct_pantry"
            name="deduct_from_pantry"
            checked={newDonation.deduct_from_pantry}
            onChange={handleInputChange}
            style={{ width: "18px", height: "18px", cursor: "pointer" }}
          />
          <label htmlFor="deduct_pantry" style={{ fontSize: "0.9rem", color: "#2d3748", cursor: "pointer" }}>
            Deduct this item from my Food Sync pantry automatically
          </label>
        </div>

        <button className="donate-btn" onClick={addDonation} disabled={submitting}>
          {submitting ? "Listing Donation..." : "🤝 Post Donation to Community"}
        </button>

        {message.text && (
          <p className="message" style={{ color: message.type === "error" ? "#e53e3e" : "#2f855a" }}>
            {message.text}
          </p>
        )}
      </div>

      {/* Filter and List Section */}
      <div className="donations-list">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
          <h2 style={{ color: "#ffffff", textShadow: "0 2px 6px rgba(0,0,0,0.6)", margin: 0 }}>
            Active Community Listings ({donations.length})
          </h2>
          <input
            type="text"
            placeholder="🔍 Filter by area or city..."
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            style={{
              padding: "10px 16px",
              borderRadius: "20px",
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.9)",
              fontSize: "0.9rem",
              minWidth: "240px"
            }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#ffffff", padding: "40px" }}>
            🔄 Loading community donations...
          </div>
        ) : donations.length === 0 ? (
          <div style={{ textAlign: "center", background: "rgba(255,255,255,0.85)", padding: "40px", borderRadius: "16px" }}>
            <h3>No surplus food listings in this area yet.</h3>
            <p>Be the first to share your excess ingredients or home-cooked meal!</p>
          </div>
        ) : (
          <div className="donations-grid">
            {donations.map((donation) => {
              const cookTime = parseInt(donation.cooking_time_mins || donation.cookingTime || 0, 10);
              const isSafe = cookTime <= 240;
              const isClaimed = donation.status === "claimed";
              const foodName = donation.food_item || donation.foodItem || "Fresh Produce";
              const quantityDisplay = `${donation.quantity} ${donation.unit || "units"}`;

              return (
                <div 
                  key={donation.id} 
                  className="donation-card" 
                  style={{ opacity: isClaimed ? 0.65 : 1, position: "relative" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: "1.2rem" }}>{foodName}</h3>
                    {isClaimed ? (
                      <span style={{ background: "#718096", color: "white", fontSize: "0.75rem", padding: "2px 8px", borderRadius: "8px", fontWeight: "bold" }}>
                        CLAIMED
                      </span>
                    ) : (
                      <span style={{ background: "#38a169", color: "white", fontSize: "0.75rem", padding: "2px 8px", borderRadius: "8px", fontWeight: "bold" }}>
                        AVAILABLE
                      </span>
                    )}
                  </div>

                  <p style={{ margin: "4px 0", color: "#4a5568", fontSize: "0.9rem" }}>
                    <strong>Donor:</strong> {donation.donor_name || donation.donor}
                  </p>
                  <p style={{ margin: "4px 0", fontSize: "1rem", color: "#2b6cb0", fontWeight: 700 }}>
                    <strong>Quantity:</strong> {quantityDisplay}
                  </p>
                  <p style={{ margin: "4px 0", color: "#4a5568", fontSize: "0.9rem" }}>
                    <strong>Location:</strong> 📍 {donation.area}
                  </p>

                  <div className="status-row">
                    <strong>Safety:</strong>
                    {isSafe ? (
                      <span className="safe"><FaCheckCircle /> {cookTime === 0 ? "Pantry Fresh" : `Cooked ${cookTime}m ago`}</span>
                    ) : (
                      <span className="unsafe"><FaTimesCircle /> Expired ({cookTime}m ago)</span>
                    )}
                  </div>

                  <div className="status-row">
                    <strong>Pickup:</strong>
                    <span className="pickup"><FaTruck /> {donation.pickup_type || "Pickup"}</span>
                  </div>

                  {donation.notes && (
                    <p style={{ fontSize: "0.85rem", fontStyle: "italic", color: "#718096", margin: "8px 0" }}>
                      "{donation.notes}"
                    </p>
                  )}

                  <p className="distribution">
                    <FaUsers /> Community Shelter / NGO / Local Pickup
                  </p>

                  {!isClaimed && (
                    <button
                      onClick={() => handleClaim(donation.id)}
                      style={{
                        marginTop: "12px",
                        width: "100%",
                        padding: "10px",
                        background: "linear-gradient(135deg, #319795 0%, #285e61 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                      }}
                    >
                      <FaHandHoldingHeart /> Claim this Food
                    </button>
                  )}
                  {isClaimed && (
                    <div style={{ marginTop: "10px", fontSize: "0.85rem", color: "#4a5568", textAlign: "center" }}>
                      Claimed by: <strong>{donation.claimed_by || "Community Hero"}</strong>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}