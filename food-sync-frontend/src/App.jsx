import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";

// Pages
import Login from "./pages/Login";
import Inventory from "./pages/Inventory";
import Recipes from "./pages/Recipes";
import MealPlanning from "./pages/MealPlanning";
import ShoppingList from "./pages/ShoppingList";
import Assistant from "./pages/Assistant";
import Profile from "./pages/Profile";

// Components
import HeaderNav from "./components/HeaderNav";

// Global styles
import "./App.css";
import "./assets/styles/layout.css";

import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "3rem", textAlign: "center", background: "white", borderRadius: "16px", margin: "3rem auto", maxWidth: "600px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)", border: "1px solid #fed7d7" }}>
          <h2 style={{ color: "#e53e3e" }}>⚠️ Page Render Error</h2>
          <p style={{ color: "#718096", margin: "1rem 0" }}>{this.state.error?.toString()}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: "12px 24px", background: "linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "1rem" }}
          >
            🔄 Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* =========================
   1. APP LAYOUT (NO INLINE STYLES)
   ========================= */
const AppLayout = () => {
  return (
    <div className="app-layout">
      <HeaderNav />

      <main className="main-content">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
};

/* =========================
   2. PRIVATE ROUTE
   ========================= */
const PrivateRoute = () => {
  const { currentUser } = useAuth();
  return currentUser ? <AppLayout /> : <Navigate to="/login" replace />;
};

/* =========================
   3. APP ROUTES
   ========================= */
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* PUBLIC */}
          <Route path="/login" element={<Login />} />

          {/* PROTECTED */}
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<Navigate to="/recipes" replace />} />
            <Route path="/dashboard" element={<Navigate to="/recipes" replace />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/meal-planning" element={<MealPlanning />} />
            <Route path="/shopping-list" element={<ShoppingList />} />
            <Route path="/donations" element={<Navigate to="/recipes" replace />} />

            {/* 👇 ADDED ASSISTANT ROUTE 👇 */}
            <Route path="/assistant" element={<Assistant />} />

            {/* 👇 ADDED PROFILE ROUTE 👇 */}
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;