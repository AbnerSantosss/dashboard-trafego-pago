import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { isIP } from 'node:net';
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
import { carregarEnv, chaveCifraWebhook, type Env } from './env.js';
import { rotasApresentacao } from './admin/apresentacao.js';
import { rotasFontes } from './admin/fontes.js';
import { rotasAtribuicao, type OpcoesAtribuicao } from './atribuicao/rotas.js';
import { criarEnviadorEmail, type EnviadorEmail } from './conta/email.js';
import { criarClienteMeta, type ClienteMeta } from './custos/meta.js';
import { rotasCustos } from './custos/rotas.js';
import { rotasLeads } from './leads/rotas.js';
import { rotasConta } from './conta/rotas.js';
import type { Tentativas } from './conta/tentativas.js';
import { rotasUsuarios } from './conta/usuarios.js';
import { registrarTratamentoDeErros } from './erros.js';
import { rotasHealth } from './rotas/health.js';
import { rotasAuth, rotasSessaoDev } from './rotas/auth.js';
import { rotasMetricas } from './rotas/metricas.js';
import { authPlugin } from './auth/plugin.js';
import type { Db } from './db/client.js';
import { rotasWebhookAdmin, rotasWebhookRecebimento } from './rotas/webhooks.js';
import { lerConfigWebhooks } from './webhooks/config.js';
import { criarFilaMemoria, type Fila } from './webhooks/fila.js';
import {
  combinarSegredos,
  lerMapaSegredos,
  obterSegredoDeMapa,
  obterSegredoDoBanco,
  type ObterSegredo,
} from './webhooks/segredos.js';

const require = createRequire(import.meta.url);
const { version: VERSAO } = require('../package.json') as { version: string };

/** Limite de corpo: 1 MB, igual ao contrato do webhook (413 acima disso). */
export const LIMITE_CORPO = 1024 * 1024;

/**
 * Cabeçalhos que nunca vão para o log. O serializer padrão de `req` não inclui cabeçalhos,
 * mas qualquer log que os carregue (em `headers`, `req.headers` ou `res.headers`) passa por aqui.
 */
const CABECALHOS_SENSIVEIS = ['authorization', '["x-signature"]', 'cookie', '["set-cookie"]'];
const CAMINHOS_REDACT = [
  ...['headers', 'req.headers', 'res.headers'].flatMap((base) =>
    CABECALHOS_SENSIVEIS.map((c) => (c.startsWith('[') ? base + c : base + '.' + c)),
  ),
  // Precaução: se algum log levar o corpo, senhas e tokens não aparecem.
  ...['senha', 'senhaAtual', 'novaSenha', 'token', 'segredo'].map((c) => `*.${c}`),
];

/** O token do convite vai no caminho (`/convites/:token`): no log ele sai mascarado. */
export function urlParaLog(url: string): string {
  return url.replace(/(\/convites\/)[^/?#]+/, '$1[omitido]');
}

/**
 * Chave do limite de taxa: o IP real que a borda grava em cf-connecting-ip (o web repassa nas
 * chamadas que faz por ele). Em IPv6 cada cliente costuma ter um /64 inteiro, então a chave é o
 * prefixo, para que trocar de endereço dentro dele não zere o limite.
 */
export function chaveLimite(req: {
  headers: Record<string, string | string[] | undefined>;
  ip: string;
}): string {
  const borda = req.headers['cf-connecting-ip'];
  const ip = typeof borda === 'string' && isIP(borda) ? borda : req.ip;
  if (isIP(ip) !== 6 || ip.includes('.')) return ip;
  const [cabeca = '', cauda = ''] = ip.split('::');
  const partes = cabeca ? cabeca.split(':') : [];
  const fim = cauda ? cauda.split(':') : [];
  const blocos = [...partes, ...Array(8 - partes.length - fim.length).fill('0'), ...fim];
  return blocos.slice(0, 4).join(':').toLowerCase() + '::/64';
}

/** Cabeçalhos de segurança de toda resposta. A API só devolve JSON: nada pode virar página. */
const CABECALHOS_SEGURANCA: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
};

export interface OpcoesApp {
  /** Env já validado; se omitido, é carregado de `process.env`. */
  env?: Env;
  /** Liga/desliga o logger (default: liga, salvo `LOG_LEVEL=silent`). */
  logger?: boolean;
  /** Destino alternativo dos logs (testes de redaction). Desliga o pino-pretty. */
  destinoLog?: { write(msg: string): void };
  /** Db já criado (testes). Se omitido, a API cria um a partir de DATABASE_URL e o fecha no onClose. */
  db?: Db;
  /** Envio de e-mail (testes injetam um falso). Default: SMTP_* do ambiente. */
  email?: EnviadorEmail;
  /** Bloqueio por conta contra força bruta (testes injetam um com limite menor). */
  tentativas?: Tentativas;
  /** Tag de atribuição do GTM (testes zeram o atraso da agregação). */
  atribuicao?: OpcoesAtribuicao;
  /** Cliente da Graph API do Meta (testes injetam um falso). Default: `fetch` real, META_GRAPH_VERSAO. */
  meta?: { cliente?: ClienteMeta; agora?: () => Date };
  /** Requisições por minuto por IP (default 300). */
  limiteTaxa?: number;
  /** Ingestão de webhooks. Sem `fila`, usa uma fila em memória (testes; avisa fora de test). */
  webhooks?: {
    fila?: Fila;
    obterSegredo?: ObterSegredo;
    janelaSegundos?: number;
    limitePorMinuto?: number;
    agora?: () => number;
  };
}

function opcoesLogger(
  env: Env,
  opcoes: OpcoesApp,
): Exclude<FastifyServerOptions['logger'], undefined> {
  if (opcoes.logger === false || env.LOG_LEVEL === 'silent') return false;
  return {
    level: env.LOG_LEVEL,
    redact: { paths: CAMINHOS_REDACT, censor: '[omitido]' },
    serializers: {
      req: (req: { method: string; url: string; host: string; ip: string }) => ({
        method: req.method,
        url: urlParaLog(req.url),
        host: req.host,
        remoteAddress: req.ip,
      }),
    },
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
    // O Swagger UI (só fora de produção) é uma página com script: fica sem a CSP da API.
    if (!request.url.startsWith('/docs')) reply.headers(CABECALHOS_SEGURANCA);
    if (env.NODE_ENV === 'production') {
      reply.header('strict-transport-security', 'max-age=31536000');
    }
  });

  registrarTratamentoDeErros(app);

  await app.register(sensible);
  // O navegador não chama a API (o web fala com ela pelo servidor, com Bearer e sem cookie):
  // sem credenciais. A coleta da tag (/t) abre a própria rota para qualquer origem.
  await app.register(cors, {
    origin: env.WEB_URL,
    credentials: false,
    allowedHeaders: ['authorization', 'content-type', 'x-tenant', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });
  await app.register(rateLimit, {
    global: true,
    max: opcoes.limiteTaxa ?? 300,
    timeWindow: '1 minute',
    // Atrás do túnel Cloudflare todo visitante chega com o IP do gateway do Docker; vale também
    // para as rotas com limite próprio que não definem a sua chave.
    keyGenerator: chaveLimite,
  });
  // HS256 com o segredo compartilhado com o web (Auth.js).
  await app.register(jwt, {
    secret: env.AUTH_SECRET,
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });
  await app.register(authPlugin, {
    databaseUrl: env.DATABASE_URL,
    // Em produção só o login por senha emite token, e ele sempre leva a versão da senha.
    exigirVersaoSenha: env.NODE_ENV === 'production',
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
  // O mapa da API fica fora de produção (o contrato está em apps/api/docs/openapi.json).
  if (env.NODE_ENV !== 'production') await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(rotasHealth, { versao: VERSAO });
  await app.register(rotasAuth);
  // Login sem senha só fora de produção (temporário até o Auth.js, Fase 5).
  if (env.NODE_ENV !== 'production') await app.register(rotasSessaoDev);
  await app.register(rotasMetricas);
  await app.register(rotasLeads);

  // Conta (login por senha, perfil, convites) e usuários da empresa.
  const email = opcoes.email ?? criarEnviadorEmail(process.env, app.log);
  // Segredos de webhook, token do Meta e segredo da verificação em duas etapas usam esta chave.
  const chaveCifra = chaveCifraWebhook(env, (msg) => {
    if (env.NODE_ENV !== 'test') app.log.warn(msg);
  });
  await app.register(rotasConta, {
    email,
    webUrl: env.WEB_URL,
    segredo: env.AUTH_SECRET,
    chaveCifra,
    ...(opcoes.tentativas ? { tentativas: opcoes.tentativas } : {}),
  });
  await app.register(rotasUsuarios, { email, webUrl: env.WEB_URL });
  await app.register(rotasAtribuicao, opcoes.atribuicao ?? {});

  const configWebhooks = lerConfigWebhooks(process.env);
  const opcoesWh = opcoes.webhooks ?? {};
  if (!opcoesWh.fila && env.NODE_ENV !== 'test') {
    app.log.warn('webhooks sem fila pg-boss: jobs ficam só em memória (não processados)');
  }
  const fila = opcoesWh.fila ?? criarFilaMemoria();
  // Segredo HMAC: `sources.secret_enc` primeiro, WEBHOOK_SEGREDOS como fallback (D13).
  const mapaSegredos = lerMapaSegredos(configWebhooks.segredosJson);
  await app.register(rotasWebhookRecebimento, {
    fila,
    obterSegredo:
      opcoesWh.obterSegredo ??
      combinarSegredos(obterSegredoDoBanco(chaveCifra), obterSegredoDeMapa(mapaSegredos)),
    janelaSegundos: opcoesWh.janelaSegundos ?? configWebhooks.janelaSegundos,
    limitePorMinuto: opcoesWh.limitePorMinuto ?? configWebhooks.limitePorMinuto,
    ...(opcoesWh.agora ? { agora: opcoesWh.agora } : {}),
  });
  await app.register(rotasWebhookAdmin, { fila });

  // Administração por empresa (Fase 5 enxuta): apresentação e fontes de webhook.
  await app.register(rotasApresentacao);
  await app.register(rotasFontes, { chaveCifra, mapaSegredos });

  // Gasto em anúncios: lançamento manual e contas do Meta Ads (token cifrado com a mesma chave).
  await app.register(rotasCustos, {
    chaveCifra,
    cliente:
      opcoes.meta?.cliente ??
      criarClienteMeta(
        process.env.META_GRAPH_VERSAO ? { versao: process.env.META_GRAPH_VERSAO } : {},
      ),
    ...(opcoes.meta?.agora ? { agora: opcoes.meta.agora } : {}),
  });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
