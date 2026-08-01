import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import "./TopBar.css";

export default function TopBar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  const menuRef = useRef(null);

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

  return (
    <div className="top-bar-container">
      {/* 1. Theme Switcher */}
      <button
        onClick={toggleTheme}
        className="top-bar-btn theme-toggle-btn"
        aria-label="Toggle Theme"
        title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Theme`}
      >
        <span className="btn-icon">{theme === "dark" ? "🌞" : "🌙"}</span>
        <span className="btn-text">{theme === "dark" ? "Light Theme" : "Dark Theme"}</span>
      </button>

      {/* 2. User Profile & Logout Dropdown (if logged in) */}
      {currentUser && (
        <div className="user-profile-wrapper" ref={menuRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className={`top-bar-btn user-menu-btn ${dropdownOpen ? "active" : ""}`}
            title="User Profile & Menu"
          >
            <div className="user-avatar">{userInitial}</div>
            <span className="btn-text user-name-text">{displayName}</span>
            <span className="chevron-icon">{dropdownOpen ? "▲" : "▼"}</span>
          </button>

          {dropdownOpen && (
            <div className="profile-dropdown-menu">
              <div className="dropdown-header">
                <div className="dropdown-avatar">{userInitial}</div>
                <div className="dropdown-user-info">
                  <div className="dropdown-user-name">{displayName}</div>
                  <div className="dropdown-user-email">{currentUser.email}</div>
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <button className="dropdown-item" onClick={handleGoToProfile}>
                <span className="item-icon">👤</span>
                <span>My Profile & Preferences</span>
              </button>

              <div className="dropdown-divider"></div>

              <button className="dropdown-item logout-item" onClick={handleLogout}>
                <span className="item-icon">🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
