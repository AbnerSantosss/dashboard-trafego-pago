/**
 * Lista por etapa do funil e ficha do lead (clique no funil do painel). Contrato em
 * `@trafego/contratos` (leads.ts).
 *
 * As duas rotas exigem `analista`: mostram dados de pessoas. Tudo roda em `comTenant` (RLS), então
 * nenhuma consulta filtra `tenant_id` à mão. O período padrão é o mesmo do painel.
 */
import type {
  EtapaLista,
  EventoLead,
  EventosEtapaResposta,
  FichaLead,
  OrigemEvento,
  ToqueLead,
  WebhookLead,
} from '@trafego/contratos';
import { ETAPAS_LISTA, ORDENS_LISTA } from '@trafego/contratos';
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  attributionTouches,
  events,
  sources,
  webhookEvents,
  type Evento,
  type Tx,
} from '../db/client.js';
import { ErroApi, schemaRespostaErro } from '../erros.js';
import { resolverPeriodo } from '../metricas/consulta.js';
import { fusoDaEmpresa } from '../rules/agregar.js';

const DIA = z.iso.date().describe('AAAA-MM-DD, inclusivo, no fuso da empresa');
const LIMITE_EVENTOS_FICHA = 500;
const LIMITE_TOQUES = 100;
const LIMITE_WEBHOOKS = 50;

export const schemaEventosQuery = z.object({
  etapa: z.enum(ETAPAS_LISTA),
  de: DIA.optional(),
  ate: DIA.optional(),
  canal: z.string().min(1).max(80).default('todos'),
  campanha: z.string().min(1).max(200).default('todas'),
  busca: z.string().trim().max(100).default(''),
  ordem: z.enum(ORDENS_LISTA).default('recentes'),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  limite: z.coerce.number().int().min(1).max(500).default(200),
});
const LIMITE_OPCOES = 200;

const texto = z.string().nullable();
const schemaEvento = z.object({
  id: z.uuid(),
  tipo: z.enum(['clique', 'visita', 'cadastro', 'ftd', 'deposito', 'gasto']),
  ocorridoEm: z.string(),
  valor: z.number().nullable(),
  moeda: texto,
  canal: z.string(),
  campanha: texto,
  pagina: texto,
  leadKey: texto,
  utmSource: texto,
  utmMedium: texto,
  utmCampaign: texto,
  referrer: texto,
  origem: z.enum(['webhook', 'tag', 'manual']),
});
const schemaEventosResposta = z.object({
  etapa: z.enum(ETAPAS_LISTA),
  periodo: z.object({ de: z.string(), ate: z.string() }),
  fuso: z.string(),
  total: z.number(),
  valorTotal: z.number().nullable(),
  eventos: z.array(schemaEvento),
  porCanal: z.array(z.object({ canal: z.string(), total: z.number() })),
  opcoes: z.object({ canais: z.array(z.string()), campanhas: z.array(z.string()) }),
});
const schemaFicha = z.object({
  leadKey: z.string(),
  canalOrigem: texto,
  primeiroEvento: texto,
  ultimoEvento: texto,
  cadastroEm: texto,
  ftd: z.object({ em: z.string(), valor: z.number() }).nullable(),
  depositos: z.object({ quantidade: z.number(), total: z.number() }),
  eventos: z.array(schemaEvento),
  toques: z.array(
    z.object({
      id: z.uuid(),
      tipo: z.string(),
      recebidoEm: z.string(),
      url: texto,
      referrer: texto,
      utmSource: texto,
      utmMedium: texto,
      utmCampaign: texto,
      utmContent: texto,
      utmTerm: texto,
      clickIds: z.record(z.string(), z.string()),
    }),
  ),
  webhooks: z.array(
    z.object({
      id: z.uuid(),
      fonte: z.string(),
      eventKey: z.string(),
      recebidoEm: z.string(),
      status: z.enum(['recebido', 'processado', 'erro']),
      payload: z.unknown(),
    }),
  ),
});

const seguranca = [{ bearerAuth: [] }];
const cabecalhos = z.object({ 'x-tenant': z.string().optional() });
const erros = {
  400: schemaRespostaErro,
  401: schemaRespostaErro,
  403: schemaRespostaErro,
};

/** Filtro SQL de cada etapa do funil (mesma regra da agregação em `rules/agregar.ts`). */
function filtroEtapa(etapa: EtapaLista): SQL {
  switch (etapa) {
    case 'base':
      return sql`${events.type} = 'clique' and ${events.base}`;
    case 'cliques':
      return sql`${events.type} = 'clique' and not ${events.base}`;
    case 'visitas':
      return sql`${events.type} = 'visita'`;
    case 'cadastro':
      return sql`${events.type} = 'cadastro'`;
    case 'ftd':
      return sql`${events.type} = 'ftd'`;
    case 'redeposito':
      return sql`${events.type} = 'deposito'`;
    case 'depositos':
      return sql`${events.type} in ('ftd', 'deposito')`;
  }
}

const ETAPAS_COM_VALOR: ReadonlySet<EtapaLista> = new Set(['ftd', 'redeposito', 'depositos']);

/** `%`, `_` e `\` da busca valem como texto, não como curinga do `ilike`. */
function padraoBusca(busca: string): string {
  return `%${busca.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function origemDe(e: Evento): OrigemEvento {
  if (e.webhookEventId) return 'webhook';
  return e.type === 'visita' ? 'tag' : 'manual';
}

function paraEvento(e: Evento): EventoLead {
  return {
    id: e.id,
    tipo: e.type,
    ocorridoEm: e.occurredAt.toISOString(),
    valor: e.value === null ? null : Number(e.value),
    moeda: e.currency,
    canal: e.channel,
    campanha: e.campaign,
    pagina: e.page,
    leadKey: e.leadKey,
    utmSource: e.utmSource,
    utmMedium: e.utmMedium,
    utmCampaign: e.utmCampaign,
    referrer: e.referrer,
    origem: origemDe(e),
  };
}

/** Chaves cujo valor nunca aparece na ficha (o resto do corpo do webhook vai como veio). */
const CHAVE_SENSIVEL =
  /senha|password|passwd|token|secret|segredo|cart[aã]o|card|cvv|cpf|cnpj|documento|document|pix|cookie|authorization|api[_-]?key|(^|[_.-])(rg|pin|auth)($|[_.-])/i;
/** Dados de contato: aparecem só em parte, o bastante para o time reconhecer o lead. */
const CHAVE_CONTATO = /telefone|phone|celular|whatsapp|e-?mail/i;

function mascararContato(x: unknown): unknown {
  if (typeof x !== 'string' && typeof x !== 'number') return x;
  const s = String(x);
  const arroba = s.indexOf('@');
  if (arroba > 0) return `${s[0]}•••${s.slice(arroba)}`;
  const digitos = s.replace(/\D/g, '');
  return digitos.length > 4 ? `••••${digitos.slice(-4)}` : '••••';
}

/** Copia o corpo do webhook trocando valores sensíveis por `••••` (contato fica em parte). */
export function mascararPayload(v: unknown, nivel = 0): unknown {
  if (nivel > 20) return '…';
  if (Array.isArray(v)) return v.map((x) => mascararPayload(x, nivel + 1));
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [
        k,
        CHAVE_SENSIVEL.test(k)
          ? '••••'
          : CHAVE_CONTATO.test(k)
            ? mascararContato(x)
            : mascararPayload(x, nivel + 1),
      ]),
    );
  }
  return v;
}

const CLICK_IDS = [
  ['gclid', 'gclid'],
  ['gbraid', 'gbraid'],
  ['wbraid', 'wbraid'],
  ['fbclid', 'fbclid'],
  ['fbp', 'fbp'],
  ['ttclid', 'ttclid'],
  ['ttp', 'ttp'],
  ['kwaiClickId', 'clickid'],
  ['tblci', 'tblci'],
] as const;

async function listarEtapa(
  tx: Tx,
  tenantId: string,
  q: z.infer<typeof schemaEventosQuery>,
): Promise<EventosEtapaResposta> {
  const fuso = await fusoDaEmpresa(tx, tenantId);
  const periodo = await resolverPeriodo(
    tx,
    { de: q.de, ate: q.ate, comparar: 'nenhum', canal: q.canal, campanha: q.campanha },
    fuso,
  );
  const dia = sql`(${events.occurredAt} at time zone ${fuso})::date`;
  // `base` vale para as opções de filtro; `onde` acrescenta canal, campanha e busca.
  const base = and(
    filtroEtapa(q.etapa),
    sql`${dia} between ${periodo.de}::date and ${periodo.ate}::date`,
    sql`left(${events.channel}, 2) <> '__'`,
  )!;
  const filtros: SQL[] = [base];
  if (q.canal !== 'todos') filtros.push(eq(events.channel, q.canal));
  if (q.campanha !== 'todas') filtros.push(eq(events.campaign, q.campanha));
  if (q.busca) {
    const padrao = padraoBusca(q.busca);
    filtros.push(sql`(${events.leadKey} ilike ${padrao} or ${events.campaign} ilike ${padrao})`);
  }
  const onde = and(...filtros);

  const ordem =
    q.ordem === 'antigos'
      ? [asc(events.occurredAt), asc(events.id)]
      : q.ordem === 'valor'
        ? [sql`${events.value} desc nulls last`, desc(events.occurredAt), desc(events.id)]
        : [desc(events.occurredAt), desc(events.id)];
  const linhas = await tx
    .select()
    .from(events)
    .where(onde)
    .orderBy(...ordem)
    .offset(q.offset)
    .limit(q.limite);
  const somas = await tx
    .select({
      canal: events.channel,
      total: sql<string>`count(*)`,
      valor: sql<string | null>`sum(${events.value})`,
    })
    .from(events)
    .where(onde)
    .groupBy(events.channel)
    .orderBy(desc(sql`count(*)`));
  const canais = await tx
    .selectDistinct({ v: events.channel })
    .from(events)
    .where(base)
    .orderBy(events.channel)
    .limit(LIMITE_OPCOES);
  const campanhas = await tx
    .selectDistinct({ v: events.campaign })
    .from(events)
    .where(and(base, sql`coalesce(${events.campaign}, '') <> ''`))
    .orderBy(events.campaign)
    .limit(LIMITE_OPCOES);
  const total = somas.reduce((s, x) => s + Number(x.total), 0);
  const comValor = ETAPAS_COM_VALOR.has(q.etapa);
  const valorTotal = comValor
    ? Math.round(somas.reduce((s, x) => s + Number(x.valor ?? 0) * 100, 0)) / 100
    : null;
  return {
    etapa: q.etapa,
    periodo,
    fuso,
    total,
    valorTotal,
    eventos: linhas.map(paraEvento),
    porCanal: somas.map((x) => ({ canal: x.canal, total: Number(x.total) })),
    opcoes: {
      canais: canais.map((x) => x.v),
      campanhas: campanhas.flatMap((x) => (x.v ? [x.v] : [])),
    },
  };
}

async function montarFicha(tx: Tx, leadKey: string): Promise<FichaLead> {
  const linhas = await tx
    .select()
    .from(events)
    .where(eq(events.leadKey, leadKey))
    .orderBy(desc(events.occurredAt), desc(events.id))
    .limit(LIMITE_EVENTOS_FICHA);
  const toques = await tx
    .select()
    .from(attributionTouches)
    .where(eq(attributionTouches.leadKey, leadKey))
    .orderBy(desc(attributionTouches.recebidoEm))
    .limit(LIMITE_TOQUES);
  if (linhas.length === 0 && toques.length === 0) {
    throw ErroApi.de('lead_nao_encontrado', 'Nenhum evento com este id de usuário.');
  }

  const idsBrutos = [...new Set(linhas.map((e) => e.webhookEventId).filter((x) => x !== null))];
  const brutos = idsBrutos.length
    ? await tx
        .select({ w: webhookEvents, fonte: sources.nome })
        .from(webhookEvents)
        .leftJoin(sources, eq(sources.id, webhookEvents.sourceId))
        .where(inArray(webhookEvents.id, idsBrutos))
        .orderBy(desc(webhookEvents.receivedAt))
        .limit(LIMITE_WEBHOOKS)
    : [];

  // Linhas vêm do mais recente para o mais antigo; `cronologica` do mais antigo para o mais recente.
  const cronologica = [...linhas].reverse();
  const antigo = cronologica[0] ?? null;
  const cadastro = cronologica.find((e) => e.type === 'cadastro');
  const ftd = cronologica.find((e) => e.type === 'ftd');
  const depositos = linhas.filter((e) => e.type === 'deposito' || e.type === 'ftd');
  const totalDepositos =
    Math.round(depositos.reduce((s, e) => s + Number(e.value ?? 0) * 100, 0)) / 100;

  return {
    leadKey,
    canalOrigem: antigo?.channel ?? null,
    primeiroEvento: antigo?.occurredAt.toISOString() ?? null,
    ultimoEvento: linhas[0]?.occurredAt.toISOString() ?? null,
    cadastroEm: cadastro?.occurredAt.toISOString() ?? null,
    ftd: ftd ? { em: ftd.occurredAt.toISOString(), valor: Number(ftd.value ?? 0) } : null,
    depositos: { quantidade: depositos.length, total: totalDepositos },
    eventos: linhas.map(paraEvento),
    toques: toques.map((t): ToqueLead => ({
      id: t.id,
      tipo: t.tipo,
      recebidoEm: t.recebidoEm.toISOString(),
      url: t.url,
      referrer: t.referrer,
      utmSource: t.utmSource,
      utmMedium: t.utmMedium,
      utmCampaign: t.utmCampaign,
      utmContent: t.utmContent,
      utmTerm: t.utmTerm,
      clickIds: Object.fromEntries(
        CLICK_IDS.flatMap(([campo, nome]) => (t[campo] ? [[nome, t[campo]!]] : [])),
      ),
    })),
    webhooks: brutos.map(({ w, fonte }): WebhookLead => ({
      id: w.id,
      fonte: fonte ?? '',
      eventKey: w.eventKey,
      recebidoEm: w.receivedAt.toISOString(),
      status: w.status,
      payload: mascararPayload(w.payload),
    })),
  };
}

export const rotasLeads: FastifyPluginAsyncZod = async (app) => {
  const preAnalista = [app.exigirEmpresa, app.exigirPapel('analista')];

  app.get(
    '/empresas/atual/eventos',
    {
      preHandler: preAnalista,
      schema: {
        tags: ['leads'],
        summary: 'Eventos de uma etapa do funil no período (lista do clique no funil)',
        description:
          'Analista ou acima. Mesmo período padrão e filtros (canal, campanha) do painel, mais ' +
          '`busca` (id do usuário ou campanha), `ordem` e `offset` para a tela expandida. Até ' +
          '`limite` (padrão 200, máximo 500); `total` conta todos. `opcoes` ignora canal, ' +
          'campanha e busca. `depositos` junta FTD e depósitos seguintes.',
        security: seguranca,
        headers: cabecalhos,
        querystring: schemaEventosQuery,
        response: { 200: schemaEventosResposta, ...erros },
      },
    },
    async (request) =>
      request.comTenant((tx) => listarEtapa(tx, request.empresa!.id, request.query)),
  );

  app.get(
    '/empresas/atual/leads/:leadKey',
    {
      preHandler: preAnalista,
      schema: {
        tags: ['leads'],
        summary: 'Ficha do lead: eventos, toques da tag e corpo dos webhooks',
        description:
          'Analista ou acima. `leadKey` é o id do usuário na plataforma (`user_id`). Campos de ' +
          'senha, token e cartão do corpo do webhook voltam mascarados.',
        security: seguranca,
        headers: cabecalhos,
        params: z.object({ leadKey: z.string().min(1).max(200) }),
        response: { 200: schemaFicha, 404: schemaRespostaErro, ...erros },
      },
    },
    async (request) => request.comTenant((tx) => montarFicha(tx, request.params.leadKey)),
  );
};
