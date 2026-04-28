import { useNavigate } from "react-router-dom";

export default function FloatingButton() {
  const navigate = useNavigate();

  return (
    <button
      className="feed-floating-button"
      type="button"
      aria-label="Create post"
      onClick={() => navigate("/create-post")}
    >
      +
    </button>
  );
}
