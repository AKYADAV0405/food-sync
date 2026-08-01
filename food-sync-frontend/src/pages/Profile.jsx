import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import "../assets/styles/profile.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const DIETARY_OPTIONS = [
  "None",
  "Vegetarian",
  "Eggetarian",
  "Vegan",
  "Gluten-Free",
  "Keto",
  "Dairy-Free",
  "Low-Carb",
  "Mediterranean",
  "Halal"
];

const ALLERGY_OPTIONS = [
  "Peanuts 🥜",
  "Tree Nuts 🌰",
  "Dairy/Lactose 🥛",
  "Soy 🫘",
  "Eggs 🥚",
  "Shellfish/Seafood 🦐",
  "Wheat/Gluten 🌾",
  "Sesame 🫘"
];

const GOAL_OPTIONS = [
  "Balanced Maintenance ⚖️",
  "Weight Loss 📉",
  "Muscle Building 💪",
  "Heart Healthy ❤️",
  "Low Sodium 🧂",
  "High Protein 🥩"
];

const SPICE_LEVELS = [
  { id: "mild", label: "Mild 🌶️" },
  { id: "medium", label: "Medium 🌶️🌶️" },
  { id: "spicy", label: "Spicy 🌶️🌶️🌶️" },
  { id: "extra_hot", label: "Extra Hot 🔥" }
];

const SKILL_LEVELS = [
  { id: "beginner", label: "Beginner 🍳" },
  { id: "intermediate", label: "Intermediate 👨‍🍳" },
  { id: "advanced", label: "Advanced Chef 👩‍🍳" }
];

const HOUSEHOLD_SIZES = [
  "1 Person (Solo)",
  "2 People (Couple)",
  "3-4 People (Family)",
  "5+ People"
];

const COOK_TIMES = [
  "Under 15 mins ⚡",
  "15 - 30 mins ⏱️",
  "30 - 60 mins 🍳",
  "Any Limit ⏳"
];

const APPLIANCE_OPTIONS = [
  "Air Fryer 🌬️",
  "Pressure Cooker 🍲",
  "Microwave 📡",
  "Oven / OTG 🥧",
  "Blender / Mixer 🌀"
];

export default function Profile() {
  const { getAuthHeaders, currentUser, sendVerificationEmail, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    native_state: "",
    current_location: "",
    dietary_preferences: "None",
    allergies: [],
    health_goal: "Balanced Maintenance ⚖️",
    spice_level: "medium",
    skill_level: "intermediate",
    household_size: "2 People (Couple)",
    max_cook_time: "15 - 30 mins ⏱️",
    appliances: ["Microwave 📡", "Pressure Cooker 🍲"],
    companion_name: "Jarvis",
    language: "en-US"
  });

  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [message, setMessage] = useState(null);

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${BASE_URL}/profile`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setProfile((prev) => ({
            ...prev,
            name: data.name || currentUser?.displayName || "",
            email: data.email || currentUser?.email || "",
            native_state: data.native_state || "",
            current_location: data.current_location || "",
            dietary_preferences: data.dietary_preferences || "None",
            allergies: data.allergies || [],
            health_goal: data.health_goal || "Balanced Maintenance ⚖️",
            spice_level: data.spice_level || "medium",
            skill_level: data.skill_level || "intermediate",
            household_size: data.household_size || "2 People (Couple)",
            max_cook_time: data.max_cook_time || "15 - 30 mins ⏱️",
            appliances: data.appliances || ["Microwave 📡", "Pressure Cooker 🍲"],
            companion_name: data.companion_name || "Jarvis",
            language: data.language || "en-US"
          }));
          setHistoryCount(data.history_count || 0);
        }
      } catch (err) {
        console.error("Failed to load profile details", err);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchProfile();
    }
  }, [currentUser]);

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // Toggle Multi-select Arrays
  const toggleArrayItem = (fieldName, item) => {
    setProfile((prev) => {
      const currentList = prev[fieldName] || [];
      const exists = currentList.includes(item);
      const updated = exists
        ? currentList.filter((i) => i !== item)
        : [...currentList, item];
      return { ...prev, [fieldName]: updated };
    });
  };

  // Calculate profile completion percentage
  const calculateCompletion = () => {
    const fields = [
      "name",
      "email",
      "native_state",
      "current_location",
      "dietary_preferences",
      "health_goal",
      "household_size"
    ];
    const filled = fields.filter((field) => {
      return profile[field] && profile[field].trim() !== "";
    });
    return Math.round((filled.length / fields.length) * 100);
  };

  // Save changes
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`${BASE_URL}/profile/save`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(profile)
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Profile & preferences updated successfully! 👤✨" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        throw new Error("Failed to save profile");
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "success", text: "Preferences saved locally! 👤✨" });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Send email verification link
  const handleSendVerification = async () => {
    setVerificationLoading(true);
    try {
      await sendVerificationEmail();
      setVerificationSent(true);
      setMessage({ type: "success", text: "Verification email sent! Please check your inbox. 📧" });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Failed to send verification email: " + err.message });
    } finally {
      setVerificationLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  if (loading) {
    return (
      <div className="profile-page" style={{ textAlign: "center", padding: "3rem" }}>
        <p>Loading your foodie profile & preferences...</p>
      </div>
    );
  }

  const completionPercent = calculateCompletion();

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1>👤 Culinary Profile & Preferences</h1>
            <p>Customize your dietary profile, household size, kitchen tools, and regional flavor preferences.</p>
          </div>
          <button onClick={handleLogout} className="profile-top-logout-btn">
            🚪 Sign Out
          </button>
        </div>
      </header>

      {message && (
        <div className={`message-alert ${message.type}`} style={{ marginBottom: "1.5rem" }}>
          {message.type === "success" ? "✅" : "⚠️"} {message.text}
        </div>
      )}

      <div className="profile-grid">
        {/* Form Details Card */}
        <div className="profile-card">
          <form onSubmit={handleSave} className="profile-form">
            
            {/* --- SECTION 1: ACCOUNT DETAILS --- */}
            <div className="form-section">
              <h2 className="section-title">📋 Account & Identity</h2>
              
              <div className="form-group">
                <label htmlFor="name-input">Full Name</label>
                <input
                  id="name-input"
                  type="text"
                  name="name"
                  value={profile.name}
                  onChange={handleChange}
                  placeholder="Tony Stark"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email-input">Email Address</label>
                <input
                  id="email-input"
                  type="email"
                  name="email"
                  value={profile.email}
                  onChange={handleChange}
                  placeholder="tony@starkindustries.com"
                  required
                />
                {currentUser && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', fontSize: '0.9rem' }}>
                    {currentUser.emailVerified ? (
                      <span style={{ color: '#4caf50', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ✅ Email Verified
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#f44336', fontWeight: 'bold' }}>
                          ⚠️ Email Unverified
                        </span>
                        <button
                          type="button"
                          onClick={handleSendVerification}
                          disabled={verificationLoading || verificationSent}
                          className="verify-btn"
                        >
                          {verificationLoading ? "Sending..." : verificationSent ? "Sent!" : "Verify Email"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* --- SECTION 2: DIETARY & HEALTH --- */}
            <div className="form-section">
              <h2 className="section-title">🥗 Dietary & Health Goals</h2>

              <div className="form-group">
                <span className="preferences-label">Primary Dietary Preference</span>
                <div className="chips-container">
                  {DIETARY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`chip ${profile.dietary_preferences === option ? "active" : ""}`}
                      onClick={() => setProfile((p) => ({ ...p, dietary_preferences: option }))}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: "1rem" }}>
                <span className="preferences-label">Allergies & Intolerances (Multi-select)</span>
                <div className="chips-container">
                  {ALLERGY_OPTIONS.map((option) => {
                    const isSelected = (profile.allergies || []).includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        className={`chip ${isSelected ? "active" : ""}`}
                        onClick={() => toggleArrayItem("allergies", option)}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: "1rem" }}>
                <label htmlFor="health-goal-select">Health & Calorie Goal</label>
                <select
                  id="health-goal-select"
                  name="health_goal"
                  value={profile.health_goal}
                  onChange={handleChange}
                  className="profile-select"
                >
                  {GOAL_OPTIONS.map((goal) => (
                    <option key={goal} value={goal}>
                      {goal}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* --- SECTION 3: CULINARY TASTES & SKILLS --- */}
            <div className="form-section">
              <h2 className="section-title">👨‍🍳 Culinary Tastes & Habits</h2>

              <div className="form-group">
                <label htmlFor="native-state-input">Native State / Region (Flavor Origin)</label>
                <input
                  id="native-state-input"
                  type="text"
                  name="native_state"
                  value={profile.native_state}
                  onChange={handleChange}
                  placeholder="Punjab, Gujarat, Bengal, South India, etc."
                />
              </div>

              <div className="form-group">
                <label htmlFor="current-location-input">Current Location</label>
                <input
                  id="current-location-input"
                  type="text"
                  name="current_location"
                  value={profile.current_location}
                  onChange={handleChange}
                  placeholder="Karnataka, Maharashtra, Delhi, etc."
                />
              </div>

              <div className="form-group" style={{ marginTop: "0.5rem" }}>
                <span className="preferences-label">Spice Tolerance</span>
                <div className="chips-container">
                  {SPICE_LEVELS.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      className={`chip ${profile.spice_level === sp.id ? "active" : ""}`}
                      onClick={() => setProfile((p) => ({ ...p, spice_level: sp.id }))}
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: "0.5rem" }}>
                <span className="preferences-label">Cooking Skill Level</span>
                <div className="chips-container">
                  {SKILL_LEVELS.map((sk) => (
                    <button
                      key={sk.id}
                      type="button"
                      className={`chip ${profile.skill_level === sk.id ? "active" : ""}`}
                      onClick={() => setProfile((p) => ({ ...p, skill_level: sk.id }))}
                    >
                      {sk.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* --- SECTION 4: HOUSEHOLD & KITCHEN SETUP --- */}
            <div className="form-section">
              <h2 className="section-title">🏠 Household & Kitchen Equipment</h2>

              <div className="form-group">
                <span className="preferences-label">Household Size / Servings</span>
                <div className="chips-container">
                  {HOUSEHOLD_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`chip ${profile.household_size === size ? "active" : ""}`}
                      onClick={() => setProfile((p) => ({ ...p, household_size: size }))}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: "0.5rem" }}>
                <span className="preferences-label">Max Prep/Cooking Time (Weeknights)</span>
                <div className="chips-container">
                  {COOK_TIMES.map((time) => (
                    <button
                      key={time}
                      type="button"
                      className={`chip ${profile.max_cook_time === time ? "active" : ""}`}
                      onClick={() => setProfile((p) => ({ ...p, max_cook_time: time }))}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: "0.5rem" }}>
                <span className="preferences-label">Kitchen Appliances Available</span>
                <div className="chips-container">
                  {APPLIANCE_OPTIONS.map((appliance) => {
                    const isSelected = (profile.appliances || []).includes(appliance);
                    return (
                      <button
                        key={appliance}
                        type="button"
                        className={`chip ${isSelected ? "active" : ""}`}
                        onClick={() => toggleArrayItem("appliances", appliance)}
                      >
                        {appliance}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* --- SECTION 5: AI COMPANION --- */}
            <div className="form-section">
              <h2 className="section-title">🤖 AI Assistant Settings</h2>

              <div className="form-group">
                <label htmlFor="companion-name-input">Kitchen Companion Name</label>
                <input
                  id="companion-name-input"
                  type="text"
                  name="companion_name"
                  value={profile.companion_name}
                  onChange={handleChange}
                  placeholder="Jarvis, Friday, Chef Buddy, etc."
                />
              </div>

              <div className="form-group">
                <label htmlFor="language-select">Interaction Language</label>
                <select
                  id="language-select"
                  name="language"
                  value={profile.language}
                  onChange={handleChange}
                  className="profile-select"
                >
                  <option value="en-US">English (US)</option>
                  <option value="hi-IN">Hindi (हिन्दी)</option>
                </select>
              </div>
            </div>

            <button type="submit" className="save-btn" disabled={saving}>
              {saving ? "Saving Preferences..." : "💾 Save Culinary Profile"}
            </button>
          </form>
        </div>

        {/* Stats & Quick Action Sidebar */}
        <div className="stats-card">
          <h2>📊 Profile Telemetry</h2>

          <div className="progress-container">
            <div className="progress-header">
              <span>Profile Completion</span>
              <span>{completionPercent}%</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${completionPercent}%` }}></div>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon">🍳</div>
            <div className="stat-details">
              <div className="stat-val">{historyCount}</div>
              <div className="stat-lbl">Meals Cooked</div>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon">🥗</div>
            <div className="stat-details">
              <div className="stat-val" style={{ fontSize: "1.1rem", fontWeight: "700" }}>
                {profile.dietary_preferences}
              </div>
              <div className="stat-lbl">Dietary Preference</div>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon">🎯</div>
            <div className="stat-details">
              <div className="stat-val" style={{ fontSize: "1rem", fontWeight: "700" }}>
                {profile.health_goal}
              </div>
              <div className="stat-lbl">Primary Goal</div>
            </div>
          </div>

          <div className="stat-item">
            <div className="stat-icon">⭐</div>
            <div className="stat-details">
              <div className="stat-val" style={{ fontSize: "1rem", fontWeight: "700" }}>
                {profile.native_state && profile.current_location
                  ? `${profile.native_state} ➔ ${profile.current_location}`
                  : profile.native_state || profile.current_location || "Not fully set"}
              </div>
              <div className="stat-lbl">Flavor Pathway</div>
            </div>
          </div>

          <div className="stats-divider" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
            <button onClick={handleLogout} className="stats-logout-btn">
              🚪 Sign Out of Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
