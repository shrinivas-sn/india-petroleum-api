import CodeSnippet from '../components/CodeSnippet';
import JsonViewer from '../components/JsonViewer';
import { ENDPOINTS, ERRORS } from '../content/apiReference';
import { PPAC_TABLE_URL, PPAC_TERMS_URL, RATE_LIMIT_TEXT } from '../content/site';
import snapshot from '../generated/snapshot.json';
import { useOrigin } from '../lib/site';

export default function DocsPage() {
  const origin = useOrigin();
  const { examples } = snapshot;

  return (
    <div className="wrap section docs">
      <h1>API reference</h1>
      <p className="measure">
        A read-only JSON API for the daily petrol and diesel prices in PPAC&rsquo;s metro table. No key, no signup, CORS
        open to every origin. Base URL: <code>{origin}</code>
      </p>

      <nav aria-label="On this page" className="toc">
        <ul>
          <li>
            <a href="#conventions">Conventions</a>
          </li>
          {ENDPOINTS.map((endpoint) => (
            <li key={endpoint.id}>
              <a href={`#${endpoint.id}`}>{endpoint.title}</a>
            </li>
          ))}
          <li>
            <a href="#errors">Errors</a>
          </li>
          <li>
            <a href="#dates">Dates and prices</a>
          </li>
        </ul>
      </nav>

      <section id="conventions">
        <h2>Conventions</h2>
        <ul className="plain">
          <li>
            Every success answer is <code>{'{ "success": true, "data": …, "meta": … }'}</code>. <code>meta</code> always
            has <code>attribution</code>, <code>source_posted_date</code> (the date printed on PPAC&rsquo;s table) and{' '}
            <code>latest_fetched_at</code> (when this service last downloaded it).
          </li>
          <li>
            Every error answer is <code>{'{ "success": false, "error": { "code": …, "message": … } }'}</code>, with the
            HTTP status shown in the table below. Unknown paths under <code>/v1</code> answer JSON, never HTML.
          </li>
          <li>Rate limit: {RATE_LIMIT_TEXT}. Past it, that instance answers 429 RATE_LIMITED. The count is not shared between instances, so treat the limit as approximate.</li>
          <li>
            Answers come from files stored with the service, so they do not wait on PPAC. Responses are cacheable by a CDN
            for an hour; a new day of data is published with a new deployment.
          </li>
        </ul>
      </section>

      {ENDPOINTS.map((endpoint) => {
        const example = endpoint.example ? examples[endpoint.example] : null;
        return (
          <section key={endpoint.id} id={endpoint.id} className="endpoint">
            <h2>{endpoint.title}</h2>
            <p className="endpoint__route">
              <span className="verb">GET</span> <code>{endpoint.path}</code>
            </p>
            <p className="measure">{endpoint.summary}</p>
            {endpoint.params.length > 0 && (
              <div className="table-scroll" role="region" aria-label={`${endpoint.title} parameters`} tabIndex={0}>
                <table className="data">
                  <thead>
                    <tr>
                      <th scope="col">Parameter</th>
                      <th scope="col">Values</th>
                      <th scope="col">Required</th>
                      <th scope="col">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.params.map((param) => (
                      <tr key={param.name}>
                        <th scope="row">
                          <code>{param.name}</code>
                        </th>
                        <td>{param.type}</td>
                        <td>{param.required ? 'yes' : 'no'}</td>
                        <td>{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="stack">
              <CodeSnippet label="Request" text={`curl "${origin}${example ? example.path : endpoint.path}"`} />
              {example && <JsonViewer value={example.body} label="Response from the build" maxLines={26} />}
            </div>
          </section>
        );
      })}

      <section id="errors">
        <h2>Errors</h2>
        <div className="table-scroll" role="region" aria-label="Error codes" tabIndex={0}>
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Code</th>
                <th scope="col">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map(([status, code, meaning]) => (
                <tr key={code}>
                  <td className="num">{status}</td>
                  <th scope="row">
                    <code>{code}</code>
                  </th>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="stack">
          <CodeSnippet label="A missing parameter" text={`curl "${origin}${examples.missingParam.path}"`} />
          <JsonViewer value={examples.missingParam.body} label={`Answer, HTTP ${examples.missingParam.status}`} />
          <CodeSnippet label="An unknown fuel" text={`curl "${origin}${examples.unknownFuel.path}"`} />
          <JsonViewer value={examples.unknownFuel.body} label={`Answer, HTTP ${examples.unknownFuel.status}`} />
        </div>
      </section>

      <section id="dates">
        <h2>Dates and prices</h2>
        <ul className="plain">
          <li>
            <code>date</code> is PPAC&rsquo;s Date of Revision, copied as printed. A note under PPAC&rsquo;s table says a
            daily price change applies from 6:00 AM; the API does not claim what a pump charged at a given hour.
          </li>
          <li>Prices are rupees per litre with two decimals. A footnote on the table says they are Indian Oil Corporation&rsquo;s retail selling prices.</li>
          <li>
            There is a row for every day from 16 June 2017, whether or not a price moved. Use{' '}
            <code>/v1/prices/changes</code> to list only the days that did.
          </li>
          <li>
            <code>days_behind</code> in <code>/v1/meta</code> counts calendar days in India between today and the newest
            price date. The example above shows the value on the day the site was built.
          </li>
        </ul>
        <p className="measure">
          Source:{' '}
          <a href={PPAC_TABLE_URL} rel="noopener noreferrer">
            PPAC&rsquo;s table
          </a>
          , reused under PPAC&rsquo;s{' '}
          <a href={PPAC_TERMS_URL} rel="noopener noreferrer">
            terms
          </a>
          : free of charge if reproduced accurately and with the source prominently acknowledged. Keep{' '}
          <code>meta.attribution</code> next to the figures you show.
        </p>
      </section>
    </div>
  );
}
