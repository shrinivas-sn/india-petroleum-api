/** A status word with a shape and a colour, so it never relies on colour alone. */
export default function StatusBadge({ tone = 'idle', children }) {
  return (
    <span className={`badge badge--${tone}`}>
      <span className="badge__mark" aria-hidden="true" />
      {children}
    </span>
  );
}
