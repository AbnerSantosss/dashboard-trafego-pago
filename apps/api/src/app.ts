import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import Fastify, { LogController, type FastifyServerOptions } from 'fastify';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { carregarEnv, type Env } from './env.js';
import { registrarTratamentoDeErros } from './erros.js';
import { rotasHealth } from './rotas/health.js';
import { rotasAuth } from './rotas/auth.js';
import { authPlugin } from './auth/plugin.js';
import type { Db } from './db/client.js';

const require = createRequire(import.meta.url);
const { version: VERSAO } = require('../package.json') as { version: string };

/** Limite de corpo: 1 MB, igual ao contrato do webhook (413 acima disso). */
export const LIMITE_CORPO = 1024 * 1024;

/**
 * Cabeçalhos que nunca vão para o log. O serializer padrão de `req` não inclui cabeçalhos,
 * mas qualquer log que os carregue (em `headers`, `req.headers` ou `res.headers`) passa por aqui.
 */
const CABECALHOS_SENSIVEIS = ['authorization', '["x-signature"]', 'cookie', '["set-cookie"]'];
const CAMINHOS_REDACT = ['headers', 'req.headers', 'res.headers'].flatMap((base) =>
  CABECALHOS_SENSIVEIS.map((c) => (c.startsWith('[') ? base + c : base + '.' + c)),
);

export interface OpcoesApp {
  /** Env já validado; se omitido, é carregado de `process.env`. */
  env?: Env;
  /** Liga/desliga o logger (default: liga, salvo `LOG_LEVEL=silent`). */
  logger?: boolean;
  /** Destino alternativo dos logs (testes de redaction). Desliga o pino-pretty. */
  destinoLog?: { write(msg: string): void };
  /** Db já criado (testes). Se omitido, a API cria um a partir de DATABASE_URL e o fecha no onClose. */
  db?: Db;
  /** Requisições por minuto por IP (default 300). */
  limiteTaxa?: number;
}

function opcoesLogger(
  env: Env,
  opcoes: OpcoesApp,
): Exclude<FastifyServerOptions['logger'], undefined> {
  if (opcoes.logger === false || env.LOG_LEVEL === 'silent') return false;
  return {
    level: env.LOG_LEVEL,
    redact: { paths: CAMINHOS_REDACT, censor: '[omitido]' },
    ...(opcoes.destinoLog ? { stream: opcoes.destinoLog } : {}),
    ...(env.NODE_ENV === 'development' && !opcoes.destinoLog
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : {}),
  };
}

/** Lê `x-request-id` do cliente se for um id razoável; senão gera um UUID. */
function gerarRequestId(req: { headers: Record<string, string | string[] | undefined> }): string {
  const recebido = req.headers['x-request-id'];
  if (typeof recebido === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(recebido)) return recebido;
  return randomUUID();
}

export async function buildApp(opcoes: OpcoesApp = {}) {
  const env = opcoes.env ?? carregarEnv(process.env);

  const app = Fastify({
    logger: opcoesLogger(env, opcoes),
    genReqId: gerarRequestId,
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
    bodyLimit: LIMITE_CORPO,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Ecoa o requestId em toda resposta, inclusive de erro.
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  registrarTratamentoDeErros(app);

  await app.register(sensible);
  await app.register(cors, {
    origin: env.WEB_URL,
    credentials: true,
    allowedHeaders: ['authorization', 'content-type', 'x-tenant', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });
  await app.register(rateLimit, {
    global: true,
    max: opcoes.limiteTaxa ?? 300,
    timeWindow: '1 minute',
  });
  // HS256 com o segredo compartilhado com o web (Auth.js).
  await app.register(jwt, {
    secret: env.AUTH_SECRET,
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });
  await app.register(authPlugin, {
    databaseUrl: env.DATABASE_URL,
    ...(opcoes.db ? { db: opcoes.db } : {}),
  });

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'API do Dashboard de Tráfego Pago (PASIO)',
        description:
          'API multiempresa. Erros seguem o contrato { erro: { codigo, mensagem, detalhes?, requestId } }.',
        version: VERSAO,
      },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(rotasHealth, { versao: VERSAO });
  await app.register(rotasAuth);

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
