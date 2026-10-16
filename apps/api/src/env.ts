import { z } from 'zod';
import { derivarChaveDeAuthSecret, lerChaveCifra } from './admin/cifra.js';

/**
 * Variáveis de ambiente da API, validadas na subida.
 * Em `NODE_ENV=test` os campos obrigatórios recebem defaults seguros para que os testes
 * rodem sem `.env`. Valores de segredo nunca aparecem em mensagens de erro nem em logs.
 */

const NIVEIS_LOG = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/** Defaults usados só quando NODE_ENV=test (nada aqui é segredo real). */
const DEFAULTS_TESTE = {
  DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5460/trafego_test',
  AUTH_SECRET: 'segredo-de-teste-somente-local-0123456789abcdef',
  WEB_URL: 'http://localhost:3000',
  LOG_LEVEL: 'silent',
} as const;

const schemaEnv = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z
      .string({ error: 'obrigatória' })
      .min(1, 'obrigatória')
      .refine(
        (v) => /^postgres(ql)?:\/\//.test(v),
        'deve começar com postgres:// ou postgresql://',
      ),
    AUTH_SECRET: z.string({ error: 'obrigatória' }).min(1, 'obrigatória'),
    WEB_URL: z.url({ error: 'deve ser uma URL válida' }).default('http://localhost:3000'),
    LOG_LEVEL: z
      .enum(NIVEIS_LOG, { error: `deve ser um de: ${NIVEIS_LOG.join(', ')}` })
      .default('info'),
    /** Chave AES-256-GCM dos segredos de webhook: 32 bytes em base64 ou hex. Obrigatória em produção. */
    WEBHOOK_CHAVE_CIFRA: z
      .string()
      .refine((v) => lerChaveCifra(v) !== null, 'deve ter 32 bytes em base64 ou hex')
      .optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.AUTH_SECRET.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_SECRET'],
        message: 'precisa ter no mínimo 32 caracteres em produção',
      });
    }
    if (env.NODE_ENV === 'production' && !env.WEBHOOK_CHAVE_CIFRA) {
      ctx.addIssue({
        code: 'custom',
        path: ['WEBHOOK_CHAVE_CIFRA'],
        message: 'obrigatória em produção',
      });
    }
  });

export type Env = z.infer<typeof schemaEnv>;

/** Erro de configuração: a mensagem lista as variáveis com problema, sem valores. */
export class ErroEnv extends Error {
  readonly variaveis: string[];
  constructor(problemas: { variavel: string; motivo: string }[]) {
    const linhas = problemas.map((p) => `  - ${p.variavel}: ${p.motivo}`).join('\n');
    super(`Variáveis de ambiente inválidas ou ausentes:\n${linhas}\nVeja .env.example.`);
    this.name = 'ErroEnv';
    this.variaveis = [...new Set(problemas.map((p) => p.variavel))];
  }
}

/** Trata string vazia como ausente (ex.: `AUTH_SECRET=` no .env). */
function limpar(fonte: Record<string, string | undefined>): Record<string, string | undefined> {
  const saida: Record<string, string | undefined> = {};
  for (const [chave, valor] of Object.entries(fonte)) {
    saida[chave] = valor === undefined || valor.trim() === '' ? undefined : valor;
  }
  return saida;
}

export function carregarEnv(fonte: Record<string, string | undefined> = process.env): Env {
  const bruto = limpar(fonte);
  const entrada =
    bruto['NODE_ENV'] === 'test' ? { ...DEFAULTS_TESTE, ...stripUndefined(bruto) } : bruto;
  const resultado = schemaEnv.safeParse(entrada);
  if (!resultado.success) {
    throw new ErroEnv(
      resultado.error.issues.map((i) => ({
        variavel: i.path.join('.') || '(raiz)',
        motivo: i.message,
      })),
    );
  }
  return resultado.data;
}

function stripUndefined(obj: Record<string, string | undefined>): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(obj)) if (valor !== undefined) saida[chave] = valor;
  return saida;
}

/**
 * Chave de cifra dos segredos de webhook. Sem `WEBHOOK_CHAVE_CIFRA` (só fora de produção), deriva
 * `sha256(AUTH_SECRET)` e chama `avisar` (uma vez por chamada; o app chama uma vez na subida).
 */
export function chaveCifraWebhook(env: Env, avisar?: (msg: string) => void): Buffer {
  const chave = env.WEBHOOK_CHAVE_CIFRA ? lerChaveCifra(env.WEBHOOK_CHAVE_CIFRA) : null;
  if (chave) return chave;
  avisar?.(
    'WEBHOOK_CHAVE_CIFRA ausente: usando chave derivada de AUTH_SECRET (só fora de produção)',
  );
  return derivarChaveDeAuthSecret(env.AUTH_SECRET);
}
