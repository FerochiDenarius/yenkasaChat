import { useNavigate } from "react-router-dom";

export default function YenkasaWebSponsoredAdButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="player-sponsored-button"
      onClick={() => navigate("/ads")}
      aria-label="Create sponsored ad"
    >
      <span>↗</span>
      <strong>Sponsored</strong>
      <small>Create Ad</small>
    </button>
  );
}
