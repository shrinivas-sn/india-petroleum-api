import { Link, useParams } from 'react-router-dom';
import CodeSnippet from '../components/CodeSnippet';
import InlineText from '../components/InlineText';
import { GUIDES } from '../content/guidesData';
import { fillOrigin, useOrigin } from '../lib/site';
import NotFoundPage from './NotFoundPage';

function GuideList() {
  return (
    <div className="wrap section">
      <h1>Guides</h1>
      <p className="measure">
        Worked examples built on the stored PPAC series. Every figure in them is computed from the data and re-checked
        by a test.
      </p>
      <ul className="guide-list">
        {GUIDES.map((guide) => (
          <li key={guide.id}>
            <h2>
              <Link to={`/guides/${guide.id}`}>{guide.title}</Link>
            </h2>
            <p>{guide.summary}</p>
            <p className="muted">
              {guide.category} &middot; {guide.readTime}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Block({ block, origin }) {
  switch (block.type) {
    case 'p':
      return (
        <p>
          <InlineText text={fillOrigin(block.text, origin)} />
        </p>
      );
    case 'code':
      return <CodeSnippet label={block.label} text={fillOrigin(block.text, origin)} />;
    case 'table':
      return (
        <div className="table-scroll" role="region" aria-label="Table" tabIndex={0}>
          <table className="data">
            <thead>
              <tr>
                {block.head.map((cell, i) => (
                  <th key={cell} scope="col" className={i > 0 ? 'num' : undefined}>
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join('|')}>
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th key={cell} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={`${cell}-${i}`} className="num">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'list':
      return (
        <ul className="plain">
          {block.items.map((item) => (
            <li key={item}>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

function Guide({ guide }) {
  const origin = useOrigin();
  const others = GUIDES.filter((g) => g.id !== guide.id);
  return (
    <article className="wrap section guide">
      <p className="crumb">
        <Link to="/guides">All guides</Link>
      </p>
      <h1>{guide.title}</h1>
      <p className="muted">
        {guide.category} &middot; {guide.readTime} &middot; Published {guide.date}
      </p>
      <p className="lede measure">{guide.summary}</p>
      {guide.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <div className="prose">
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} origin={origin} />
            ))}
          </div>
        </section>
      ))}
      <aside className="more" aria-label="More guides">
        <h2>More guides</h2>
        <ul className="plain">
          {others.map((g) => (
            <li key={g.id}>
              <Link to={`/guides/${g.id}`}>{g.title}</Link>
            </li>
          ))}
        </ul>
      </aside>
    </article>
  );
}

export default function GuidesPage() {
  const { id } = useParams();
  if (!id) return <GuideList />;
  const guide = GUIDES.find((entry) => entry.id === id);
  return guide ? <Guide guide={guide} /> : <NotFoundPage />;
}
