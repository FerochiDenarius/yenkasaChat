import { NavLink } from "react-router-dom";
import { useLocale } from "../../i18n/LocaleContext";

const defaultItems = [
  { to: "/", labelKey: "home", icon: "⌂" },
  { to: "/ads", labelKey: "explore", icon: "◎" },
  { to: "/communities", labelKey: "communities", icon: "◌" },
  { to: "/wallet", labelKey: "wallet", icon: "▣" },
  { to: "/profile", labelKey: "profile", icon: "◔" }
];

const playerItems = [
  { to: "/ads", labelKey: "explore", icon: "⌕" },
  { to: "/create-post", labelKey: "create", icon: "+", create: true },
  { to: "/wallet", labelKey: "wallet", icon: "▣" }
];

export default function BottomNav({ variant = "default" }) {
  const { t } = useLocale();
  const items = variant === "player" ? playerItems : defaultItems;

  return (
    <nav
      className={`feed-bottom-nav${variant === "player" ? " feed-bottom-nav--player" : ""}`}
      aria-label="Primary navigation"
    >
      {items.map((item) => (
        <NavLink
          key={item.labelKey}
          to={item.to}
          className={({ isActive }) =>
            `feed-bottom-nav__item${item.create ? " feed-bottom-nav__item--create" : ""}${
              isActive ? " feed-bottom-nav__item--active" : ""
            }`
          }
        >
          <span className="feed-bottom-nav__icon">{item.icon}</span>
          <span>{t(item.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
