/**
 * Gasto em anúncios da empresa ativa: lançamentos manuais (aba Gastos) e contas do Meta Ads
 * (aba Meta Ads). Tudo grava em `custos` e recalcula `metrics_daily` dos dias tocados, para o
 * Investimento do painel refletir o valor na hora.
 *
 * O token do Meta só entra (corpo do POST/PATCH) e é guardado cifrado; nunca volta nem é logado.
 */
import type { CustoResumo, MetaContaResumo } from '@trafego/contratos';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { cifrar } from '../admin/cifra.js';
import { custos, metaContas, tenants, type MetaConta } from '../db/client.js';
import { ErroApi, schemaRespostaErro } from '../erros.js';
import { limparCacheMetricas } from '../metricas/cache.js';
import { agregarIncremental, fusoDaEmpresa } from '../rules/agregar.js';
import { ErroMeta, normalizarContaId, type ClienteMeta } from './meta.js';
import { DIAS_CONEXAO, DIAS_MAXIMO, diaNoFuso, sincronizarConta } from './sincronizar.js';

export interface OpcoesCustos {
  /** Mesma chave AES-256-GCM de `sources.secret_enc`. */
  chaveCifra: Buffer;
  cliente: ClienteMeta;
  agora?: () => Date;
}

const DIA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD');
const LIMITE_LISTA = 1000;

const schemaCusto = z.object({
  id: z.uuid(),
  dia: z.string(),
  canal: z.string(),
  campanha: z.string(),
  valor: z.number(),
  origem: z.enum(['manual', 'meta']),
  conta: z.string().nullable(),
  descricao: z.string().nullable(),
  criadoEm: z.string(),
});
const schemaCustos = z.object({
  de: z.string(),
  ate: z.string(),
  custos: z.array(schemaCusto),
  total: z.number(),
  porCanal: z.array(z.object({ canal: z.string(), total: z.number() })),
});
const schemaCanal = z
  .string()
  .trim()
  .min(1, 'informe o canal')
  .max(40)
  .refine((c) => !c.startsWith('__'), 'canal reservado');
export const schemaCustoCriar = z.object({
  dia: DIA,
  canal: schemaCanal,
  campanha: z.string().trim().max(120).optional(),
  valor: z
    .number()
    .positive('o valor precisa ser maior que zero')
    .max(999_999_999)
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, 'use no máximo 2 casas'),
  descricao: z.string().trim().max(200).optional(),
});

const schemaSincronizacao = z.union([
  z.object({
    ok: z.literal(true),
    de: z.string(),
    ate: z.string(),
    linhas: z.number(),
    total: z.number(),
  }),
  z.object({ ok: z.literal(false), mensagem: z.string() }),
]);
const schemaMetaConta = z.object({
  id: z.uuid(),
  contaId: z.string(),
  nome: z.string(),
  moeda: z.string().nullable(),
  canal: z.string(),
  ativo: z.boolean(),
  ultimaSync: z.string().nullable(),
  ultimoErro: z.string().nullable(),
  criadoEm: z.string(),
});
const schemaToken = z.string().trim().min(20, 'token curto demais').max(1000);
export const schemaMetaContaCriar = z.object({
  contaId: z.string().trim().min(1).max(40),
  token: schemaToken,
  canal: schemaCanal.optional(),
});
export const schemaMetaContaAtualizar = z.object({
  token: schemaToken.optional(),
  canal: schemaCanal.optional(),
  ativo: z.boolean().optional(),
});
const schemaParams = z.object({ id: z.uuid() });

const seguranca = [{ bearerAuth: [] }];
const cabecalhos = z.object({ 'x-tenant': z.string().optional() });
const contaNaoEncontrada = () =>
  ErroApi.de('meta_conta_nao_encontrada', 'Conta do Meta não encontrada.');

function voltarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function resumoConta(c: MetaConta): MetaContaResumo {
  return {
    id: c.id,
    contaId: c.contaId,
    nome: c.nome,
    moeda: c.moeda,
    canal: c.canal,
    ativo: c.ativo,
    ultimaSync: c.ultimaSync?.toISOString() ?? null,
    ultimoErro: c.ultimoErro,
    criadoEm: c.createdAt.toISOString(),
  };
}

/** Violação de unicidade do Postgres (23505), mesmo embrulhada pelo drizzle em `cause`. */
function violouUnico(erro: unknown): boolean {
  let e = erro as { code?: string; cause?: unknown } | undefined;
  for (let i = 0; e && i < 5; i++) {
    if (e.code === '23505') return true;
    e = e.cause as typeof e;
  }
  return false;
}

export const rotasCustos: FastifyPluginAsyncZod<OpcoesCustos> = async (app, opcoes) => {
  const agora = opcoes.agora ?? (() => new Date());
  const preAnalista = [app.exigirEmpresa, app.exigirPapel('analista')];
  const preAdmin = [app.exigirEmpresa, app.exigirPapel('admin')];
  const erros = { 400: schemaRespostaErro, 401: schemaRespostaErro, 403: schemaRespostaErro };

  /** Lê o token no Meta; falha vira 422 `meta_recusou` com a mensagem já traduzida. */
  async function validarNoMeta(contaId: string, token: string) {
    try {
      return await opcoes.cliente.lerConta(contaId, token);
    } catch (e) {
      if (e instanceof ErroMeta) throw ErroApi.de('meta_recusou', e.message);
      throw e;
    }
  }

  // ---------------------------------------------------------------- gastos

  app.get(
    '/empresas/atual/custos',
    {
      preHandler: preAnalista,
      schema: {
        tags: ['custos'],
        summary: 'Gastos lançados (manual e Meta Ads) no período',
        description: 'Sem `de`/`ate`: últimos 30 dias no fuso da empresa. Até 1000 linhas.',
        security: seguranca,
        headers: cabecalhos,
        querystring: z.object({ de: DIA.optional(), ate: DIA.optional() }),
        response: { 200: schemaCustos, ...erros },
      },
    },
    async (request) => {
      const empresa = request.empresa!;
      return request.comTenant(async (tx) => {
        const fuso = await fusoDaEmpresa(tx, empresa.id);
        const ate = request.query.ate ?? diaNoFuso(agora(), fuso);
        const de = request.query.de ?? voltarDias(ate, 29);
        if (de > ate) throw ErroApi.de('requisicao_invalida', '`de` não pode ser depois de `ate`.');
        const filtro = and(gte(custos.dia, de), lte(custos.dia, ate));
        const linhas = await tx
          .select({ c: custos, conta: metaContas.nome })
          .from(custos)
          .leftJoin(metaContas, eq(metaContas.id, custos.metaContaId))
          .where(filtro)
          .orderBy(desc(custos.dia), desc(custos.createdAt))
          .limit(LIMITE_LISTA);
        const somas = await tx
          .select({ canal: custos.canal, total: sql<string>`sum(${custos.valor})` })
          .from(custos)
          .where(filtro)
          .groupBy(custos.canal)
          .orderBy(desc(sql`sum(${custos.valor})`));
        const porCanal = somas.map((s) => ({ canal: s.canal, total: Number(s.total) }));
        const lista: CustoResumo[] = linhas.map(({ c, conta }) => ({
          id: c.id,
          dia: c.dia,
          canal: c.canal,
          campanha: c.campanha,
          valor: Number(c.valor),
          origem: c.origem === 'meta' ? 'meta' : 'manual',
          conta: c.origem === 'meta' ? (conta ?? '') : null,
          descricao: c.descricao,
          criadoEm: c.createdAt.toISOString(),
        }));
        const total = Math.round(porCanal.reduce((s, p) => s + p.total * 100, 0)) / 100;
        return { de, ate, custos: lista, total, porCanal };
      });
    },
  );

  app.post(
    '/empresas/atual/custos',
    {
      preHandler: preAnalista,
      schema: {
        tags: ['custos'],
        summary: 'Lança um gasto manual e recalcula o dia no painel',
        security: seguranca,
        headers: cabecalhos,
        body: schemaCustoCriar,
        response: { 201: schemaCusto, ...erros },
      },
    },
    async (request, reply) => {
      const empresa = request.empresa!;
      const b = request.body;
      const criado = await request.comTenant(async (tx) => {
        const [linha] = await tx
          .insert(custos)
          .values({
            tenantId: empresa.id,
            dia: b.dia,
            canal: b.canal,
            campanha: b.campanha ?? '',
            valor: b.valor.toFixed(2),
            origem: 'manual',
            descricao: b.descricao ? b.descricao : null,
            criadoPor: request.usuario?.id ?? null,
          })
          .returning();
        await agregarIncremental(tx, empresa.id, await fusoDaEmpresa(tx, empresa.id), [b.dia]);
        return linha!;
      });
      limparCacheMetricas(empresa.id);
      request.log.info({ tenant: empresa.slug, dia: b.dia, canal: b.canal }, 'gasto lançado');
      return reply.status(201).send({
        id: criado.id,
        dia: criado.dia,
        canal: criado.canal,
        campanha: criado.campanha,
        valor: Number(criado.valor),
        origem: 'manual' as const,
        conta: null,
        descricao: criado.descricao,
        criadoEm: criado.createdAt.toISOString(),
      });
    },
  );

  app.delete(
    '/empresas/atual/custos/:id',
    {
      preHandler: preAnalista,
      schema: {
        tags: ['custos'],
        summary: 'Remove um gasto manual e recalcula o dia',
        description: 'Gastos do Meta não são removidos aqui: eles voltam na próxima sincronização.',
        security: seguranca,
        headers: cabecalhos,
        params: schemaParams,
        response: { 204: z.null(), ...erros, 404: schemaRespostaErro },
      },
    },
    async (request, reply) => {
      const empresa = request.empresa!;
      const apagado = await request.comTenant(async (tx) => {
        const [linha] = await tx
          .delete(custos)
          .where(and(eq(custos.id, request.params.id), eq(custos.origem, 'manual')))
          .returning({ dia: custos.dia });
        if (!linha) return false;
        await agregarIncremental(tx, empresa.id, await fusoDaEmpresa(tx, empresa.id), [linha.dia]);
        return true;
      });
      if (!apagado) throw ErroApi.de('custo_nao_encontrado', 'Gasto manual não encontrado.');
      limparCacheMetricas(empresa.id);
      return reply.status(204).send(null);
    },
  );

  // ---------------------------------------------------------------- Meta Ads

  app.get(
    '/empresas/atual/meta/contas',
    {
      preHandler: preAdmin,
      schema: {
        tags: ['custos'],
        summary: 'Contas de anúncios do Meta ligadas à empresa',
        security: seguranca,
        headers: cabecalhos,
        response: {
          200: z.object({ contas: z.array(schemaMetaConta), moedaEmpresa: z.string() }),
          ...erros,
        },
      },
    },
    async (request) => {
      const empresa = request.empresa!;
      return request.comTenant(async (tx) => {
        const contas = await tx.select().from(metaContas).orderBy(metaContas.createdAt);
        const [t] = await tx
          .select({ moeda: tenants.moeda })
          .from(tenants)
          .where(eq(tenants.id, empresa.id));
        return { contas: contas.map(resumoConta), moedaEmpresa: t?.moeda ?? 'BRL' };
      });
    },
  );

  app.post(
    '/empresas/atual/meta/contas',
    {
      preHandler: preAdmin,
      schema: {
        tags: ['custos'],
        summary: 'Conecta uma conta de anúncios do Meta e lê os últimos 30 dias de gasto',
        description:
          '422 meta_recusou se o Meta não aceitar o token; 409 meta_conta_existente se a conta já estiver ligada.',
        security: seguranca,
        headers: cabecalhos,
        body: schemaMetaContaCriar,
        response: {
          201: z.object({ conta: schemaMetaConta, sincronizacao: schemaSincronizacao }),
          ...erros,
          409: schemaRespostaErro,
          422: schemaRespostaErro,
        },
      },
    },
    async (request, reply) => {
      const empresa = request.empresa!;
      const contaId = normalizarContaId(request.body.contaId);
      if (!contaId) {
        throw ErroApi.de(
          'requisicao_invalida',
          'ID da conta inválido. Use act_ seguido dos números.',
        );
      }
      const info = await validarNoMeta(contaId, request.body.token);
      let criada: MetaConta | undefined;
      try {
        [criada] = await request.comTenant((tx) =>
          tx
            .insert(metaContas)
            .values({
              tenantId: empresa.id,
              contaId,
              nome: info.nome,
              moeda: info.moeda,
              canal: request.body.canal ?? 'Meta',
              tokenEnc: cifrar(request.body.token, opcoes.chaveCifra),
            })
            .returning(),
        );
      } catch (erro) {
        if (violouUnico(erro)) {
          throw ErroApi.de('meta_conta_existente', 'Esta conta já está conectada.', { contaId });
        }
        throw erro;
      }
      const sincronizacao = await sincronizarConta(app.db, empresa.id, criada!.id, {
        cliente: opcoes.cliente,
        chaveCifra: opcoes.chaveCifra,
        dias: DIAS_CONEXAO,
        agora,
      });
      const [atual] = await request.comTenant((tx) =>
        tx.select().from(metaContas).where(eq(metaContas.id, criada!.id)),
      );
      request.log.info({ tenant: empresa.slug, conta: contaId }, 'conta do Meta conectada');
      return reply.status(201).send({ conta: resumoConta(atual ?? criada!), sincronizacao });
    },
  );

  app.patch(
    '/empresas/atual/meta/contas/:id',
    {
      preHandler: preAdmin,
      schema: {
        tags: ['custos'],
        summary: 'Troca o token, o canal ou ativa/desativa a conta do Meta',
        description: 'Trocar o canal não move o gasto já gravado; sincronize de novo para isso.',
        security: seguranca,
        headers: cabecalhos,
        params: schemaParams,
        body: schemaMetaContaAtualizar,
        response: {
          200: schemaMetaConta,
          ...erros,
          404: schemaRespostaErro,
          422: schemaRespostaErro,
        },
      },
    },
    async (request) => {
      const { token, canal, ativo } = request.body;
      const [atual] = await request.comTenant((tx) =>
        tx.select().from(metaContas).where(eq(metaContas.id, request.params.id)),
      );
      if (!atual) throw contaNaoEncontrada();
      if (token !== undefined) await validarNoMeta(atual.contaId, token);
      const [linha] = await request.comTenant((tx) =>
        tx
          .update(metaContas)
          .set({
            ...(token !== undefined
              ? { tokenEnc: cifrar(token, opcoes.chaveCifra), ultimoErro: null }
              : {}),
            ...(canal !== undefined ? { canal } : {}),
            ...(ativo !== undefined ? { ativo } : {}),
            updatedAt: agora(),
          })
          .where(eq(metaContas.id, atual.id))
          .returning(),
      );
      if (!linha) throw contaNaoEncontrada();
      return resumoConta(linha);
    },
  );

  app.post(
    '/empresas/atual/meta/contas/:id/sincronizar',
    {
      preHandler: preAdmin,
      schema: {
        tags: ['custos'],
        summary: 'Relê o gasto da conta no Meta (1 a 90 dias, padrão 30)',
        description: 'Falha do Meta volta como `{ ok: false, mensagem }` e fica em `ultimoErro`.',
        security: seguranca,
        headers: cabecalhos,
        params: schemaParams,
        body: z.object({ dias: z.number().int().min(1).max(DIAS_MAXIMO).optional() }).optional(),
        response: { 200: schemaSincronizacao, ...erros, 404: schemaRespostaErro },
      },
    },
    async (request) => {
      const empresa = request.empresa!;
      const [conta] = await request.comTenant((tx) =>
        tx
          .select({ id: metaContas.id })
          .from(metaContas)
          .where(eq(metaContas.id, request.params.id)),
      );
      if (!conta) throw contaNaoEncontrada();
      return sincronizarConta(app.db, empresa.id, conta.id, {
        cliente: opcoes.cliente,
        chaveCifra: opcoes.chaveCifra,
        dias: request.body?.dias ?? DIAS_CONEXAO,
        agora,
      });
    },
  );

  app.delete(
    '/empresas/atual/meta/contas/:id',
    {
      preHandler: preAdmin,
      schema: {
        tags: ['custos'],
        summary: 'Desconecta a conta do Meta e apaga o gasto lido dela',
        security: seguranca,
        headers: cabecalhos,
        params: schemaParams,
        response: { 204: z.null(), ...erros, 404: schemaRespostaErro },
      },
    },
    async (request, reply) => {
      const empresa = request.empresa!;
      const apagada = await request.comTenant(async (tx) => {
        const dias = await tx
          .selectDistinct({ dia: custos.dia })
          .from(custos)
          .where(eq(custos.metaContaId, request.params.id));
        const [linha] = await tx
          .delete(metaContas)
          .where(eq(metaContas.id, request.params.id))
          .returning({ contaId: metaContas.contaId });
        if (!linha) return null;
        // O cascade já apagou os custos da conta; recalcula os dias que tinham gasto dela.
        await agregarIncremental(
          tx,
          empresa.id,
          await fusoDaEmpresa(tx, empresa.id),
          dias.map((d) => d.dia),
        );
        return linha;
      });
      if (!apagada) throw contaNaoEncontrada();
      limparCacheMetricas(empresa.id);
      request.log.info({ tenant: empresa.slug, conta: apagada.contaId }, 'conta do Meta removida');
      return reply.status(204).send(null);
    },
  );
};
