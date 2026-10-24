import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer, loadEnv } from 'vite';
import { resolveSiteUrl } from './site-url.mjs';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectDir, 'dist');

const fileEnv = loadEnv('production', projectDir, '');
const siteUrl = resolveSiteUrl(process.env, fileEnv);

const escapeXml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const template = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');
const vite = await createServer({
  root: projectDir,
  server: { middlewareMode: true },
  appType: 'custom',
  mode: 'production',
});

try {
  const { AppContent } = await vite.ssrLoadModule('/src/App.jsx');
  const { OriginProvider } = await vite.ssrLoadModule('/src/lib/site.jsx');
  const { GUIDES } = await vite.ssrLoadModule('/src/content/guidesData.js');
  const { PAGE_META, NOT_FOUND_META } = await vite.ssrLoadModule('/src/content/pageMeta.js');
  const { SITE_NAME } = await vite.ssrLoadModule('/src/content/site.js');
  const snapshot = JSON.parse(await fs.readFile(path.join(projectDir, 'src', 'generated', 'snapshot.json'), 'utf8'));

  // Titles and descriptions live in src/content/pageMeta.js, so the static build and
  // client-side navigation cannot drift apart.
  const mainPages = [
    { route: '/', file: path.join(distDir, 'index.html'), includeWebApi: true },
    { route: '/docs', file: path.join(distDir, 'docs', 'index.html') },
    { route: '/playground', file: path.join(distDir, 'playground', 'index.html') },
    { route: '/guides', file: path.join(distDir, 'guides', 'index.html') },
    { route: '/status', file: path.join(distDir, 'status', 'index.html') },
  ].map((page) => ({ ...page, ...PAGE_META[page.route] }));

  const guidePages = GUIDES.map((guide) => ({
    route: `/guides/${guide.id}`,
    file: path.join(distDir, 'guides', guide.id, 'index.html'),
    title: guide.seoTitle || guide.title,
    description: guide.summary,
    article: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: guide.title,
      description: guide.summary,
      datePublished: guide.date,
      inLanguage: 'en-IN',
      author: { '@type': 'Organization', name: SITE_NAME },
      publisher: { '@type': 'Organization', name: SITE_NAME },
      ...(siteUrl ? { mainEntityOfPage: `${siteUrl}/guides/${guide.id}`, image: `${siteUrl}/og-image.png` } : {}),
    },
  }));

  const allPages = [...mainPages, ...guidePages];

  /** Applies every shared head transformation for one page. */
  function renderHead(html, page) {
    const canonical = siteUrl && !page.noCanonical ? new URL(page.route, siteUrl).href : null;
    let output = html;
    const set = (pattern, replacement) => {
      output = output.replace(pattern, replacement);
    };

    set(/<title>[^<]*<\/title>/, `<title>${escapeXml(page.title)}</title>`);
    set(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeXml(page.description)}" />`);
    set(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeXml(page.title)}" />`);
    set(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:description" content="${escapeXml(page.description)}" />`,
    );
    set(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escapeXml(page.title)}" />`);
    set(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:description" content="${escapeXml(page.description)}" />`,
    );

    if (canonical) {
      set(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${escapeXml(canonical)}" />`);
      set(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${escapeXml(canonical)}" />`);
    } else {
      // Without a configured origin, emit no canonical and no social URLs at all, so nothing
      // points crawlers at a host that is not serving the site.
      for (const pattern of [
        /[^\S\n]*<link\s+rel="canonical"[\s\S]*?\/?>\n?/,
        /[^\S\n]*<meta\s+property="og:url"[\s\S]*?\/?>\n?/,
        /[^\S\n]*<meta\s+property="og:image(?::width|:height|:alt)?"[\s\S]*?\/?>\n?/g,
        /[^\S\n]*<meta\s+name="twitter:image(?::alt)?"[\s\S]*?\/?>\n?/g,
      ]) {
        set(pattern, '');
      }
    }

    // The WebAPI description belongs on the API landing page only.
    if (!page.includeWebApi || !siteUrl) {
      set(/[ \t]*<!--WEBAPI-LD-START-->[\s\S]*?<!--WEBAPI-LD-END-->\n?/, '');
    }
    if (page.article) {
      set('</head>', `  <script type="application/ld+json">${JSON.stringify(page.article)}</script>\n  </head>`);
    }
    return output.replace(/__SITE_URL__/g, siteUrl || '');
  }

  const render = (route) =>
    renderToString(
      React.createElement(
        OriginProvider,
        { value: siteUrl || 'https://example.com' },
        React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(AppContent)),
      ),
    );

  for (const page of allPages) {
    const html = renderHead(template.replace('<div id="root"></div>', `<div id="root">${render(page.route)}</div>`), page);
    await fs.mkdir(path.dirname(page.file), { recursive: true });
    await fs.writeFile(page.file, html);
  }

  // 404.html: Vercel serves it with a 404 status for any unmatched path (noindex, no canonical).
  const notFoundHtml = renderHead(
    template.replace('<div id="root"></div>', `<div id="root">${render('/__not-found__')}</div>`),
    { route: '/__not-found__', noCanonical: true, ...NOT_FOUND_META },
  ).replace('</head>', '  <meta name="robots" content="noindex" />\n  </head>');
  await fs.writeFile(path.join(distDir, '404.html'), notFoundHtml);

  if (siteUrl) {
    const lastmod = snapshot.meta.last_date;
    const entries = allPages
      .map((page) => {
        const loc = new URL(page.route, siteUrl).href;
        const priority = page.route === '/' ? '1.0' : page.route.startsWith('/guides/') ? '0.7' : '0.8';
        return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
      })
      .join('\n');
    await fs.writeFile(
      path.join(distDir, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`,
    );
    await fs.writeFile(path.join(distDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
  } else {
    // A stale crawler file from an earlier configured build must not ship.
    await fs.rm(path.join(distDir, 'sitemap.xml'), { force: true });
    await fs.rm(path.join(distDir, 'robots.txt'), { force: true });
  }

  console.log(
    `[prerender] Rendered ${allPages.length} pages and 404.html. ${
      siteUrl
        ? `Canonical origin ${siteUrl}; sitemap.xml and robots.txt written.`
        : 'No SITE_URL set: canonical tags, sitemap.xml and robots.txt were omitted.'
    }`,
  );
} finally {
  await vite.close();
}
