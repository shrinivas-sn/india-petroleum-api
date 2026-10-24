// What the Docs page documents. docs-parity.test.mjs checks this list against the routes the
// backend registers, so the page cannot describe an endpoint that does not exist.
// `example` names an entry in snapshot.examples: a real answer captured at build time.

const CITY_PARAM = {
  name: 'city',
  type: 'delhi | mumbai | chennai | kolkata',
  required: false,
  description: 'Limit the answer to one city. Left out, all four cities are returned. Any other value is a 404 UNKNOWN_CITY that lists the valid ones.',
};
const FUEL_PARAM = {
  name: 'fuel',
  type: 'petrol | diesel',
  required: false,
  description: 'Limit the answer to one fuel. Left out, both fuels are returned. Any other value is a 404 UNKNOWN_FUEL that lists the valid ones.',
};

export const ENDPOINTS = [
  {
    id: 'latest',
    path: '/v1/prices/latest',
    title: 'Newest prices',
    summary: 'The newest day in the stored data: all four cities, petrol and diesel.',
    params: [],
    example: 'latest',
  },
  {
    id: 'prices',
    path: '/v1/prices',
    title: 'Prices over a date range',
    summary: 'One row per calendar day between from and to, both included. Every day has a row, including days on which no price moved.',
    params: [
      { name: 'from', type: 'YYYY-MM-DD', required: true, description: 'First day. Dates before 2017-06-16 have no rows.' },
      { name: 'to', type: 'YYYY-MM-DD', required: true, description: 'Last day. The range may span at most 3,660 days.' },
      CITY_PARAM,
      FUEL_PARAM,
    ],
    example: 'range',
  },
  {
    id: 'changes',
    path: '/v1/prices/changes',
    title: 'Price changes',
    summary: 'Only the moves: one row for each date on which a price changed, with the price before and after.',
    params: [
      { name: 'from', type: 'YYYY-MM-DD', required: false, description: 'First day. Defaults to 365 days before to.' },
      { name: 'to', type: 'YYYY-MM-DD', required: false, description: 'Last day. Defaults to the newest date in the data.' },
      CITY_PARAM,
      FUEL_PARAM,
    ],
    example: 'changes',
  },
  {
    id: 'cities',
    path: '/v1/cities',
    title: 'Cities',
    summary: 'The four cities the table covers, with the slug to use in the city parameter.',
    params: [],
    example: 'cities',
  },
  {
    id: 'meta',
    path: '/v1/meta',
    title: 'Data provenance and freshness',
    summary: 'Where the stored data came from and how current it is: the PPAC file URL and its SHA-256, when it was downloaded, the first and last date, and days_behind.',
    params: [],
    example: 'meta',
  },
  {
    id: 'health',
    path: '/health',
    title: 'Health',
    summary: 'Returns 200 with the API name, coverage and the endpoint list while the service is up. Never cached.',
    params: [],
    example: 'health',
  },
];

export const ERRORS = [
  ['400', 'MISSING_PARAM', 'A required parameter is missing. The message names it.'],
  ['400', 'INVALID_DATE', 'from or to is not a real calendar date in YYYY-MM-DD form.'],
  ['400', 'INVALID_RANGE', 'from is after to.'],
  ['400', 'RANGE_TOO_LARGE', 'The range spans more than 3,660 days. Ask for several ranges.'],
  ['404', 'UNKNOWN_CITY', 'city is not one of the four slugs. valid_values lists them.'],
  ['404', 'UNKNOWN_FUEL', 'fuel is not petrol or diesel. valid_values lists them.'],
  ['404', 'NOT_FOUND', 'No such route.'],
  ['429', 'RATE_LIMITED', 'More than 100 requests from one IP address in 15 minutes.'],
  ['500', 'INTERNAL_ERROR', 'An unexpected failure on the server.'],
];
