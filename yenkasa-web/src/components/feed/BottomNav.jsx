import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Home", icon: "⌂" },
  { to: "/ads", label: "Explore", icon: "◎" },
  { to: "/communities", label: "Communities", icon: "◌" },
  { to: "/verification", label: "Wallet", icon: "▣" },
  { to: "/profile", label: "Profile", icon: "◔" }
];

export default function BottomNav() {
  return (
    <nav className="feed-bottom-nav" aria-label="Primary navigation">
      {items.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          className={({ isActive }) =>
            `feed-bottom-nav__item${isActive ? " feed-bottom-nav__item--active" : ""}`
          }
        >
          <span className="feed-bottom-nav__icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
