// Dates are ISO YYYY-MM-DD strings and are formatted by hand: Intl output differs between
// Node and browsers, and the prerendered HTML must match what the browser draws.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function formatMonthYear(iso) {
  const [year, month] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

export const formatPrice = (n) => n.toFixed(2);

/** "+2.61" or "−8.69" (a real minus sign), "0.00" for no change. */
export function formatChange(delta) {
  const rounded = Math.round(delta * 100) / 100;
  if (rounded === 0) return '0.00';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(2)}`;
}

export const formatCount = (n) => n.toLocaleString('en-IN');

export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatDate(d.toISOString().slice(0, 10))}, ${d.toISOString().slice(11, 16)} UTC`;
}
