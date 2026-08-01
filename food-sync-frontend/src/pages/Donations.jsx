// src/pages/Donations.jsx
import { useState } from "react";
import { FaCheckCircle, FaTimesCircle, FaTruck, FaUsers } from "react-icons/fa";
import "../assets/styles/donations.css"; 

// Sample data
const sampleDonations = [
  { id: 1, donor: "Hostel Block A", quantity: 45, cookingTime: 120, area: "North Campus" },
  { id: 2, donor: "City Bakery", quantity: 15, cookingTime: 200, area: "Main Market" }
];

export default function Donations() {
  const [donations, setDonations] = useState(sampleDonations);
  const [newDonation, setNewDonation] = useState({
    donor: "",
    quantity: "",
    cookingTime: "",
    area: "",
  });
  const [message, setMessage] = useState("");

  const handleInputChange = (e) => {
    setNewDonation({ ...newDonation, [e.target.name]: e.target.value });
  };

  const addDonation = () => {
    if (
      !newDonation.donor ||
      !newDonation.quantity ||
      !newDonation.cookingTime ||
      !newDonation.area
    ) {
      setMessage("⚠️ Please fill all fields.");
      return;
    }

    const donationEntry = {
      id: donations.length + 1,
      donor: newDonation.donor,
      quantity: parseInt(newDonation.quantity),
      cookingTime: parseInt(newDonation.cookingTime),
      area: newDonation.area,
    };

    setDonations([...donations, donationEntry]);
    setMessage("🎉 Donation added successfully!");
    setNewDonation({ donor: "", quantity: "", cookingTime: "", area: "" });
    
    // Clear message after 3 seconds
    setTimeout(() => setMessage(""), 3000);
  };

  const checkSafety = (donation) => {
    return donation.cookingTime <= 240 ? "safe" : "unsafe";
  };

  const getPickupType = (donation) => {
    return donation.quantity >= 30 ? "Direct Donation" : "Area-based Pooling";
  };

  return (
    <div className="donations-page">
      <header className="header-container">
        <div className="glass-header">
          <h1>🌱 Food Donation Platform</h1>
          <p>Donate safely and help those in need</p>
        </div>
      </header>

      {/* EDITED: Removed the 'donations-content-wrapper'.
         The Form is now a standalone block on top.
      */}
      
      <div className="donation-form-container">
        <h2>Add Your Donation</h2>
        
        {/* Row 1: Donor Name & Area */}
        <div className="form-row">
            <input
              className="donation-input"
              type="text"
              name="donor"
              placeholder="Donor Name / Hostel"
              value={newDonation.donor}
              onChange={handleInputChange}
            />
            <input
              className="donation-input"
              type="text"
              name="area"
              placeholder="Area / Locality"
              value={newDonation.area}
              onChange={handleInputChange}
            />
        </div>

        {/* Row 2: Quantity & Time */}
        <div className="form-row">
            <input
              className="donation-input"
              type="number"
              name="quantity"
              placeholder="Quantity (in units)"
              value={newDonation.quantity}
              onChange={handleInputChange}
            />
            <input
              className="donation-input"
              type="number"
              name="cookingTime"
              placeholder="Time since cooked (minutes)"
              value={newDonation.cookingTime}
              onChange={handleInputChange}
            />
        </div>

        <button className="donate-btn" onClick={addDonation}>
          Donate Food
        </button>
        {message && <p className="message">{message}</p>}
      </div>

      {/* List Section (Now sits below the form) */}
      <div className="donations-list">
        <div className="donations-grid">
          {donations.map((donation) => {
            const safety = checkSafety(donation);
            const pickup = getPickupType(donation);
            return (
              <div key={donation.id} className="donation-card">
                <h3>{donation.donor}</h3>
                <p><strong>Quantity:</strong> {donation.quantity} units</p>
                <p><strong>Cooked:</strong> {donation.cookingTime} mins ago</p>
                <p><strong>Area:</strong> {donation.area}</p>
                
                <div className="status-row">
                  <strong>Safety:</strong>
                  {safety === "safe" ? (
                    <span className="safe"><FaCheckCircle /> Safe</span>
                  ) : (
                    <span className="unsafe"><FaTimesCircle /> Not Safe</span>
                  )}
                </div>

                <div className="status-row">
                  <strong>Pickup:</strong>
                  <span className="pickup"><FaTruck /> {pickup}</span>
                </div>

                <p className="distribution">
                  <FaUsers /> Distributed to: Slums / NGOs
                </p>
              </div>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}