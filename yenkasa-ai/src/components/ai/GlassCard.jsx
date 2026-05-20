export default function GlassCard({
  children,
  className = "",
  hover = false,
  strong = false,
  as: Component = "section",
}) {
  const hoverClass = hover ? "transition-transform duration-200 hover:-translate-y-1" : "";
  const strongClass = strong ? "ai-glass-strong" : "";

  return (
    <Component className={`ai-glass ${strongClass} rounded-[28px] ${hoverClass} ${className}`}>
      {children}
    </Component>
  );
}
