/**
 * The canonical URL for a route, on the origin the page already declares. Returns null when the page
 * has no usable canonical (the dev server serves index.html with its template value unreplaced).
 */
export function canonicalHref(current, pathname) {
  let origin;
  try {
    origin = new URL(current).origin;
  } catch {
    return null;
  }
  return `${origin}${pathname === '/' ? '/' : pathname.replace(/\/+$/, '')}`;
}
