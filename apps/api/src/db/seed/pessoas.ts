/**
 * Amostra de pessoas da empresa demo: dá conteúdo à lista por etapa e à ficha do lead (clique no
 * funil). São poucas dezenas de pessoas fictícias, com e-mail em `exemplo.com` e telefone zerado.
 *
 * Não mexe nos números do painel: `metrics_daily` da demo vem das fixtures da imagem e o seed não
 * chama a agregação. Funções puras e determinísticas (ids derivados de hash, sem aleatoriedade).
 *
 * O último webhook é processado às 11:30 UTC de 24/05/2024, o "Dados atualizados em 24/05/2024
 * 08:30" da imagem de referência.
 */
import { createHash } from 'node:crypto';
import type { NovoEvento, NovoWebhookEvent } from '../schema.js';
import { PERIODO_ATUAL, dias } from './dados.js';

/** Prefixo das chaves da amostra: o seed apaga por ele antes de regravar. */
export const PREFIXO_DEMO = 'demo-';

type NovoToque = {
  id: string;
  tenantId: string;
  tipo: string;
  leadKey: string;
  visitorId: string;
  fbclid?: string;
  fbp?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  url: string;
  referrer?: string;
  recebidoEm: Date;
};

export interface AmostraPessoas {
  webhooks: NovoWebhookEvent[];
  eventos: NovoEvento[];
  toques: NovoToque[];
}

const NOMES = [
  'Ana Souza',
  'Bruno Lima',
  'Carla Mendes',
  'Diego Rocha',
  'Elisa Prado',
  'Fábio Nunes',
  'Gabriela Reis',
  'Heitor Alves',
  'Isabela Costa',
  'João Pedro Dias',
  'Karina Lopes',
  'Lucas Martins',
  'Marina Teles',
  'Nicolas Freitas',
  'Olívia Ramos',
  'Paulo Henrique Sá',
  'Quésia Barros',
  'Rafael Pinto',
  'Sabrina Moura',
  'Tiago Cardoso',
  'Úrsula Viana',
  'Vinícius Gomes',
  'Wesley Farias',
  'Yasmin Torres',
];

interface PerfilCanal {
  canal: string;
  campanhas: string[];
  utm: (campanha: string) => { source?: string; medium?: string; referrer?: string };
  meta?: boolean;
}

const PERFIS: PerfilCanal[] = [
  {
    canal: 'Meta',
    campanhas: ['cassino-maio', 'esportes-lal-1', 'roleta-remarketing'],
    utm: () => ({ source: 'facebook', medium: 'paid_social' }),
    meta: true,
  },
  {
    canal: 'Email',
    campanhas: ['boas-vindas', 'bonus-semana'],
    utm: () => ({ source: 'newsletter', medium: 'email' }),
  },
  {
    canal: 'SMS',
    campanhas: ['reativacao-30d'],
    utm: () => ({ source: 'sms', medium: 'sms' }),
  },
  {
    canal: 'Afiliados',
    campanhas: ['parceiro-apostaboa', 'parceiro-tipster'],
    utm: (c) => ({ source: c.replace('parceiro-', ''), medium: 'affiliate' }),
  },
  {
    canal: 'Outros',
    campanhas: [''],
    utm: () => ({ referrer: 'https://www.google.com/' }),
  },
];

/** Peso de cada canal na amostra (Meta concentra, como na tabela da imagem). */
const ORDEM_CANAIS = [0, 0, 1, 0, 3, 2, 0, 1, 3, 4, 0, 3];

/** UUID determinístico a partir de um texto (formato v4, para caber em colunas `uuid`). */
export function uuidDe(texto: string): string {
  const h = createHash('sha1').update(texto).digest('hex');
  const v = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${v}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Inteiro pseudoaleatório estável em [0, n) para a semente. */
function sorteio(semente: string, n: number): number {
  return parseInt(createHash('sha1').update(semente).digest('hex').slice(0, 8), 16) % n;
}

const emailDe = (nome: string, n: number) =>
  `${nome
    .normalize('NFD')
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')}${n}@exemplo.com`;

const ULTIMO_PROCESSAMENTO = new Date('2024-05-24T11:30:00Z');
const ATRASO_PROCESSAMENTO_MS = 5_000;

/** Monta a amostra para a empresa e a fonte `demo`. */
export function pessoasDemo(tenantId: string, sourceId: string, quantidade = 36): AmostraPessoas {
  const listaDias = dias(PERIODO_ATUAL.inicio, PERIODO_ATUAL.fim);
  const webhooks: NovoWebhookEvent[] = [];
  const eventos: NovoEvento[] = [];
  const toques: NovoToque[] = [];

  const bruto = (chave: string, quando: Date, payload: Record<string, unknown>) => {
    const id = uuidDe(`${tenantId}:wh:${chave}`);
    webhooks.push({
      id,
      tenantId,
      sourceId,
      eventKey: `${PREFIXO_DEMO}${chave}`,
      payload,
      headers: { 'content-type': 'application/json' },
      status: 'processado',
      tentativas: 1,
      receivedAt: quando,
      processedAt: new Date(quando.getTime() + ATRASO_PROCESSAMENTO_MS),
    });
    return id;
  };

  for (let i = 0; i < quantidade; i++) {
    const n = 1001 + i;
    const leadKey = `${PREFIXO_DEMO}${n}`;
    const nome = NOMES[i % NOMES.length]!;
    const perfil = PERFIS[ORDEM_CANAIS[i % ORDEM_CANAIS.length]!]!;
    const campanha = perfil.campanhas[sorteio(`${leadKey}:camp`, perfil.campanhas.length)]!;
    const utm = perfil.utm(campanha);
    // Espalha pelo período; a última pessoa cai no último dia, antes do processamento final.
    const dia = listaDias[Math.floor((i * listaDias.length) / quantidade)]!;
    const ultima = i === quantidade - 1;
    const hora = ultima ? 10 : 11 + sorteio(`${leadKey}:h`, 11);
    const minuto = sorteio(`${leadKey}:m`, 50);
    const visita = new Date(
      `${dia}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00Z`,
    );
    const cadastro = new Date(visita.getTime() + (4 + sorteio(`${leadKey}:c`, 20)) * 60_000);
    const temFtd = ultima || sorteio(`${leadKey}:ftd`, 10) < 6;
    const ftdEm = new Date(
      cadastro.getTime() + (ultima ? 9 : 15 + sorteio(`${leadKey}:f`, 600)) * 60_000,
    );
    const valorFtd = [30, 50, 50, 100, 100, 150, 200, 300][sorteio(`${leadKey}:v`, 8)]!;
    const deps = temFtd && !ultima ? sorteio(`${leadKey}:d`, 4) : 0;

    const comuns = {
      tenantId,
      channel: perfil.canal,
      campaign: campanha || null,
      leadKey,
      utmSource: utm.source ?? null,
      utmMedium: utm.medium ?? null,
      utmCampaign: campanha || null,
      referrer: utm.referrer ?? null,
      currency: 'BRL',
    };
    const utmPayload = {
      utm_source: utm.source ?? null,
      utm_medium: utm.medium ?? null,
      utm_campaign: campanha || null,
    };
    const fbclid = perfil.meta
      ? `IwAR${uuidDe(`${leadKey}:fb`).replace(/-/g, '').slice(0, 20)}`
      : undefined;
    const pagina = campanha ? `/lp/${campanha}` : '/';
    const busca = utm.source
      ? `?utm_source=${utm.source}&utm_medium=${utm.medium}&utm_campaign=${campanha}${fbclid ? `&fbclid=${fbclid}` : ''}`
      : '';

    toques.push({
      id: uuidDe(`${tenantId}:toque:${leadKey}`),
      tenantId,
      tipo: 'page_view',
      leadKey,
      visitorId: `v-${uuidDe(`${leadKey}:vis`).slice(0, 13)}`,
      ...(fbclid ? { fbclid, fbp: `fb.1.${visita.getTime()}.${n}` } : {}),
      ...(utm.source ? { utmSource: utm.source } : {}),
      ...(utm.medium ? { utmMedium: utm.medium } : {}),
      ...(campanha ? { utmCampaign: campanha, utmContent: 'criativo-a' } : {}),
      url: `https://pasio.exemplo.com${pagina}${busca}`,
      ...(utm.referrer ? { referrer: utm.referrer } : {}),
      recebidoEm: visita,
    });
    eventos.push({
      id: uuidDe(`${tenantId}:ev:${leadKey}:visita`),
      ...comuns,
      type: 'visita',
      occurredAt: visita,
      page: pagina,
    });

    const whCadastro = bruto(`cad-${n}`, cadastro, {
      event: 'user.registered',
      user_id: leadKey,
      created_at: cadastro.toISOString(),
      name: nome,
      email: emailDe(nome, n),
      phone: `+55 11 90000-${String(n).slice(-4)}`,
      birth_year: 1980 + sorteio(`${leadKey}:ano`, 22),
      state: ['SP', 'RJ', 'MG', 'PR', 'BA', 'RS'][sorteio(`${leadKey}:uf`, 6)],
      ...utmPayload,
    });
    eventos.push({
      id: uuidDe(`${tenantId}:ev:${leadKey}:cadastro`),
      ...comuns,
      webhookEventId: whCadastro,
      sourceId,
      type: 'cadastro',
      occurredAt: cadastro,
      page: pagina,
    });

    if (!temFtd) continue;
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
    eventos.push({
      id: uuidDe(`${tenantId}:ev:${leadKey}:ftd`),
      ...comuns,
      webhookEventId: whFtd,
      sourceId,
      type: 'ftd',
      occurredAt: ftdEm,
      value: valorFtd.toFixed(2),
      page: null,
    });

    for (let d = 0; d < deps; d++) {
      const em = new Date(
        ftdEm.getTime() + (d + 1) * (20 + sorteio(`${leadKey}:dd${d}`, 40)) * 3_600_000,
      );
      if (em.getTime() + ATRASO_PROCESSAMENTO_MS >= ULTIMO_PROCESSAMENTO.getTime()) break;
      const valor = [20, 50, 80, 100, 250][sorteio(`${leadKey}:dv${d}`, 5)]!;
      const wh = bruto(`dep-${n}-${d + 2}`, em, {
        event: 'deposit.created',
        user_id: leadKey,
        deposit_id: `dep-${n}-${d + 2}`,
        amount: valor,
        currency: 'BRL',
        method: d % 2 ? 'cartao_credito' : 'pix',
        created_at: em.toISOString(),
      });
      eventos.push({
        id: uuidDe(`${tenantId}:ev:${leadKey}:dep${d}`),
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

  // O mais recente processado fecha exatamente no horário da imagem.
  const ultimo = webhooks.reduce((a, b) =>
    (a.receivedAt as Date).getTime() > (b.receivedAt as Date).getTime() ? a : b,
  );
  ultimo.processedAt = ULTIMO_PROCESSAMENTO;
  return { webhooks, eventos, toques };
}
