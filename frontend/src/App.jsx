import "./assets/styles/variables.css";
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
}
