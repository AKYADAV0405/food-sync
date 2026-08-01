import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, NavLink } from "react-router-dom";
import { useAuth } from "../AuthContext";
import "./HeaderNav.css";

export default function HeaderNav() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef(null);

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleLogout = async () => {
    try {
      setDropdownOpen(false);
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const handleGoToProfile = () => {
    setDropdownOpen(false);
    navigate("/profile");
  };

  const displayName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "User";
  const userInitial = displayName.charAt(0).toUpperCase();

  const isCurrentPath = (path) => location.pathname === path;

  return (
    <header className="global-header-nav">
      <div className="header-left-brand" onClick={() => navigate("/recipes")} style={{ cursor: "pointer" }}>
        <span className="brand-icon">🍱</span>
        <div className="brand-text-container">
          <span className="brand-name">Food Sync</span>
          <span className="brand-tagline">Smart Kitchen</span>
        </div>
      </div>

      <nav className="header-center-links">
        <NavLink
          to="/recipes"
          className={({ isActive }) => `header-nav-item${isActive ? " active" : ""}`}
        >
          <span>🍴</span> Recipes
        </NavLink>

        <NavLink
          to="/inventory"
          className={({ isActive }) => `header-nav-item${isActive ? " active" : ""}`}
        >
          <span>📦</span> Inventory
        </NavLink>

        <NavLink
          to="/meal-planning"
          className={({ isActive }) => `header-nav-item${isActive ? " active" : ""}`}
        >
          <span>📋</span> Meal Plan
        </NavLink>

        <NavLink
          to="/shopping-list"
          className={({ isActive }) => `header-nav-item${isActive ? " active" : ""}`}
        >
          <span>🛒</span> Shopping List
        </NavLink>

        <NavLink
          to="/assistant"
          className={({ isActive }) => `header-nav-item${isActive ? " active" : ""}`}
        >
          <span>🤖</span> AI Chef
        </NavLink>
      </nav>

      <div className="header-right-actions">
        {/* Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="header-action-btn theme-btn"
          aria-label="Toggle Theme"
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Theme`}
        >
          <span className="btn-icon">{theme === "dark" ? "🌞" : "🌙"}</span>
          <span className="btn-text">{theme === "dark" ? "Light Theme" : "Dark Theme"}</span>
        </button>

        {/* User Profile & Logout Menu */}
        {currentUser && (
          <div className="user-menu-wrapper" ref={menuRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className={`header-action-btn user-btn ${dropdownOpen ? "active" : ""}`}
            >
              <div className="user-initial-avatar">{userInitial}</div>
              <span className="btn-text user-display-name">{displayName}</span>
              <span className="chevron-down">{dropdownOpen ? "▲" : "▼"}</span>
            </button>

            {dropdownOpen && (
              <div className="header-dropdown-panel">
                <div className="dropdown-user-header">
                  <div className="large-avatar">{userInitial}</div>
                  <div className="user-text-details">
                    <div className="user-name">{displayName}</div>
                    <div className="user-email">{currentUser.email}</div>
                  </div>
                </div>

                <div className="panel-divider"></div>

                <button className="panel-item" onClick={handleGoToProfile}>
                  <span className="item-icon">👤</span>
                  <span>My Profile & Preferences</span>
                </button>

                <div className="panel-divider"></div>

                <button className="panel-item logout-danger" onClick={handleLogout}>
                  <span className="item-icon">🚪</span>
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
