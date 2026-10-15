import { buildApp } from './app.js';
import { carregarEnv } from './env.js';

/** App para testes: env de teste (defaults seguros) e logger desligado. */
export function appDeTeste() {
  return buildApp({ env: carregarEnv({ NODE_ENV: 'test' }), logger: false });
}
