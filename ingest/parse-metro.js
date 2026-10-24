// Parses the text of PPAC's daily metro price PDF, as written by `pdftotext -raw`
// (content-stream order). In that mode every day is `DATE p p p p DATE d d d d`
// (Delhi, Mumbai, Chennai, Kolkata; petrol then diesel) with both dates equal.
// `-layout` is not used: it moves diesel dates one row and drifts at page breaks.
// The text is read as whitespace-separated tokens, so line endings, page breaks
// and the header blocks between pages do not matter.

const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};
const DATE = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/;
const NUMBER = /^-?\d+(?:\.\d+)?$/;
const CITIES = ['delhi', 'mumbai', 'chennai', 'kolkata'];

class ParseError extends Error {
  constructor(message, where) {
    super(`PARSE_ERROR (page ${where.page}, line ${where.line}): ${message}`);
    this.code = 'PARSE_ERROR';
    this.page = where.page;
    this.line = where.line;
  }
}

export function toIsoDate(token) {
  const m = DATE.exec(token);
  if (!m || !(m[2] in MONTHS)) return null;
  const year = 2000 + Number(m[3]);
  const month = MONTHS[m[2]];
  const day = Number(m[1]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d.toISOString().slice(0, 10);
}

function tokenise(text) {
  const tokens = [];
  let line = 1;
  let page = 1;
  let last = 0;
  for (const m of text.matchAll(/\S+/g)) {
    for (let i = last; i < m.index; i++) {
      if (text[i] === '\n') line++;
      else if (text[i] === '\f') page++;
    }
    last = m.index;
    tokens.push({ value: m[0], page, line });
  }
  return tokens;
}

function isDateShaped(token) {
  return DATE.test(token);
}

function price(token, where, label) {
  const n = Number(token.value);
  if (!NUMBER.test(token.value) || !Number.isFinite(n) || n <= 0) {
    throw new ParseError(`${label} price "${token.value}" is not a positive number`, where);
  }
  return n;
}

export function parseMetroText(text) {
  const tokens = tokenise(text);
  const petrol = [];
  const diesel = [];
  let posted = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!isDateShaped(t.value)) continue;

    const iso = toIsoDate(t.value);
    if (!iso) throw new ParseError(`"${t.value}" is not a real calendar date`, t);

    if (tokens[i - 1]?.value === 'Posted:') {
      posted = iso;
      continue;
    }

    const next = tokens[i + 1];
    if (!next || !NUMBER.test(next.value)) {
      throw new ParseError(`date ${t.value} is not followed by prices`, t);
    }
    const cells = tokens.slice(i + 1, i + 10);
    if (cells.length < 9 || !isDateShaped(cells[4]?.value)) {
      throw new ParseError(`row for ${t.value} is not "4 petrol prices, diesel date, 4 diesel prices"`, t);
    }
    const dieselIso = toIsoDate(cells[4].value);
    if (dieselIso !== iso) {
      throw new ParseError(`diesel date ${cells[4].value} differs from petrol date ${t.value}`, t);
    }
    const row = (offset, label) => {
      const out = { date: iso };
      CITIES.forEach((city, k) => { out[city] = price(cells[offset + k], t, label); });
      return out;
    };
    petrol.push(row(0, 'petrol'));
    diesel.push(row(5, 'diesel'));
    i += 9;
  }

  if (petrol.length === 0) throw new ParseError('no price rows found', { page: 1, line: 1 });
  return { petrol, diesel, posted };
}
