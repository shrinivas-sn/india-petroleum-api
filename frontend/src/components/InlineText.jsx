import { Fragment } from 'react';
import { Link } from 'react-router-dom';

const TOKEN = /(`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

/** Text with `code` and [label](url) markup. A url starting with / is an in-site link. */
export default function InlineText({ text }) {
  return text.split(TOKEN).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = LINK.exec(part);
    if (link) {
      return link[2].startsWith('/') ? (
        <Link key={index} to={link[2]}>
          {link[1]}
        </Link>
      ) : (
        <a key={index} href={link[2]} rel="noopener noreferrer">
          {link[1]}
        </a>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}
