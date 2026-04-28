import "../../styles/layout.css";

export default function Backdrop({ onClick }) {
  return (
    <button
      type="button"
      className="app-backdrop"
      onClick={onClick}
      aria-label="Close menu"
    />
  );
}
