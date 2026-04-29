import Watermark from "./Watermark";

export default function PostContainer({ children, className = "" }) {
  const classes = ["post-container", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      {children}
      <Watermark />
    </div>
  );
}
