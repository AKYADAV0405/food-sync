/*import "./assets/styles/variables.css";
import "./assets/styles/global.css";
import "./assets/styles/layout.css";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Sidebar from "./components/sidebar/sidebar";
import Inventory from "./pages/Inventory";
import MealPlanning from "./pages/MealPlanning";
import Recipes from "./pages/Recipes";
import ShoppingList from "./pages/ShoppingList";
import Donations from "./pages/Donations";

export default function App() {
  return (
    <Router>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Inventory />} />
            <Route path="/meal-planning" element={<MealPlanning />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/shopping-list" element={<ShoppingList />} />
            <Route path="/donations" element={<Donations />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}*/

// M-2
// import { useEffect, useState } from "react";

// import "./assets/styles/variables.css";
// import "./assets/styles/global.css";
// import "./assets/styles/layout.css";

// import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// import Sidebar from "./components/sidebar/sidebar";
// import Inventory from "./pages/Inventory";
// import MealPlanning from "./pages/MealPlanning";
// import Recipes from "./pages/Recipes";
// import ShoppingList from "./pages/ShoppingList";
// import Donations from "./pages/Donations";

// export default function App() {
//   const [theme, setTheme] = useState("dark");

//   // Load saved theme
//   useEffect(() => {
//     const savedTheme = localStorage.getItem("theme") || "dark";
//     setTheme(savedTheme);
//     document.body.setAttribute("data-theme", savedTheme);
//   }, []);

//   // Toggle theme
//   const toggleTheme = () => {
//     const newTheme = theme === "dark" ? "light" : "dark";
//     setTheme(newTheme);
//     document.body.setAttribute("data-theme", newTheme);
//     localStorage.setItem("theme", newTheme);
//   };

//   return (
//     <Router>
//       <div className="app-layout">
//         <Sidebar />

//         <button className="theme-toggle" onClick={toggleTheme}>
//           {theme === "dark" ? "🌞 Light Mode" : "🌙 Dark Mode"}
//         </button>

//         <main className="main-content">
//           <Routes>
//             <Route path="/" element={<Inventory />} />
//             <Route path="/meal-planning" element={<MealPlanning />} />
//             <Route path="/recipes" element={<Recipes />} />
//             <Route path="/shopping-list" element={<ShoppingList />} />
//             <Route path="/donations" element={<Donations />} />
//           </Routes>
//         </main>
//       </div>
//     </Router>
//   );
// }

// import { useEffect, useState } from "react";
// import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";

// import "./assets/styles/variables.css";
// import "./assets/styles/global.css";
// import "./assets/styles/layout.css";

// import Sidebar from "./components/sidebar/sidebar";
// import Inventory from "./pages/Inventory";
// import MealPlanning from "./pages/MealPlanning";
// import Recipes from "./pages/Recipes";
// import ShoppingList from "./pages/ShoppingList";
// import Donations from "./pages/Donations";
// import Login from "./pages/Login";

// function AppLayout() {
//   const location = useLocation();
//   const isLoginPage = location.pathname === "/login";

//   const [theme, setTheme] = useState("dark");

//   useEffect(() => {
//     const savedTheme = localStorage.getItem("theme") || "dark";
//     setTheme(savedTheme);
//     document.body.setAttribute("data-theme", savedTheme);
//   }, []);

//   const toggleTheme = () => {
//     const newTheme = theme === "dark" ? "light" : "dark";
//     setTheme(newTheme);
//     document.body.setAttribute("data-theme", newTheme);
//     localStorage.setItem("theme", newTheme);
//   };

//   return (
//     <div className="app-layout">
//       {!isLoginPage && <Sidebar />}

//       {!isLoginPage && (
//         <button className="theme-toggle" onClick={toggleTheme}>
//           {theme === "dark" ? "🌞 Light Mode" : "🌙 Dark Mode"}
//         </button>
//       )}

//       <main className="main-content">
//         <Routes>
//           <Route path="/login" element={<Login />} />
//           <Route path="/" element={<Inventory />} />
//           <Route path="/meal-planning" element={<MealPlanning />} />
//           <Route path="/recipes" element={<Recipes />} />
//           <Route path="/shopping-list" element={<ShoppingList />} />
//           <Route path="/donations" element={<Donations />} />
//         </Routes>
//       </main>
//     </div>
//   );
// }

// export default function App() {
//   return (
//     <Router>
//       <AppLayout />
//     </Router>
//   );
// }

// M-3
import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Link,
} from "react-router-dom";

import "./assets/styles/variables.css";
import "./assets/styles/global.css";
import "./assets/styles/layout.css";

import Sidebar from "./components/sidebar/sidebar";
import Inventory from "./pages/Inventory";
import MealPlanning from "./pages/MealPlanning";
import Recipes from "./pages/Recipes";
import ShoppingList from "./pages/ShoppingList";
import Donations from "./pages/Donations";
import Login from "./pages/Login";

function AppLayout() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  const [theme, setTheme] = useState("dark");

  // Load saved theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    setTheme(savedTheme);
    document.body.setAttribute("data-theme", savedTheme);
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return (
    <div className="app-layout">
      {/* Sidebar hidden on login */}
      {!isLoginPage && <Sidebar />}

      {/* Theme toggle hidden on login */}
      {!isLoginPage && (
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
      )}

      {/* 🔐 LOGIN BUTTON (BOTTOM LEFT) */}
      {!isLoginPage && (
        <Link to="/login" className="login-floating-btn">
          🔐 Login
        </Link>
      )}

      <main className="main-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Inventory />} />
          <Route path="/meal-planning" element={<MealPlanning />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/shopping-list" element={<ShoppingList />} />
          <Route path="/donations" element={<Donations />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}
