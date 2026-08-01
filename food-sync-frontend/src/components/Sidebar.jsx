import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import "./Sidebar.css";

const Sidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="logo-icon">🍱</span>
        <span className="logo-text">Food Sync</span>
      </div>

      <nav className="nav">
        {/* 1. INVENTORY */}
        <NavLink
          to="/inventory"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <span className="icon">📦</span>
          <span className="nav-text">Inventory</span>
        </NavLink>

        {/* 2. MEAL PLANNING */}
        <NavLink
          to="/meal-planning"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <span className="icon">📋</span>
          <span className="nav-text">Meal Planning</span>
        </NavLink>

        {/* 3. RECIPES */}
        <NavLink
          to="/recipes"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <span className="icon">🍴</span>
          <span className="nav-text">Recipes</span>
        </NavLink>

        {/* 4. SHOPPING LIST */}
        <NavLink
          to="/shopping-list"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <span className="icon">🛒</span>
          <span className="nav-text">Shopping List</span>
        </NavLink>

        {/* 5. AI CHEF ASSISTANT */}
        <NavLink
          to="/assistant"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <span className="icon">🤖</span>
          <span className="nav-text">AI Chef Assistant</span>
        </NavLink>

        {/* 6. USER PROFILE */}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <span className="icon">👤</span>
          <span className="nav-text">Profile</span>
        </NavLink>

        {/* 7. LOGOUT */}
        <button 
          onClick={handleLogout} 
          className="nav-item logout-btn" 
          style={{ 
            marginTop: 'auto', 
            background: 'transparent', 
            border: 'none', 
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            color: '#e53e3e' 
          }}
        >
          <span className="icon">🚪</span>
          <span className="nav-text">Sign Out</span>
        </button>
      </nav>
    </aside>
  );
};

export default Sidebar;