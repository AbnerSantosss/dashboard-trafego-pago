/**
 * Dados fictícios recentes da empresa demo, para ver o painel com movimento real nos atalhos
 * Hoje, Ontem e Últimos 7 dias. Uso (só local):
 *
 *   pnpm --filter @trafego/api db:ficticio            # gera os últimos 30 dias até agora
 *   pnpm --filter @trafego/api db:ficticio --dias 60  # outra janela
 *   pnpm --filter @trafego/api db:ficticio --remover  # apaga tudo o que este script gravou
 *
 * Cobre todos os canais da apresentação (Meta, Email, SMS, Afiliados, Outros) com campanhas,
 * gastos, base contatada, cliques, visitas, cadastros, FTDs e depósitos. Os eventos passam pela
 * mesma agregação da aplicação (`reagregarDias`), então funil, tabela, lista e ficha conciliam.
 *
 * Marcas para remover sem tocar no resto: chaves de webhook e leads com prefixo `fic-` (os
 * eventos saem junto pela FK em cascata) e gastos com a descrição `DESCRICAO_GASTO`.
 * Pessoas fictícias: e-mail em `exemplo.com` e telefone zerado. Determinístico por dia.
 */
import { fileURLToPath } from 'node:url';
import { localParaUtc } from '@trafego/rules';
import { sql } from 'drizzle-orm';
import {
  attributionTouches,
  comTenant,
  criarDb,
  custos,
  events,
  sources,
  tenants,
  webhookEvents,
  type Db,
} from './client.js';
import { uuidDe } from './seed/pessoas.js';
import type { NovoEvento, NovoWebhookEvent } from './schema.js';
import { SLUG_DEMO } from './seed.js';
import { reagregarDias } from '../rules/agregar.js';

export const PREFIXO_FICTICIO = 'fic-';
export const DESCRICAO_GASTO = 'Dado fictício (gerador)';

interface PerfilCanal {
  canal: string;
  campanhas: string[];
  /** Volumes médios por dia (o dia varia ±25% e cai no fim de semana). */
  base: number;
  cliques: number;
  visitas: number;
  cadastros: number;
  ftds: number;
  ticket: number;
  /** Gasto médio por dia em reais; null = canal sem custo (orgânico). */
  gasto: number | null;
  utm: { source?: string; medium?: string; referrer?: string };
  meta?: boolean;
}

const PERFIS: PerfilCanal[] = [
  {
    canal: 'Meta',
    campanhas: ['cassino-outubro', 'esportes-lal-1', 'roleta-remarketing'],
    base: 0,
    cliques: 620,
    visitas: 390,
    cadastros: 64,
    ftds: 17,
    ticket: 85,
    gasto: 1450,
    utm: { source: 'facebook', medium: 'paid_social' },
    meta: true,
  },
  {
    canal: 'Email',
    campanhas: ['boas-vindas', 'bonus-semana'],
    base: 900,
    cliques: 150,
    visitas: 105,
    cadastros: 21,
    ftds: 6,
    ticket: 70,
    gasto: 60,
    utm: { source: 'newsletter', medium: 'email' },
  },
  {
    canal: 'SMS',
    campanhas: ['reativacao-30d', 'cashback-sexta'],
    base: 650,
    cliques: 95,
    visitas: 62,
    cadastros: 13,
    ftds: 4,
    ticket: 60,
    gasto: 130,
    utm: { source: 'sms', medium: 'sms' },
  },
  {
    canal: 'Afiliados',
    campanhas: ['parceiro-apostaboa', 'parceiro-tipster'],
    base: 0,
    cliques: 260,
    visitas: 175,
    cadastros: 33,
    ftds: 10,
    ticket: 110,
    gasto: 520,
    utm: { medium: 'affiliate' },
  },
  {
    canal: 'Outros',
    campanhas: [''],
    base: 0,
    cliques: 0,
    visitas: 120,
    cadastros: 16,
    ftds: 4,
    ticket: 75,
    gasto: null,
    utm: { referrer: 'https://www.google.com/' },
  },
];

const NOMES = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elisa',
  'Fábio',
  'Gabriela',
  'Heitor',
  'Isabela',
  'João',
  'Karina',
  'Lucas',
  'Marina',
  'Nicolas',
  'Olívia',
  'Paulo',
  'Rafael',
  'Sabrina',
  'Tiago',
  'Vinícius',
  'Wesley',
  'Yasmin',
  'Camila',
  'Mateus',
];
const SOBRENOMES = [
  'Souza',
  'Lima',
  'Mendes',
  'Rocha',
  'Prado',
  'Nunes',
  'Reis',
  'Alves',
  'Costa',
  'Dias',
  'Lopes',
  'Martins',
  'Teles',
  'Freitas',
  'Ramos',
  'Barros',
  'Pinto',
  'Moura',
  'Cardoso',
];
const UFS = ['SP', 'RJ', 'MG', 'PR', 'BA', 'RS', 'SC', 'PE', 'GO'];

/** Gerador pseudoaleatório pequeno e estável (mulberry32) a partir de um texto. */
function gerador(semente: string): () => number {
  let a = 0;
  for (const c of semente) a = (Math.imul(a ^ c.charCodeAt(0), 2654435761) + 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function diaNoFuso(agora: Date, fuso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(agora);
}

function somarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface LoteFicticio {
  webhooks: NovoWebhookEvent[];
  eventos: NovoEvento[];
  toques: (typeof attributionTouches.$inferInsert)[];
  gastos: (typeof custos.$inferInsert)[];
}

/** Monta o dia `dia` (fuso da empresa). Em `hoje`, só até o instante `agora`. */
export function montarDia(
  tenantId: string,
  sourceId: string,
  dia: string,
  fuso: string,
  agora: Date,
): LoteFicticio {
  const lote: LoteFicticio = { webhooks: [], eventos: [], toques: [], gastos: [] };
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  const ritmo = semana === 0 || semana === 6 ? 0.8 : semana === 5 ? 1.15 : 1;
  const inicio = localParaUtc(a, m, d, 0, 0, 0, fuso).getTime();
  // Fração do dia já decorrida (hoje fica parcial; dias passados, inteiros).
  const fim = Math.min(inicio + 86_400_000, agora.getTime());
  const fracao = Math.max(0, (fim - inicio) / 86_400_000);
  if (fracao === 0) return lote;

  /** Instante do dia, concentrado entre 8h e 23h e nunca depois de `agora`. */
  const instante = (r: () => number) => {
    const t = inicio + (8 + r() * 15) * 3_600_000;
    return new Date(Math.min(t, fim - 60_000 - Math.floor(r() * 600_000)));
  };

  let pessoa = 0;
  for (const p of PERFIS) {
    const r = gerador(`${tenantId}:${dia}:${p.canal}`);
    const fator = ritmo * (0.75 + r() * 0.5) * fracao;
    const qtd = (media: number) => Math.round(media * fator);
    const pesos = p.campanhas.map((_, i) => (i === 0 ? 0.5 : 0.5 / (p.campanhas.length - 1 || 1)));
    const campanhaDe = () => {
      if (p.campanhas.length === 1) return p.campanhas[0]!;
      const x = r();
      let soma = 0;
      for (let i = 0; i < pesos.length; i++) {
        soma += pesos[i]!;
        if (x < soma) return p.campanhas[i]!;
      }
      return p.campanhas[p.campanhas.length - 1]!;
    };

    // Lote anônimo do dia (base contatada, cliques e visitas sem cadastro): um bruto por canal.
    const chaveLote = `${PREFIXO_FICTICIO}lote-${dia}-${semAcento(p.canal)}`;
    const idLote = uuidDe(`${tenantId}:wh:${chaveLote}`);
    lote.webhooks.push({
      id: idLote,
      tenantId,
      sourceId,
      eventKey: chaveLote,
      payload: { event: 'batch.traffic', channel: p.canal, day: dia, ficticio: true },
      headers: { 'content-type': 'application/json' },
      status: 'processado',
      tentativas: 1,
      receivedAt: new Date(fim - 120_000),
      processedAt: new Date(fim - 115_000),
    });
    const anonimo = (tipo: 'clique' | 'visita', base: boolean, i: number) => {
      const campanha = campanhaDe();
      lote.eventos.push({
        id: uuidDe(`${chaveLote}:${tipo}:${base}:${i}`),
        tenantId,
        webhookEventId: idLote,
        sourceId,
        type: tipo,
        occurredAt: instante(r),
        channel: p.canal,
        campaign: campanha || null,
        page: tipo === 'visita' ? (campanha ? `/lp/${campanha}` : '/') : null,
        utmSource: p.utm.source ?? null,
        utmMedium: p.utm.medium ?? null,
        utmCampaign: campanha || null,
        referrer: p.utm.referrer ?? null,
        base,
      });
    };
    for (let i = 0; i < qtd(p.base); i++) anonimo('clique', true, i);
    for (let i = 0; i < qtd(p.cliques); i++) anonimo('clique', false, i);
    const cadastros = qtd(p.cadastros);
    for (let i = 0; i < Math.max(0, qtd(p.visitas) - cadastros); i++) anonimo('visita', false, i);

    // Pessoas: visita → cadastro → (às vezes) FTD → (às vezes) depósitos.
    const taxaFtd = p.ftds / p.cadastros;
    for (let i = 0; i < cadastros; i++) {
      pessoa++;
      const n = `${dia.replace(/-/g, '')}${String(pessoa).padStart(4, '0')}`;
      const leadKey = `${PREFIXO_FICTICIO}${n}`;
      const nome = `${NOMES[Math.floor(r() * NOMES.length)]} ${SOBRENOMES[Math.floor(r() * SOBRENOMES.length)]}`;
      const campanha = campanhaDe();
      const source = p.utm.source ?? (campanha ? campanha.replace('parceiro-', '') : undefined);
      const pagina = campanha ? `/lp/${campanha}` : '/';
      const visita = instante(r);
      const cadastro = new Date(Math.min(visita.getTime() + (3 + r() * 20) * 60_000, fim - 30_000));
      const comuns = {
        tenantId,
        channel: p.canal,
        campaign: campanha || null,
        leadKey,
        utmSource: source ?? null,
        utmMedium: p.utm.medium ?? null,
        utmCampaign: campanha || null,
        referrer: p.utm.referrer ?? null,
        currency: 'BRL',
      };
      const utmPayload = {
        utm_source: source ?? null,
        utm_medium: p.utm.medium ?? null,
        utm_campaign: campanha || null,
      };
      const fbclid = p.meta
        ? `IwAR${uuidDe(`${leadKey}:fb`).replace(/-/g, '').slice(0, 20)}`
        : null;
      const busca = source
        ? `?utm_source=${source}&utm_medium=${p.utm.medium}&utm_campaign=${campanha}${fbclid ? `&fbclid=${fbclid}` : ''}`
        : '';
      lote.toques.push({
        id: uuidDe(`${tenantId}:toque:${leadKey}`),
        tenantId,
        tipo: 'page_view',
        leadKey,
        visitorId: `v-${uuidDe(`${leadKey}:vis`).slice(0, 13)}`,
        fbclid,
        fbp: fbclid ? `fb.1.${visita.getTime()}.${n}` : null,
        utmSource: source ?? null,
        utmMedium: p.utm.medium ?? null,
        utmCampaign: campanha || null,
        utmContent: campanha ? `criativo-${'abc'[Math.floor(r() * 3)]}` : null,
        url: `https://pasio.exemplo.com${pagina}${busca}`,
        referrer: p.utm.referrer ?? null,
        recebidoEm: visita,
      });
      lote.eventos.push({
        id: uuidDe(`${tenantId}:ev:${leadKey}:visita`),
        ...comuns,
        type: 'visita',
        occurredAt: visita,
        page: pagina,
      });

      const bruto = (chave: string, quando: Date, payload: Record<string, unknown>) => {
        const id = uuidDe(`${tenantId}:wh:${PREFIXO_FICTICIO}${chave}`);
        lote.webhooks.push({
          id,
          tenantId,
          sourceId,
          eventKey: `${PREFIXO_FICTICIO}${chave}`,
          payload: { ...payload, ficticio: true },
          headers: { 'content-type': 'application/json' },
          status: 'processado',
          tentativas: 1,
          receivedAt: quando,
          processedAt: new Date(quando.getTime() + 4_000),
        });
        return id;
      };
      const whCad = bruto(`cad-${n}`, cadastro, {
        event: 'user.registered',
        user_id: leadKey,
        created_at: cadastro.toISOString(),
        name: nome,
        email: `${semAcento(nome).replace(/\s+/g, '.')}.${n.slice(-6)}@exemplo.com`,
        phone: `+55 11 90000-${n.slice(-4)}`,
        birth_year: 1975 + Math.floor(r() * 30),
        state: UFS[Math.floor(r() * UFS.length)],
        ...utmPayload,
      });
      lote.eventos.push({
        id: uuidDe(`${tenantId}:ev:${leadKey}:cadastro`),
        ...comuns,
        webhookEventId: whCad,
        sourceId,
        type: 'cadastro',
        occurredAt: cadastro,
        page: pagina,
      });

      if (r() >= taxaFtd) continue;
      const ftdEm = new Date(cadastro.getTime() + (5 + r() * 240) * 60_000);
      if (ftdEm.getTime() >= fim) continue;
      const valorFtd = Math.max(20, Math.round((p.ticket * (0.4 + r() * 1.4)) / 5) * 5);
      const whFtd = bruto(`ftd-${n}`, ftdEm, {
        event: 'deposit.first',
        user_id: leadKey,
        deposit_id: `dep-${n}-1`,
        amount: valorFtd,
        currency: 'BRL',
        method: 'pix',
        created_at: ftdEm.toISOString(),
        ...utmPayload,
      });
      lote.eventos.push({
        id: uuidDe(`${tenantId}:ev:${leadKey}:ftd`),
        ...comuns,
        webhookEventId: whFtd,
        sourceId,
        type: 'ftd',
        occurredAt: ftdEm,
        value: valorFtd.toFixed(2),
        page: null,
      });
      // Depósitos seguintes no mesmo dia (o resto da jornada fica para os dias seguintes).
      const deps = Math.floor(r() * 3);
      for (let k = 0; k < deps; k++) {
        const em = new Date(ftdEm.getTime() + (k + 1) * (30 + r() * 180) * 60_000);
        if (em.getTime() >= fim) break;
        const valor = [20, 30, 50, 80, 100, 150, 250][Math.floor(r() * 7)]!;
        const wh = bruto(`dep-${n}-${k + 2}`, em, {
          event: 'deposit.created',
          user_id: leadKey,
          deposit_id: `dep-${n}-${k + 2}`,
          amount: valor,
          currency: 'BRL',
          method: k % 2 ? 'cartao_credito' : 'pix',
          created_at: em.toISOString(),
        });
        lote.eventos.push({
          id: uuidDe(`${tenantId}:ev:${leadKey}:dep${k}`),
          ...comuns,
          webhookEventId: wh,
          sourceId,
          type: 'deposito',
          occurredAt: em,
          value: valor.toFixed(2),
          page: null,
        });
      }
    }

    // Gasto do dia por campanha (proporcional ao peso da campanha).
    if (p.gasto !== null) {
      const total = p.gasto * fator;
      p.campanhas.forEach((campanha, i) => {
        const peso = p.campanhas.length === 1 ? 1 : pesos[i]!;
        lote.gastos.push({
          id: uuidDe(`${tenantId}:gasto:${dia}:${p.canal}:${campanha}`),
          tenantId,
          dia,
          canal: p.canal,
          campanha,
          valor: (Math.round(total * peso * 100) / 100).toFixed(2),
          origem: 'manual',
          descricao: DESCRICAO_GASTO,
        });
      });
    }
  }
  return lote;
}

async function emPartes<T>(itens: T[], tamanho: number, gravar: (parte: T[]) => Promise<unknown>) {
  for (let i = 0; i < itens.length; i += tamanho) await gravar(itens.slice(i, i + tamanho));
}

/** Dias (AAAA-MM-DD) que já têm dado fictício gravado. */
async function diasGravados(db: Db, tenantId: string): Promise<string[]> {
  return comTenant(db, tenantId, async (tx) => {
    const linhas = await tx.execute<{ dia: string }>(sql`
      select distinct dia::text as dia from custos
      where tenant_id = ${tenantId} and descricao = ${DESCRICAO_GASTO}
      union
      select distinct substring(event_key from 10 for 10) from webhook_events
      where tenant_id = ${tenantId} and event_key like ${`${PREFIXO_FICTICIO}lote-%`}
    `);
    return [...linhas].map((l) => l.dia).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  });
}

/** Apaga tudo o que o gerador gravou e recalcula os dias afetados. */
export async function removerFicticio(db: Db, tenantId: string): Promise<string[]> {
  const afetados = await diasGravados(db, tenantId);
  const prefixo = `${PREFIXO_FICTICIO}%`;
  await comTenant(db, tenantId, async (tx) => {
    await tx.execute(
      sql`delete from webhook_events where tenant_id = ${tenantId} and event_key like ${prefixo}`,
    );
    await tx.execute(
      sql`delete from events where tenant_id = ${tenantId} and lead_key like ${prefixo}`,
    );
    await tx.execute(
      sql`delete from attribution_touches where tenant_id = ${tenantId} and lead_key like ${prefixo}`,
    );
    await tx.execute(
      sql`delete from custos where tenant_id = ${tenantId} and descricao = ${DESCRICAO_GASTO}`,
    );
  });
  if (afetados.length) await reagregarDias(db, tenantId, afetados);
  return afetados;
}

export async function gerarFicticio(db: Db, janela: number, agora = new Date()) {
  const [t] = await db
    .select({ id: tenants.id, fuso: tenants.fuso })
    .from(tenants)
    .where(sql`${tenants.slug} = ${SLUG_DEMO}`);
  if (!t) throw new Error('Empresa demo não encontrada; rode antes `db:seed`.');
  const fuso = t.fuso ?? 'America/Sao_Paulo';
  const [fonte] = await comTenant(db, t.id, (tx) =>
    tx
      .select({ id: sources.id })
      .from(sources)
      .where(sql`${sources.tenantId} = ${t.id} and ${sources.slug} = 'demo'`),
  );
  if (!fonte) throw new Error('Fonte demo não encontrada; rode antes `db:seed`.');

  // Regrava do zero (idempotente): remove o lote anterior antes de gerar o novo.
  await removerFicticio(db, t.id);
  const hoje = diaNoFuso(agora, fuso);
  const lista = Array.from({ length: janela }, (_, i) => somarDias(hoje, i - janela + 1));
  const totais = { eventos: 0, pessoas: 0, gastos: 0 };
  for (const dia of lista) {
    const lote = montarDia(t.id, fonte.id, dia, fuso, agora);
    await comTenant(db, t.id, async (tx) => {
      await emPartes(lote.webhooks, 1000, (p) => tx.insert(webhookEvents).values(p));
      await emPartes(lote.eventos, 1000, (p) => tx.insert(events).values(p));
      await emPartes(lote.toques, 1000, (p) => tx.insert(attributionTouches).values(p));
      await emPartes(lote.gastos, 1000, (p) => tx.insert(custos).values(p));
    });
    totais.eventos += lote.eventos.length;
    totais.pessoas += lote.toques.length;
    totais.gastos += lote.gastos.length;
  }
  await reagregarDias(db, t.id, lista);
  return { de: lista[0]!, ate: hoje, ...totais };
}

async function principal() {
  if (process.env.NODE_ENV === 'production') {
    console.error('db:ficticio é só para ambiente local; recusado com NODE_ENV=production.');
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const url = process.env.DATABASE_URL ?? 'postgres://app_user:app_user@127.0.0.1:5460/trafego';
  const db = criarDb(url, { max: 1 });
  try {
    if (args.includes('--remover')) {
      const [t] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(sql`${tenants.slug} = ${SLUG_DEMO}`);
      if (!t) throw new Error('Empresa demo não encontrada.');
      const dias = await removerFicticio(db, t.id);
      console.log(`Dados fictícios removidos (${dias.length} dias recalculados).`);
    } else {
      const i = args.indexOf('--dias');
      const janela = Math.min(Math.max(Number(args[i + 1]) || 30, 1), 120);
      const r = await gerarFicticio(db, i >= 0 ? janela : 30);
      console.log(
        `Dados fictícios de ${r.de} a ${r.ate}: ${r.eventos} eventos, ${r.pessoas} pessoas, ` +
          `${r.gastos} gastos. Para apagar: db:ficticio --remover.`,
      );
    }
  } catch (erro) {
    console.error('Falha nos dados fictícios:', erro);
    process.exitCode = 1;
  } finally {
    await db.$client.end({ timeout: 5 });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await principal();
}
