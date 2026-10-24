import { useState } from 'react';

export default function CodeSnippet({ label, text }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the text stays selectable in the block.
    }
  };

  return (
    <figure className="code">
      <figcaption className="code__bar">
        <span>{label}</span>
        <button type="button" className="text-button" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre tabIndex={0}>
        <code>{text}</code>
      </pre>
    </figure>
  );
}
