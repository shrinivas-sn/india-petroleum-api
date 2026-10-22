import { appendFileSync } from 'node:fs';

export const LOG_KEYS = [
  'run_id', 'trigger', 'started_at_utc', 'page_status', 'page_bytes', 'link_found',
  'file_url', 'copies_found', 'download_status', 'content_length', 'bytes_received',
  'complete', 'sha256', 'pdf_pages', 'table_posted', 'tls_verified', 'attempts',
  'seconds_total', 'error',
];

export function validateLogRecord(record) {
  for (const key of LOG_KEYS) {
    if (!(key in record)) throw new Error(`proof log record is missing key: ${key}`);
  }
  return record;
}

export function appendLogRecord(file, record) {
  validateLogRecord(record);
  appendFileSync(file, JSON.stringify(record) + '\n');
}
