import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { currentUser } = useAuth();

  return (
    <div className="dashboard-container" style={{ padding: "2rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ color: "#2d3748" }}>
          Welcome back, {currentUser?.displayName || "Chef"}! 👋
        </h1>
        <p style={{ color: "#718096" }}>
          Here is what's happening in your kitchen today.
        </p>
      </header>

      <div
        className="dashboard-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
        }}
      >
        {/* --- CARD 1: INVENTORY --- */}
        <Link to="/inventory" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "white",
              padding: "25px",
              borderRadius: "15px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0",
              cursor: "pointer",
              transition: "transform 0.2s",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "10px" }}>🥬</div>
            <h3 style={{ margin: 0, color: "#2d3748" }}>My Inventory</h3>
            <p style={{ color: "#718096", fontSize: "0.9rem" }}>
              Add items or check what's expiring soon.
            </p>
          </div>
        </Link>

        {/* --- CARD 2: MEAL PLAN --- */}
        <Link to="/meal-planning" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "white",
              padding: "25px",
              borderRadius: "15px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0",
              cursor: "pointer",
              transition: "transform 0.2s",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "10px" }}>📅</div>
            <h3 style={{ margin: 0, color: "#2d3748" }}>Meal Planner</h3>
            <p style={{ color: "#718096", fontSize: "0.9rem" }}>
              Generate a 3-day plan based on expiring items.
            </p>
          </div>
        </Link>

        {/* --- CARD 3: RECIPES --- */}
        <Link to="/recipes" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "white",
              padding: "25px",
              borderRadius: "15px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0",
              cursor: "pointer",
              transition: "transform 0.2s",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "10px" }}>📖</div>
            <h3 style={{ margin: 0, color: "#2d3748" }}>Browse Recipes</h3>
            <p style={{ color: "#718096", fontSize: "0.9rem" }}>
              Find thousands of recipes to cook today.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}