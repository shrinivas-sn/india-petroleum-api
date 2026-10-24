// Guides. Every figure is computed from data/fuel/ and re-checked by guides.test.mjs, so a guide
// cannot drift from the data. Figures are pinned to windows that end on a fixed past date, which
// a daily append to the data cannot change. `{{API}}` becomes the site's own origin when drawn.
// Inline markup in text: `code` and [label](url); a url starting with / is an in-site link.

const SOURCE_NOTE =
  'PPAC, the Petroleum Planning & Analysis Cell of the Ministry of Petroleum and Natural Gas';

export const GUIDES = [
  {
    id: 'how-to-read-the-ppac-metro-price-series',
    title: 'How to read the PPAC metro petrol and diesel price series',
    seoTitle: 'Reading the PPAC metro fuel price series',
    summary:
      'What a row in the PPAC metro fuel price table means, how the API stores it, and how to average a year of Delhi petrol prices with one request.',
    readTime: '5 min read',
    category: 'Data',
    date: '2026-10-24',
    keywords: ['PPAC fuel prices', 'petrol price history India', 'diesel price history India', 'metro fuel price table'],
    sections: [
      {
        heading: 'What PPAC publishes',
        blocks: [
          {
            type: 'p',
            text: `${SOURCE_NOTE}, posts one table of retail selling prices for petrol and diesel in Delhi, Mumbai, Chennai and Kolkata. Each row has a date, headed Date of Revision, and eight figures in rupees per litre: four cities for petrol and four for diesel. A footnote reads "RSP of Petrol/Diesel is for IOC", so the figures are Indian Oil Corporation's retail selling prices. The table starts on 16 June 2017, the first day of daily price revisions in India.`,
          },
          {
            type: 'p',
            text: 'The API stores that table as published. In the table posted on 23 October 2026 the series ran from 16 June 2017 to 23 October 2026 with a row for each of its 3,417 days. No date is missing and none is repeated.',
          },
        ],
      },
      {
        heading: 'What the date means',
        blocks: [
          {
            type: 'p',
            text: '`date` is PPAC\'s Date of Revision, copied as printed. A note under the table says a daily price change applies from 6:00 AM. The API does not turn that into a claim about what a pump charged at a given hour, and an app that shows these figures should not either. Present them as the published price for that date.',
          },
        ],
      },
      {
        heading: 'One request for a year',
        blocks: [
          { type: 'code', label: 'curl', language: 'bash', text: 'curl "{{API}}/v1/prices?city=delhi&fuel=petrol&from=2021-01-01&to=2021-12-31"' },
          {
            type: 'p',
            text: 'This returns 365 rows, one per day. Because you asked for one city and one fuel, each row is `{ date, petrol: { delhi } }`. Leave out `city` to get all four cities and leave out `fuel` to get both fuels. A request may span at most 3,660 days; ask for longer histories in ranges.',
          },
          {
            type: 'code',
            label: 'JavaScript',
            language: 'javascript',
            text: `const url = '{{API}}/v1/prices?city=delhi&fuel=petrol&from=2021-01-01&to=2021-12-31';
const { data } = await (await fetch(url)).json();
const average = data.reduce((sum, row) => sum + row.petrol.delhi, 0) / data.length;
console.log(data.length, average.toFixed(2)); // 365 96.19`,
          },
          {
            type: 'p',
            text: 'Delhi petrol averaged 96.19 rupees per litre in 2021. It started that year at 83.71 and ended at 95.41, with a peak of 110.04 on 2 November, so the average describes no single day well. Pick the statistic that fits your question.',
          },
        ],
      },
      {
        heading: 'Reading the answer',
        blocks: [
          {
            type: 'p',
            text: 'Every successful response carries `meta.attribution`, `meta.source_posted_date` (the date printed on PPAC\'s table) and `meta.latest_fetched_at` (when this service last downloaded it). Show the attribution wherever you show the figures: PPAC\'s [terms](https://ppac.gov.in/terms-conditions) allow reuse free of charge if the material is reproduced accurately and the source is prominently acknowledged.',
          },
        ],
      },
      {
        heading: 'Why a row can look unchanged',
        blocks: [
          {
            type: 'p',
            text: 'A price holds until the next revision, so most consecutive rows are identical. The table has a row for every day whether or not a price moved. To list only the days that moved, use `/v1/prices/changes`, covered in [Petrol and diesel price revisions since 2017](/guides/petrol-and-diesel-price-revisions-since-2017).',
          },
        ],
      },
    ],
  },
  {
    id: 'petrol-and-diesel-price-revisions-since-2017',
    title: 'Petrol and diesel price revisions since 2017',
    seoTitle: 'Fuel price revisions in India since 2017',
    summary:
      'How often metro petrol and diesel prices changed from 2017 to 2025: revision days per year, the longest flat stretch and the largest Delhi moves.',
    readTime: '5 min read',
    category: 'Analysis',
    date: '2026-10-24',
    keywords: ['petrol price changes India', 'fuel price revisions', 'daily fuel price revision', 'Delhi petrol price history'],
    sections: [
      {
        heading: 'Daily pricing, uneven rhythm',
        blocks: [
          {
            type: 'p',
            text: 'Prices became daily on 16 June 2017, but a price that can change every day does not have to. A revision day here is a date on which at least one of the eight prices (two fuels in four cities) moved. Counting them per year in the PPAC table gives:',
          },
          {
            type: 'table',
            head: ['Year', 'Revision days'],
            rows: [
              ['2017 (from 16 June)', '186'],
              ['2018', '296'],
              ['2019', '253'],
              ['2020', '144'],
              ['2021', '112'],
              ['2022', '16'],
              ['2023', '0'],
              ['2024', '5'],
              ['2025', '2'],
            ],
          },
          {
            type: 'p',
            text: 'Through 2025 that is 1,014 revision days out of 3,121. After the first five years the table is mostly flat: 2023 has no revision day at all.',
          },
        ],
      },
      {
        heading: 'The longest pause',
        blocks: [
          {
            type: 'p',
            text: 'For Delhi, the longest run with no change to either price began on 22 May 2022 and ended on 14 March 2024. That is 663 days with petrol at 96.72 and diesel at 89.62 throughout.',
          },
        ],
      },
      {
        heading: 'The largest Delhi moves',
        blocks: [
          {
            type: 'p',
            text: 'Six Delhi price changes were 7 rupees or more in either direction:',
          },
          {
            type: 'table',
            head: ['Date', 'Fuel', 'From', 'To', 'Change'],
            rows: [
              ['5 May 2020', 'Diesel', '62.29', '69.39', '+7.10'],
              ['31 Jul 2020', 'Diesel', '81.94', '73.56', '−8.38'],
              ['4 Nov 2021', 'Diesel', '98.42', '86.67', '−11.75'],
              ['2 Dec 2021', 'Petrol', '103.97', '95.41', '−8.56'],
              ['22 May 2022', 'Petrol', '105.41', '96.72', '−8.69'],
              ['22 May 2022', 'Diesel', '96.67', '89.62', '−7.05'],
            ],
          },
          {
            type: 'p',
            text: 'News reports attributed the falls on 4 November 2021 and 22 May 2022 to cuts in central excise duty ([Onmanorama](https://www.onmanorama.com/news/business/2021/11/03/petrol-diesel-excise-duty-cut-cheaper.html), [EastMojo](https://www.eastmojo.com/national/2022/05/22/petrol-price-cut-by-rs-8-69-diesel-by-rs-7-05/)). The PPAC table gives no reasons for any move. The API records prices, not causes.',
          },
        ],
      },
      {
        heading: 'List the moves yourself',
        blocks: [
          { type: 'code', label: 'curl', language: 'bash', text: 'curl "{{API}}/v1/prices/changes?city=delhi&fuel=diesel&from=2021-11-01&to=2021-11-30"' },
          {
            type: 'code',
            label: 'Response data',
            language: 'json',
            text: `[
  { "date": "2021-11-01", "fuel": "diesel", "city": "delhi", "from": 98.07, "to": 98.42 },
  { "date": "2021-11-04", "fuel": "diesel", "city": "delhi", "from": 98.42, "to": 86.67 }
]`,
          },
          {
            type: 'p',
            text: 'Each row is one price moving on one date. Without `from` and `to`, the endpoint returns the 365 days ending at the newest date in the data. Filter with `city` and `fuel` the same way as on `/v1/prices`.',
          },
        ],
      },
    ],
  },
  {
    id: 'mumbai-delhi-petrol-price-gap',
    title: "Mumbai's petrol price premium over Delhi since 2017",
    seoTitle: 'Mumbai vs Delhi petrol price gap since 2017',
    summary:
      "Compute Mumbai's petrol premium over Delhi in JavaScript: 11.22 rupees in June 2017, a low of 5.05 in 2020 and a high of 15.10 in 2022.",
    readTime: '4 min read',
    category: 'Tutorial',
    date: '2026-10-24',
    keywords: ['Mumbai Delhi petrol price difference', 'petrol price comparison cities', 'fuel price API JavaScript'],
    sections: [
      {
        heading: 'One request, all four cities',
        blocks: [
          {
            type: 'p',
            text: 'Leave out `city` and the API returns all four metros on every row. This request asks for petrol from the first day of the series to the end of 2025:',
          },
          { type: 'code', label: 'curl', language: 'bash', text: 'curl "{{API}}/v1/prices?fuel=petrol&from=2017-06-16&to=2025-12-31"' },
          {
            type: 'p',
            text: 'It returns 3,121 rows and about 300 KB of JSON. Responses are cached, but for a dashboard that needs only recent data, narrow the range.',
          },
        ],
      },
      {
        heading: 'Compute the gap',
        blocks: [
          {
            type: 'code',
            label: 'JavaScript',
            language: 'javascript',
            text: `const url = '{{API}}/v1/prices?fuel=petrol&from=2017-06-16&to=2025-12-31';
const { data } = await (await fetch(url)).json();
const gaps = data.map((row) => ({
  date: row.date,
  gap: +(row.petrol.mumbai - row.petrol.delhi).toFixed(2),
}));
const low = gaps.reduce((a, b) => (b.gap < a.gap ? b : a));
const high = gaps.reduce((a, b) => (b.gap > a.gap ? b : a));
console.log(gaps[0], low, high);
// { date: '2017-06-16', gap: 11.22 } { date: '2020-05-05', gap: 5.05 } { date: '2022-04-06', gap: 15.1 }`,
          },
          {
            type: 'p',
            text: 'The `+` in front of `toFixed` turns the string back into a number, which also drops a trailing zero, so 15.10 prints as 15.1. When two days tie, `reduce` as written keeps the earlier one.',
          },
        ],
      },
      {
        heading: 'What the numbers say',
        blocks: [
          {
            type: 'p',
            text: 'On 16 June 2017 a litre of petrol cost 11.22 rupees more in Mumbai than in Delhi (76.70 against 65.48). The gap fell to 5.05 on 5 May 2020 and stayed there until 31 May 2020. It rose to 15.10 on 6 April 2022 and stayed there until 21 May 2022. On 23 October 2026 it was 9.09 (111.21 against 102.12).',
          },
          {
            type: 'p',
            text: 'The table does not say why the gap moves. Both figures are PPAC\'s published price for the day, and the API does not model how they are built up.',
          },
        ],
      },
      {
        heading: 'Use it in your app',
        blocks: [
          {
            type: 'p',
            text: 'Try other cities and fuels in the [playground](/playground), and keep the attribution from `meta.attribution` next to anything you display. The [first guide](/guides/how-to-read-the-ppac-metro-price-series) explains what each date and figure means.',
          },
        ],
      },
    ],
  },
];

export const GUIDE_IDS = GUIDES.map((guide) => guide.id);
