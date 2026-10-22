import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOG_KEYS, validateLogRecord } from './log.js';

const complete = () => ({
  run_id: '1', trigger: 'manual', started_at_utc: '2026-10-22T10:00:00Z',
  page_status: 200, page_bytes: 312524, link_found: true,
  file_url: 'https://ppac.gov.in/download.php?file=importantnews/1_PP_9_a_DailyPriceMSHSD_Metro_22.10.2026.pdf',
  copies_found: 2, download_status: 200, content_length: 3285581, bytes_received: 3285581,
  complete: true, sha256: 'abc', pdf_pages: 35, table_posted: '22-Oct-26',
  tls_verified: true, attempts: 1, seconds_total: 12.3, error: null,
});

test('a complete record is returned unchanged', () => {
  const r = complete();
  assert.deepEqual(validateLogRecord(r), r);
});

test('a record missing any key throws and names the key', () => {
  for (const key of LOG_KEYS) {
    const r = complete();
    delete r[key];
    assert.throws(() => validateLogRecord(r), new RegExp(key));
  }
});
