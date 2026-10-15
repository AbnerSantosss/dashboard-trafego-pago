import { buildApp } from './app.js';
import { carregarEnv, ErroEnv } from './env.js';

async function iniciar(): Promise<void> {
  let env;
  try {
    env = carregarEnv(process.env);
  } catch (erro) {
    if (erro instanceof ErroEnv) {
      console.error(erro.message);
      process.exit(1);
    }
    throw erro;
  }

  const app = await buildApp({ env });

  const encerrar = async (sinal: string) => {
    app.log.info({ sinal }, 'encerrando');
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void encerrar('SIGINT'));
  process.once('SIGTERM', () => void encerrar('SIGTERM'));

  try {
    await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  } catch (erro) {
    app.log.error({ err: erro }, 'falha ao subir a API');
    process.exit(1);
  }
}

void iniciar();
