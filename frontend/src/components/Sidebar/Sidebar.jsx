import { NavLink } from "react-router-dom";
import "./Sidebar.css";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">🍱 Food Sync</div>
      <nav className="nav">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
          end
        >
          <span className="icon">📦</span>
          Inventory
        </NavLink>
        <NavLink
          to="/meal-planning"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <span className="icon">📋</span>
          Meal Planning
        </NavLink>
        <NavLink
          to="/recipes"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <span className="icon">🍴</span>
          Recipes
        </NavLink>
        <NavLink
          to="/shopping-list"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <span className="icon">🛒</span>
          Shopping List
        </NavLink>
        <NavLink
          to="/donations"
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
        >
          <span className="icon">🤝</span>
          Donations
        </NavLink>
      </nav>
    </aside>
  );
}
