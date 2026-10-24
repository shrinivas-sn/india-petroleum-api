import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { ApiError, CITIES, FuelService } from './fuel-service.js';

const NAME = 'India Petroleum API (PPAC fuel prices)';
export const ATTRIBUTION_FALLBACK =
  'Source: Petroleum Planning & Analysis Cell (PPAC), Ministry of Petroleum and Natural Gas, Government of India';
const ENDPOINTS = [
  'GET /health',
  'GET /v1/prices/latest',
  'GET /v1/prices?from=YYYY-MM-DD&to=YYYY-MM-DD[&city=][&fuel=]',
  'GET /v1/prices/changes[?from=&to=&city=&fuel=]',
  'GET /v1/cities',
  'GET /v1/meta',
];
const distDir = fileURLToPath(new URL('../../frontend/dist', import.meta.url));
const PAGES = ['/', '/docs', '/playground', '/status', '/guides'];

export function createApp(options = {}) {
  const app = express();
  const fuel = options.fuelService ?? new FuelService({ dataDir: options.dataDir });
  app.set('trust proxy', options.trustProxy ?? 1);
  app.disable('x-powered-by');

  app.use(cors({ origin: '*', methods: ['GET', 'HEAD', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Accept'] }));

  if (options.rateLimit !== false) {
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: options.rateLimitMax ?? 100,
        // Responses are cached on the CDN, so per-caller RateLimit headers would go stale.
        standardHeaders: false,
        legacyHeaders: false,
        handler: (req, res) =>
          res.status(429).json({
            success: false,
            error: { code: 'RATE_LIMITED', message: 'Too many requests. Rate limit is 100 requests per 15 minutes.' },
          }),
      }),
    );
  }

  const ok = (res, data, meta = {}) => {
    const { source_posted_date: posted, fetched_at: fetched, attribution } = fuel.meta;
    res.status(200).json({
      success: true,
      data,
      meta: {
        ...meta,
        attribution: attribution ?? ATTRIBUTION_FALLBACK,
        source_posted_date: posted,
        latest_fetched_at: fetched,
      },
    });
  };

  const info = (req, res) =>
    ok(res, {
      name: NAME,
      description:
        'Free, keyless REST API for official daily retail petrol and diesel prices in Delhi, Mumbai, Chennai and Kolkata since 16 June 2017, from PPAC.',
      coverage: fuel.coverage(),
      endpoints: ENDPOINTS,
      rate_limit: '100 requests per 15 minutes per IP',
      status: 'operational',
    });

  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false }));
    const sendPage = (file) => (req, res, next) => (req.accepts(['json', 'html']) === 'html' ? res.sendFile(path.join(distDir, file)) : next());
    for (const page of PAGES) app.get(page, sendPage(page === '/' ? 'index.html' : `${page.slice(1)}/index.html`));
    app.get('/guides/:id', (req, res, next) =>
      req.accepts(['json', 'html']) === 'html' && /^[a-z0-9-]+$/.test(req.params.id) && fs.existsSync(path.join(distDir, 'guides', req.params.id, 'index.html'))
        ? res.sendFile(path.join(distDir, 'guides', req.params.id, 'index.html'))
        : next());
  }
  app.get('/', info);
  app.get('/health', info);

  const v1 = express.Router();
  v1.get('/prices/latest', (req, res) => {
    const day = fuel.latest();
    ok(res, day, { count: 1 });
  });

  v1.get('/prices', (req, res) => {
    const window = fuel.window(req.query, { required: true });
    const filters = fuel.filters(req.query);
    const data = fuel.prices({ ...window, ...filters });
    ok(res, data, {
      count: data.length,
      from: window.from,
      to: window.to,
      city: filters.city ?? 'all',
      fuel: filters.fuel ?? 'all',
      coverage: fuel.coverage(),
    });
  });

  v1.get('/prices/changes', (req, res) => {
    const window = fuel.window(req.query, { required: false });
    const filters = fuel.filters(req.query);
    const data = fuel.changes({ ...window, ...filters });
    ok(res, data, {
      count: data.length,
      from: window.from,
      to: window.to,
      window_defaulted: window.defaulted,
      city: filters.city ?? 'all',
      fuel: filters.fuel ?? 'all',
      coverage: fuel.coverage(),
    });
  });

  v1.get('/cities', (req, res) => ok(res, CITIES, { count: CITIES.length }));
  v1.get('/meta', (req, res) => ok(res, fuel.provenance(), {}));
  app.use('/v1', v1);

  app.use((req, res) => {
    if (req.accepts(['json', 'html']) === 'html' && !req.path.startsWith('/v1/') && fs.existsSync(path.join(distDir, '404.html'))) {
      return res.status(404).sendFile(path.join(distDir, '404.html'));
    }
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Route '${req.method} ${req.path}' not found. See GET /health for the endpoint list.` },
    });
  });

  // Express 5 runs a 4-argument handler for errors from routes and middleware alike.
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err instanceof ApiError) {
      return res.status(err.status).json({ success: false, error: { code: err.code, message: err.message, ...err.extra } });
    }
    if (!options.quiet) console.error(err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected internal server error occurred.' } });
  });

  return { app, fuel };
}
