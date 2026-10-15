import { buildApp } from './app.js';

const port = Number(process.env['API_PORT'] ?? 3001);
const app = buildApp();
app
  .listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`api em http://localhost:${port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
