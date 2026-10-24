import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { GUIDES } from '../content/guidesData';
import { NOT_FOUND_META, resolvePageMeta } from '../content/pageMeta';

function setMeta(attribute, key, content) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * Keeps the document title, description and canonical URL in step with the route, so a
 * client-side navigation lands on the metadata the prerendered page for that route has.
 */
export function usePageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = resolvePageMeta(pathname, GUIDES);
    document.title = meta.title;
    setMeta('name', 'description', meta.description);
    setMeta('property', 'og:title', meta.title);
    setMeta('property', 'og:description', meta.description);
    setMeta('name', 'robots', meta === NOT_FOUND_META ? 'noindex' : 'index, follow');

    const canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical?.getAttribute('href')) {
      const origin = new URL(canonical.getAttribute('href')).origin;
      canonical.setAttribute('href', `${origin}${pathname === '/' ? '/' : pathname.replace(/\/+$/, '')}`);
    }
  }, [pathname]);
}
