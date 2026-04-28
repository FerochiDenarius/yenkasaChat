import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Home" },
  { to: "/ads", label: "Ads" },
  { to: "/communities", label: "Communities" },
  { to: "/profile", label: "Profile" }
];

export default function Navbar() {
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`
          }
        >
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
