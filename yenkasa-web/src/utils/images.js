export function staticImage(name) {
  return `/images/${name}`;
}

export function staticImageFallback(name) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/?$/, "/")}images/${name}`;
}

export function handleStaticImageError(event, name) {
  const fallback = staticImageFallback(name);
  if (event.currentTarget.src.endsWith(fallback)) return;
  event.currentTarget.src = fallback;
}

export function handleDynamicImageError(event) {
  handleStaticImageError(event, "default.png");
}
