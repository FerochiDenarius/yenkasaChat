import { NavLink } from "react-router-dom";
import "../../styles/chat-section-nav.css";

const items = [
  { to: "/", label: "Home", icon: "⌂", end: true },
  { to: "/chatrooms", label: "Chats", icon: "◉" },
  { to: "/wallet", label: "Wallet", icon: "▣" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export default function ChatSectionNav() {
  return (
    <nav className="chat-section-nav" aria-label="Chat section navigation">
      {items.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `chat-section-nav__item${isActive ? " is-active" : ""}`
          }
        >
          <span className="chat-section-nav__icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
