import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { remoteFromEnv } from './data-store.js';

// DATA_REMOTE=off keeps the API on the data bundled with it (local runs, tests).
const { app } = createApp({ remote: remoteFromEnv() });

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`India Petroleum API listening on port ${port}`);
  });
}

export default app;
