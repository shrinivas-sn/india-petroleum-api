/**
 * Per-route titles and descriptions: the single source for the prerenderer (static HTML) and
 * the app (client-side navigation), so the two cannot disagree.
 *
 * Titles stay under 60 characters and descriptions between 50 and 160 (pageMeta.test.mjs).
 */
export const PAGE_META = {
  '/': {
    title: 'India Petroleum API: daily petrol and diesel prices',
    description:
      'Free, keyless REST API for daily petrol and diesel prices in Delhi, Mumbai, Chennai and Kolkata since June 2017, from the PPAC price table.',
  },
  '/docs': {
    title: 'API reference — India Petroleum API',
    description:
      'Endpoints, parameters, error codes, rate limit and real JSON responses for the India Petroleum API: daily metro petrol and diesel prices from PPAC.',
  },
  '/playground': {
    title: 'Playground — India Petroleum API',
    description:
      'Run live requests against the India Petroleum API: pick a metro, a fuel and a date range, see the prices on a chart and copy the matching request.',
  },
  '/guides': {
    title: 'Guides — India Petroleum API',
    description:
      'Guides to the PPAC metro fuel price series: what a row means, how often prices changed since 2017, and how to compare Mumbai with Delhi in code.',
  },
  '/status': {
    title: 'Status and data freshness — India Petroleum API',
    description:
      'Live service status for the India Petroleum API: newest price date, PPAC table date, days behind, and where the stored data comes from.',
  },
};

export const NOT_FOUND_META = {
  title: 'Page not found — India Petroleum API',
  description:
    'This page does not exist. Go to the API reference, the playground or the guides for daily metro petrol and diesel prices from PPAC.',
};

/** Metadata for a pathname, including guide article routes; `guides` is the GUIDES array. */
export function resolvePageMeta(pathname, guides = []) {
  const guideMatch = /^\/guides\/(.+?)\/?$/.exec(pathname);
  if (guideMatch) {
    const guide = guides.find((entry) => entry.id === guideMatch[1]);
    return guide ? { title: guide.seoTitle || guide.title, description: guide.summary } : NOT_FOUND_META;
  }
  return PAGE_META[pathname] || NOT_FOUND_META;
}
