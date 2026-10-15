import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { z, ZodError } from 'zod';

/**
 * Contrato de erros da API. Toda resposta de erro tem o formato:
 *   { "erro": { "codigo": "nao_encontrado", "mensagem": "...", "detalhes"?: ..., "requestId": "..." } }
 * Códigos em snake_case pt-BR. Documentação em apps/api/docs/erros.md.
 */

export const CODIGOS_ERRO = {
  requisicao_invalida: 400,
  validacao_invalida: 400,
  json_invalido: 400,
  cabecalho_ausente: 400,
  empresa_nao_informada: 400,
  nao_autenticado: 401,
  assinatura_invalida: 401,
  timestamp_fora_da_janela: 401,
  token_invalido: 401,
  acesso_negado: 403,
  nao_encontrado: 404,
  metodo_nao_permitido: 405,
  conflito: 409,
  corpo_grande: 413,
  tipo_conteudo_invalido: 415,
  limite_excedido: 429,
  erro_interno: 500,
  servico_indisponivel: 503,
} as const;

export type CodigoErro = keyof typeof CODIGOS_ERRO;

/** Detalhe de validação por campo. */
export interface DetalheCampo {
  origem: string;
  campo: string;
  mensagem: string;
}

export class ErroApi extends Error {
  readonly status: number;
  readonly codigo: CodigoErro;
  readonly detalhes: unknown;

  constructor(status: number, codigo: CodigoErro, mensagem: string, detalhes?: unknown) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }

  /** Atalho que usa o status padrão do código. */
  static de(codigo: CodigoErro, mensagem: string, detalhes?: unknown): ErroApi {
    return new ErroApi(CODIGOS_ERRO[codigo], codigo, mensagem, detalhes);
  }
}

/** Schema zod da resposta de erro, para declarar em `response` das rotas (OpenAPI). */
export const schemaRespostaErro = z
  .object({
    erro: z.object({
      codigo: z.string().meta({ example: 'nao_encontrado' }),
      mensagem: z.string(),
      detalhes: z.unknown().optional(),
      requestId: z.string(),
    }),
  })
  .meta({ description: 'Formato único de erro da API' });

export type RespostaErro = z.infer<typeof schemaRespostaErro>;

/** Código padrão por status HTTP, quando o erro não traz um código próprio. */
const CODIGO_POR_STATUS: Record<number, CodigoErro> = {
  400: 'requisicao_invalida',
  401: 'nao_autenticado',
  403: 'acesso_negado',
  404: 'nao_encontrado',
  405: 'metodo_nao_permitido',
  409: 'conflito',
  413: 'corpo_grande',
  415: 'tipo_conteudo_invalido',
  429: 'limite_excedido',
  503: 'servico_indisponivel',
};

const MENSAGEM_POR_CODIGO: Partial<Record<CodigoErro, string>> = {
  corpo_grande: 'Corpo da requisição acima do limite permitido (1 MB).',
  json_invalido: 'O corpo enviado não é um JSON válido.',
  tipo_conteudo_invalido: 'Tipo de conteúdo não suportado.',
  limite_excedido: 'Limite de requisições excedido. Tente novamente mais tarde.',
  erro_interno: 'Erro interno. Informe o requestId ao suporte.',
};

interface ErroNormalizado {
  status: number;
  codigo: CodigoErro;
  mensagem: string;
  detalhes?: unknown;
}

function detalhesZod(erro: ZodError, origem: string): DetalheCampo[] {
  return erro.issues.map((i) => ({
    origem,
    campo: i.path.join('.') || '(raiz)',
    mensagem: i.message,
  }));
}

/** Converte qualquer erro lançado em rota/hook para o contrato. Exportada para testes. */
export function normalizarErro(erro: unknown): ErroNormalizado {
  if (erro instanceof ErroApi) {
    return erro.detalhes === undefined
      ? { status: erro.status, codigo: erro.codigo, mensagem: erro.message }
      : {
          status: erro.status,
          codigo: erro.codigo,
          mensagem: erro.message,
          detalhes: erro.detalhes,
        };
  }

  // Validação de schema da rota (body, querystring, params, headers) via type provider zod.
  if (hasZodFastifySchemaValidationErrors(erro)) {
    const origem = (erro as FastifyError).validationContext ?? 'body';
    const detalhes: DetalheCampo[] = erro.validation.map((v) => ({
      origem,
      campo: v.instancePath.replace(/^\//, '').replace(/\//g, '.') || '(raiz)',
      mensagem: v.message ?? 'inválido',
    }));
    return {
      status: 400,
      codigo: 'validacao_invalida',
      mensagem: 'Dados da requisição inválidos.',
      detalhes,
    };
  }

  // ZodError lançado manualmente dentro de um handler.
  if (erro instanceof ZodError) {
    return {
      status: 400,
      codigo: 'validacao_invalida',
      mensagem: 'Dados da requisição inválidos.',
      detalhes: detalhesZod(erro, 'body'),
    };
  }

  // Resposta que não bate com o schema declarado: bug nosso, nunca do cliente.
  if (isResponseSerializationError(erro)) {
    return { status: 500, codigo: 'erro_interno', mensagem: MENSAGEM_POR_CODIGO.erro_interno! };
  }

  const e = erro as Partial<FastifyError> | undefined;
  const status = typeof e?.statusCode === 'number' ? e.statusCode : 500;

  if (status >= 500 || status < 400) {
    return {
      status: status >= 500 ? status : 500,
      codigo: status === 503 ? 'servico_indisponivel' : 'erro_interno',
      mensagem: MENSAGEM_POR_CODIGO.erro_interno!,
    };
  }

  let codigo: CodigoErro = CODIGO_POR_STATUS[status] ?? 'requisicao_invalida';
  if (e?.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || erro instanceof SyntaxError)
    codigo = 'json_invalido';
  if (e?.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') codigo = 'json_invalido';
  if (typeof e?.code === 'string' && e.code.startsWith('FST_JWT_')) codigo = 'token_invalido';
  if (status === 429) codigo = 'limite_excedido';

  return {
    status,
    codigo,
    mensagem: MENSAGEM_POR_CODIGO[codigo] ?? e?.message ?? 'Requisição inválida.',
  };
}

function enviar(reply: FastifyReply, request: FastifyRequest, n: ErroNormalizado): FastifyReply {
  const corpo: RespostaErro = {
    erro: {
      codigo: n.codigo,
      mensagem: n.mensagem,
      ...(n.detalhes === undefined ? {} : { detalhes: n.detalhes }),
      requestId: String(request.id),
    },
  };
  // Serializa à mão para não depender do schema de resposta da rota que falhou.
  reply.header('x-request-id', request.id);
  return reply
    .status(n.status)
    .type('application/json; charset=utf-8')
    .serializer(JSON.stringify)
    .send(corpo);
}

/** Registra o handler global de erros e o de rota inexistente. */
export function registrarTratamentoDeErros(app: FastifyInstance): void {
  app.setErrorHandler((erro, request, reply) => {
    const n = normalizarErro(erro);
    if (n.status >= 500) {
      // Stack só no log; o cliente recebe mensagem genérica com o requestId.
      request.log.error({ err: erro }, 'erro não tratado');
    } else {
      request.log.info({ codigo: n.codigo, status: n.status }, 'requisição rejeitada');
    }
    return enviar(reply, request, n);
  });

  app.setNotFoundHandler((request, reply) => {
    return enviar(reply, request, {
      status: 404,
      codigo: 'nao_encontrado',
      mensagem: `Rota ${request.method} ${request.url.split('?')[0]} não encontrada.`,
    });
  });
}
