import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, NavLink } from "react-router-dom";
import { useAuth } from "../AuthContext";
import "./HeaderNav.css";

export default function HeaderNav() {
  const { currentUser, logout, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [alertsData, setAlertsData] = useState({ unread_count: 0, critical_count: 0, critical_alerts: [], warning_alerts: [] });
  const [pushEnabled, setPushEnabled] = useState(false);
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  // Check notification permission
  useEffect(() => {
    if ("Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
    }
  }, []);

  // Fetch spoilage alerts on login or every 60s
  useEffect(() => {
    if (!currentUser) return;
    const fetchAlerts = async () => {
      try {
        const headers = getAuthHeaders ? getAuthHeaders() : { "Content-Type": "application/json", "X-User-Id": currentUser.uid || "demo_user" };
        const res = await fetch(`${BASE_URL}/notifications/alerts`, { headers });
        if (res.ok) {
          const data = await res.json();
          setAlertsData(data);

          // If browser push is enabled and there are critical <= 2-day items, trigger push
          if (Notification.permission === "granted" && data.critical_alerts && data.critical_alerts.length > 0) {
            const firstCritical = data.critical_alerts[0];
            const lastNotified = sessionStorage.getItem("last_spoilage_notified");
            if (lastNotified !== firstCritical.item) {
              sessionStorage.setItem("last_spoilage_notified", firstCritical.item);
              new Notification("⚠️ 48-Hour Spoilage Alert!", {
                body: `${firstCritical.quantity} ${firstCritical.unit} of ${firstCritical.item} expires in ${firstCritical.days_left} day(s)! Cook or donate now.`,
                icon: "/favicon.ico"
              });
            }
          }
        }
      } catch (err) {
        console.warn("Failed to fetch spoilage alerts:", err);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Request browser push permissions
  const togglePushNotifications = async () => {
    if (!("Notification" in window)) {
      alert("Browser push notifications are not supported in this browser.");
      return;
    }
    if (Notification.permission === "granted") {
      alert("Push notifications are already active!");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setPushEnabled(true);
      new Notification("Food Sync Alerts Active! 🌱", {
        body: "You will now receive instant 48-hour alerts for expiring pantry items.",
        icon: "/favicon.ico"
      });
    } else {
      setPushEnabled(false);
    }
  };

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
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

        <NavLink
          to="/donations"
          className={({ isActive }) => `header-nav-item${isActive ? " active" : ""}`}
        >
          <span>🌱</span> Community
        </NavLink>
      </nav>

      <div className="header-right-actions">
        {/* Spoilage Notification Bell */}
        {currentUser && (
          <div className="notif-menu-wrapper" ref={notifRef} style={{ position: "relative" }}>
            <button
              onClick={() => setNotifOpen((prev) => !prev)}
              className={`header-action-btn notif-bell-btn ${notifOpen ? "active" : ""}`}
              aria-label="Spoilage Alerts"
              title="48-Hour Spoilage & Waste Alerts"
              style={{ position: "relative" }}
            >
              <span className="btn-icon">🔔</span>
              {alertsData.unread_count > 0 && (
                <span className={`notif-badge ${alertsData.critical_count > 0 ? "critical-pulse" : ""}`}>
                  {alertsData.unread_count}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="header-dropdown-panel notif-dropdown-panel">
                <div className="dropdown-notif-header">
                  <div className="notif-title-row">
                    <span className="notif-heading">🚨 Spoilage & Surplus Alerts</span>
                    <span className="notif-subcount">{alertsData.critical_count} critical (≤48h)</span>
                  </div>
                  <button 
                    onClick={togglePushNotifications} 
                    className={`push-toggle-btn ${pushEnabled ? "enabled" : ""}`}
                    title="Enable Native Browser Push Alerts"
                  >
                    {pushEnabled ? "🔔 Push Enabled" : "🔕 Enable Browser Push"}
                  </button>
                </div>

                <div className="panel-divider"></div>

                <div className="notif-alerts-list">
                  {alertsData.critical_alerts && alertsData.critical_alerts.length > 0 ? (
                    alertsData.critical_alerts.map((alert, idx) => (
                      <div key={idx} className="notif-alert-card critical">
                        <div className="notif-alert-top">
                          <span className="notif-item-title">⚠️ {alert.item}</span>
                          <span className="notif-days-badge critical">{alert.days_left}d left</span>
                        </div>
                        <p className="notif-alert-msg">{alert.message}</p>
                        {alert.top_recipe_suggestion && (
                          <div className="notif-suggestion">
                            <span className="suggestion-label">💡 Suggested:</span>{" "}
                            <strong>{alert.top_recipe_suggestion.name}</strong> ({alert.top_recipe_suggestion.time})
                          </div>
                        )}
                        <div className="notif-action-row">
                          <button 
                            className="notif-action-btn cook-btn"
                            onClick={() => { setNotifOpen(false); navigate(alert.cook_url); }}
                          >
                            🍳 Cook Now
                          </button>
                          <button 
                            className="notif-action-btn donate-btn"
                            onClick={() => { setNotifOpen(false); navigate(alert.donate_url); }}
                          >
                            🌱 Donate Surplus
                          </button>
                        </div>
                      </div>
                    ))
                  ) : alertsData.warning_alerts && alertsData.warning_alerts.length > 0 ? (
                    alertsData.warning_alerts.map((alert, idx) => (
                      <div key={idx} className="notif-alert-card warning">
                        <div className="notif-alert-top">
                          <span className="notif-item-title">⏳ {alert.item}</span>
                          <span className="notif-days-badge warning">{alert.days_left}d left</span>
                        </div>
                        <p className="notif-alert-msg">{alert.message}</p>
                        <div className="notif-action-row">
                          <button 
                            className="notif-action-btn cook-btn"
                            onClick={() => { setNotifOpen(false); navigate(alert.cook_url); }}
                          >
                            🍳 Plan in Meal
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="notif-empty-state">
                      <span className="empty-icon">🎉</span>
                      <p>All clear! Zero food expiring in the next 5 days.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
