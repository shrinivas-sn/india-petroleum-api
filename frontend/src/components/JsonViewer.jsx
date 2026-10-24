import { useState } from 'react';

/** Pretty-printed JSON, cut to `maxLines` until the reader asks for the rest. */
export default function JsonViewer({ value, label = 'Response', maxLines = 28 }) {
  const [expanded, setExpanded] = useState(false);
  const lines = JSON.stringify(value, null, 2).split('\n');
  const cut = !expanded && lines.length > maxLines;
  const shown = cut ? [...lines.slice(0, maxLines), '  …'].join('\n') : lines.join('\n');

  return (
    <figure className="code">
      <figcaption className="code__bar">
        <span>{label}</span>
        {lines.length > maxLines && (
          <button type="button" className="text-button" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : `Show all ${lines.length.toLocaleString('en-IN')} lines`}
          </button>
        )}
      </figcaption>
      <pre tabIndex={0}>
        <code>{shown}</code>
      </pre>
    </figure>
  );
}
