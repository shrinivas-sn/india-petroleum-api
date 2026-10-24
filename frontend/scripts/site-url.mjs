// The canonical origin of the deployed site, or null when none is configured.
// SITE_URL wins; on Vercel the production host comes from VERCEL_PROJECT_PRODUCTION_URL.
export function resolveSiteUrl(env = {}, fileEnv = {}) {
  const explicit = env.SITE_URL || fileEnv.SITE_URL;
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw = explicit || (vercel ? `https://${vercel}` : '');
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`SITE_URL is not a valid URL: ${raw}`);
  }
  if (url.protocol !== 'https:') throw new Error(`SITE_URL must be https: ${raw}`);
  if (url.pathname !== '/' || url.search || url.hash) throw new Error(`SITE_URL must be an origin with no path: ${raw}`);
  return url.origin;
}
