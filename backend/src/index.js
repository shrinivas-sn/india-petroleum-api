import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';

const { app } = createApp();

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`India Petroleum API listening on port ${port}`);
  });
}

export default app;
