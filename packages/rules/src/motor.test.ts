import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  agregarEventos,
  aplicarRegras,
  CANAIS_PADRAO,
  classificarCanal,
  derivar,
  diaNoFuso,
  ErroDeRegra,
  taxasDoFunil,
  validarConjunto,
  type ConjuntoDeRegras,
  type EventoCanonico,
  type LinhaDiaria,
} from './index.js';

const FUSO = 'America/Sao_Paulo';

/** Conjunto de exemplo (o mesmo formato documentado no relatório). */
const CONJUNTO: ConjuntoDeRegras = {
  version: 3,
  moeda_padrao: 'BRL',
  fuso: FUSO,
  regras: [
    {
      match: { path: '$.event', equals: 'first_deposit' },
      type: 'ftd',
      fields: {
        occurred_at: { path: '$.created_at', format: 'iso' },
        value: { path: '$.amount', divide: 100 },
        lead_key: { path: '$.user.id' },
        utm_source: { path: '$.utm.source', lower: true, trim: true },
        utm_medium: { path: '$.utm.medium', lower: true },
        page: { path: '$.landing_page', regex: '^https?://[^/]+(/[^?]*)' },
        campaign: { path: '$.utm.campaign', default: 'sem-campanha' },
      },
    },
    {
      match: { path: '$.event', in: ['signup', 'first_deposit'] },
      type: 'cadastro',
      fields: {
        occurred_at: { path: '$.created_at' },
        lead_key: { path: '$.user.id' },
        affiliate_id: { path: '$.aff' },
        referrer: { path: '$.ref' },
      },
    },
    {
      match: [
        { path: '$.spend', exists: true },
        { path: '$.platform', regex: '^(fb|meta)$' },
      ],
      type: 'gasto',
      fields: {
        occurred_at: { path: '$.ts', format: 'epoch_s' },
        value: { path: '$.spend', multiply: 1 },
        currency: { path: '$.cur' },
        channel: { const: 'Meta' },
      },
    },
    {
      match: { path: '$.kind', equals: 'click' },
      type: 'clique',
      fields: {
        occurred_at: { path: '$.when', format: 'epoch_ms' },
        utm_medium: { path: '$.m' },
        base: { path: '$.base' },
      },
    },
    {
      match: { path: '$.tipo', equals: 'visita' },
      type: 'visita',
      fields: { occurred_at: { path: '$.data', format: 'dd/mm/yyyy' } },
    },
  ],
};

describe('aplicarRegras: operadores', () => {
  it('path, divide, lower, trim, regex, default e vários eventos por payload', () => {
    const { eventos, avisos } = aplicarRegras(
      {
        event: 'first_deposit',
        created_at: '2024-05-10T12:00:00Z',
        amount: 15075,
        user: { id: 'u1' },
        utm: { source: '  Facebook ', medium: 'CPC' },
        landing_page: 'https://pasio.com/promo/x?y=1',
      },
      CONJUNTO,
    );
    expect(eventos.map((e) => e.type)).toEqual(['ftd', 'cadastro']);
    const ftd = eventos[0]!;
    expect(ftd.value).toBe(150.75);
    expect(ftd.currency).toBe('BRL');
    expect(ftd.utm_source).toBe('facebook');
    expect(ftd.utm_medium).toBe('cpc');
    expect(ftd.page).toBe('/promo/x');
    expect(ftd.campaign).toBe('sem-campanha');
    expect(ftd.channel).toBe('Meta');
    expect(ftd.occurred_at.toISOString()).toBe('2024-05-10T12:00:00.000Z');
    expect(avisos).toEqual([]);
  });

  it('const, multiply, currency do payload, exists + regex no match, epoch_s', () => {
    const { eventos } = aplicarRegras(
      { spend: '1.234,50', platform: 'fb', ts: 1715342400, cur: 'usd' },
      CONJUNTO,
    );
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      type: 'gasto',
      value: 1234.5,
      currency: 'USD',
      channel: 'Meta',
    });
    expect(eventos[0]!.occurred_at.toISOString()).toBe('2024-05-10T12:00:00.000Z');
    // regex do match não casa → nenhum bloco → erro
    expect(() => aplicarRegras({ spend: 10, platform: 'google', ts: 1 }, CONJUNTO)).toThrow(
      ErroDeRegra,
    );
  });

  it('epoch_ms e base=true', () => {
    const { eventos } = aplicarRegras(
      { kind: 'click', when: 1715342400000, m: 'email', base: 'true' },
      CONJUNTO,
    );
    expect(eventos[0]).toMatchObject({ type: 'clique', base: true, channel: 'Email' });
    expect(eventos[0]!.occurred_at.getTime()).toBe(1715342400000);
  });

  it('dd/mm/yyyy no fuso da empresa (com e sem hora)', () => {
    const a = aplicarRegras({ tipo: 'visita', data: '10/05/2024' }, CONJUNTO).eventos[0]!;
    expect(a.occurred_at.toISOString()).toBe('2024-05-10T03:00:00.000Z');
    const b = aplicarRegras({ tipo: 'visita', data: '10/05/2024 23:30' }, CONJUNTO).eventos[0]!;
    expect(b.occurred_at.toISOString()).toBe('2024-05-11T02:30:00.000Z');
    expect(diaNoFuso(b.occurred_at, FUSO)).toBe('2024-05-10');
  });

  it('iso sem fuso é lido no fuso da empresa; iso com offset é respeitado', () => {
    const c: ConjuntoDeRegras = {
      ...CONJUNTO,
      regras: [
        {
          match: { path: '$.e', exists: true },
          type: 'visita',
          fields: { occurred_at: { path: '$.e', format: 'iso' } },
        },
      ],
    };
    expect(
      aplicarRegras({ e: '2024-05-10T08:00:00' }, c).eventos[0]!.occurred_at.toISOString(),
    ).toBe('2024-05-10T11:00:00.000Z');
    expect(
      aplicarRegras({ e: '2024-05-10T08:00:00+02:00' }, c).eventos[0]!.occurred_at.toISOString(),
    ).toBe('2024-05-10T06:00:00.000Z');
  });

  it('lead_key ausente em cadastro gera aviso, não erro; extras alimentam o classificador', () => {
    const { eventos, avisos } = aplicarRegras(
      { event: 'signup', created_at: '2024-05-10T12:00:00Z', aff: 'A77' },
      CONJUNTO,
    );
    expect(eventos[0]!.channel).toBe('Afiliados');
    expect(eventos[0]!.extras).toEqual({ affiliate_id: 'A77' });
    expect(avisos.join(' ')).toMatch(/lead_key ausente/);
  });

  it('erros legíveis em pt-BR', () => {
    expect(() => aplicarRegras({ outra: 1 }, CONJUNTO)).toThrow(/Nenhum bloco de regra/);
    expect(() => aplicarRegras({ tipo: 'visita', data: '2024-05-10' }, CONJUNTO)).toThrow(
      /não está no formato dd\/mm\/yyyy/,
    );
    expect(() => aplicarRegras({ event: 'signup' }, CONJUNTO)).toThrow(/data do evento ausente/);
    expect(() =>
      aplicarRegras(
        { event: 'first_deposit', created_at: '2024-05-10T12:00:00Z', amount: 'abc' },
        CONJUNTO,
      ),
    ).toThrow(/"abc" não é um número/);
    expect(() => aplicarRegras('texto', CONJUNTO)).toThrow(/objeto JSON/);
  });
});

describe('classificarCanal', () => {
  const base = (p: Partial<EventoCanonico>): EventoCanonico => ({
    type: 'clique',
    occurred_at: new Date(),
    currency: 'BRL',
    channel: '',
    ...p,
  });
  it('os 5 canais da wiki, na ordem', () => {
    expect(classificarCanal(base({ extras: { affiliate_id: '9' }, utm_source: 'facebook' }))).toBe(
      'Afiliados',
    );
    expect(classificarCanal(base({ utm_medium: 'affiliate' }))).toBe('Afiliados');
    expect(classificarCanal(base({ utm_source: 'Instagram' }))).toBe('Meta');
    expect(classificarCanal(base({ referrer: 'https://m.facebook.com/x' }))).toBe('Meta');
    expect(classificarCanal(base({ utm_medium: 'email' }))).toBe('Email');
    expect(classificarCanal(base({ utm_medium: 'SMS' }))).toBe('SMS');
    expect(classificarCanal(base({ utm_source: 'google' }))).toBe('Outros');
    expect(CANAIS_PADRAO.map((c) => c.canal)).toEqual(['Afiliados', 'Meta', 'Email', 'SMS']);
  });
  it('regras da empresa substituem as padrão', () => {
    expect(
      classificarCanal(base({ utm_source: 'tiktok' }), [
        { canal: 'TikTok', se: { utm_source_in: ['tiktok'] } },
      ]),
    ).toBe('TikTok');
  });
});

describe('validarConjunto', () => {
  it('aceita o conjunto de exemplo e aplica padrões', () => {
    const semPadroes = JSON.parse(JSON.stringify(CONJUNTO)) as Record<string, unknown>;
    delete semPadroes.moeda_padrao;
    delete semPadroes.fuso;
    const r = validarConjunto(semPadroes, { fuso: 'America/Manaus' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.conjunto).toMatchObject({ moeda_padrao: 'BRL', fuso: 'America/Manaus' });
  });
  it('lista erros legíveis', () => {
    const r = validarConjunto({
      version: 0,
      fuso: 'Lua/Base',
      regras: [
        {
          type: 'pix',
          match: { path: 'event' },
          fields: { value: { path: '$.a', format: 'x', divide: 0, foo: 1 } },
        },
      ],
      canais: [{ canal: '__funil__', se: { utm_x: ['a'] } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const t = r.erros.join('\n');
      for (const trecho of [
        '"version"',
        '"type" deve ser um de',
        'JSONPath começando com "$"',
        'use "equals", "in", "exists" ou "regex"',
        'falta "fields.occurred_at"',
        'formato "x" inválido',
        '"divide" deve ser um número diferente de 0',
        'operador desconhecido "foo"',
        'reservados',
        'condição desconhecida "utm_x"',
        '"fuso" inválido',
      ]) {
        expect(t).toContain(trecho);
      }
    }
  });
});

const ev = (p: Partial<EventoCanonico> & Pick<EventoCanonico, 'type'>): EventoCanonico => ({
  occurred_at: new Date('2024-05-10T15:00:00Z'),
  currency: 'BRL',
  channel: 'Meta',
  ...p,
});

describe('agregação', () => {
  it('evento às 23h30 de São Paulo cai no dia local, não no UTC', () => {
    const linhas = agregarEventos(
      [ev({ type: 'clique', occurred_at: new Date('2024-05-11T02:30:00Z') })],
      { fuso: FUSO },
    );
    expect(linhas[0]!.dia).toBe('2024-05-10');
    expect(
      agregarEventos([ev({ type: 'clique', occurred_at: new Date('2024-05-11T02:30:00Z') })], {
        fuso: 'UTC',
      })[0]!.dia,
    ).toBe('2024-05-11');
  });

  it('depósitos incluem FTDs por padrão; base vai para base_contatada; sem gasto → investimento nulo', () => {
    const eventos = [
      ev({ type: 'ftd', value: 100.1 }),
      ev({ type: 'deposito', value: 50.2 }),
      ev({ type: 'clique', base: true }),
      ev({ type: 'clique' }),
    ];
    const [l] = agregarEventos(eventos, { fuso: FUSO });
    expect(l).toMatchObject({
      ftds: 1,
      ftds_valor: 100.1,
      depositos: 150.3,
      cliques: 1,
      base_contatada: 1,
      investimento: null,
    });
    expect(agregarEventos(eventos, { fuso: FUSO, depositosIncluemFtd: false })[0]!.depositos).toBe(
      50.2,
    );
    expect(derivar(l!)).toEqual({ cpa: null, roas: null });
  });

  it('chave inclui canal, campanha e página', () => {
    const linhas = agregarEventos(
      [
        ev({ type: 'visita' }),
        ev({ type: 'visita', campaign: 'c1' }),
        ev({ type: 'visita', page: '/p' }),
        ev({ type: 'visita', channel: 'Email' }),
      ],
      { fuso: FUSO },
    );
    expect(linhas).toHaveLength(4);
  });

  it('derivados e taxas do funil', () => {
    expect(derivar({ investimento: 0, ftds: 3, depositos: 10 })).toEqual({ cpa: null, roas: null });
    expect(derivar({ investimento: 100, ftds: 0, depositos: 50 })).toEqual({
      cpa: null,
      roas: 0.5,
    });
    expect(taxasDoFunil([1000, 100, 0, 5])).toEqual([1, 0.1, 0, null]);
  });
});

interface LinhaFixture {
  canal: string;
  investimento: number;
  cliques: number;
  visitas: number;
  cadastros: number;
  ftdsQtd: number;
  ftdsValor: number;
  depositos: number;
  cpa: number;
  roas: number;
}

describe('reproduz a linha Meta das fixtures', () => {
  const ref = JSON.parse(
    readFileSync(new URL('../../fixtures/referencia.json', import.meta.url), 'utf8'),
  ) as { tabela: { linhas: LinhaFixture[] } };
  const meta = ref.tabela.linhas.find((l) => l.canal === 'Meta')!;

  it('soma de 24 dias de eventos sintéticos bate com a imagem', () => {
    const eventos: EventoCanonico[] = [];
    const dias = 24;
    const instante = (i: number) => new Date(Date.UTC(2024, 4, 1 + (i % dias), 3 + (i % 20), 0, 0));
    const repetir = (n: number, f: (i: number) => EventoCanonico) => {
      for (let i = 0; i < n; i++) eventos.push(f(i));
    };
    // Valores em reais com centavos repartidos sem perda.
    const repartir = (total: number, n: number) => {
      const c = Math.round(total * 100);
      const parte = Math.floor(c / n);
      return Array.from({ length: n }, (_, i) => (i === n - 1 ? c - parte * (n - 1) : parte) / 100);
    };
    const gastos = repartir(meta.investimento, dias);
    repetir(dias, (i) => ev({ type: 'gasto', value: gastos[i]!, occurred_at: instante(i) }));
    repetir(meta.cliques, (i) => ev({ type: 'clique', occurred_at: instante(i) }));
    repetir(meta.visitas, (i) => ev({ type: 'visita', occurred_at: instante(i) }));
    repetir(meta.cadastros, (i) => ev({ type: 'cadastro', occurred_at: instante(i) }));
    const ftds = repartir(meta.ftdsValor, meta.ftdsQtd);
    repetir(meta.ftdsQtd, (i) => ev({ type: 'ftd', value: ftds[i]!, occurred_at: instante(i) }));
    const outros = repartir(meta.depositos - meta.ftdsValor, 300);
    repetir(300, (i) => ev({ type: 'deposito', value: outros[i]!, occurred_at: instante(i) }));

    const linhas = agregarEventos(eventos, { fuso: FUSO }).filter((l) => l.canal === 'Meta');
    expect(new Set(linhas.map((l) => l.dia)).size).toBe(dias);
    const soma = linhas.reduce<
      Omit<LinhaDiaria, 'dia' | 'canal' | 'campaign' | 'page'> & { investimento: number }
    >(
      (s, l) => ({
        investimento: s.investimento + (l.investimento ?? 0),
        cliques: s.cliques + l.cliques,
        visitas: s.visitas + l.visitas,
        cadastros: s.cadastros + l.cadastros,
        ftds: s.ftds + l.ftds,
        ftds_valor: s.ftds_valor + l.ftds_valor,
        depositos: s.depositos + l.depositos,
        base_contatada: s.base_contatada + l.base_contatada,
      }),
      {
        investimento: 0,
        cliques: 0,
        visitas: 0,
        cadastros: 0,
        ftds: 0,
        ftds_valor: 0,
        depositos: 0,
        base_contatada: 0,
      },
    );
    expect(soma.investimento).toBeCloseTo(meta.investimento, 2);
    expect(soma.cliques).toBe(meta.cliques);
    expect(soma.visitas).toBe(meta.visitas);
    expect(soma.cadastros).toBe(meta.cadastros);
    expect(soma.ftds).toBe(meta.ftdsQtd);
    expect(soma.ftds_valor).toBeCloseTo(meta.ftdsValor, 2);
    expect(soma.depositos).toBeCloseTo(meta.depositos, 2);
    const d = derivar(soma);
    expect(Math.round(d.cpa! * 100) / 100).toBe(meta.cpa);
    expect(Math.round(d.roas! * 100) / 100).toBe(meta.roas);
  });
});
