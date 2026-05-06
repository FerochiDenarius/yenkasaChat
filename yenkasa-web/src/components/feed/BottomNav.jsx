import { NavLink } from "react-router-dom";

const defaultItems = [
  { to: "/", label: "Home", icon: "⌂" },
  { to: "/ads", label: "Explore", icon: "◎" },
  { to: "/communities", label: "Communities", icon: "◌" },
  { to: "/wallet", label: "Wallet", icon: "▣" },
  { to: "/profile", label: "Profile", icon: "◔" }
];

const playerItems = [
  { to: "/ads", label: "Explore", icon: "⌕" },
  { to: "/create-post", label: "Create", icon: "+", create: true },
  { to: "/wallet", label: "Wallet", icon: "▣" }
];

export default function BottomNav({ variant = "default" }) {
  const items = variant === "player" ? playerItems : defaultItems;

  return (
    <nav
      className={`feed-bottom-nav${variant === "player" ? " feed-bottom-nav--player" : ""}`}
      aria-label="Primary navigation"
    >
      {items.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          className={({ isActive }) =>
            `feed-bottom-nav__item${item.create ? " feed-bottom-nav__item--create" : ""}${
              isActive ? " feed-bottom-nav__item--active" : ""
            }`
          }
        >
          <span className="feed-bottom-nav__icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
