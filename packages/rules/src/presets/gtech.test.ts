import { describe, expect, it } from 'vitest';
import {
  aplicarRegras,
  conjuntoGtech,
  mapeamentoGtech,
  PRESETS,
  validarConjunto,
} from '../index.js';
import {
  DEPOSIT_CREATED,
  DEPOSIT_PAYMENT_PRIMEIRO,
  DEPOSIT_PAYMENT_REDEPOSITO,
  DOC_DEPOSITO_CRIADO,
  DOC_PAGAMENTO_DEPOSITO,
  USER_CREATED,
  VALORES_SENSIVEIS,
} from './gtech.fixtures.js';

const CONJUNTO = conjuntoGtech();
const aplicar = (p: unknown) => aplicarRegras(p, CONJUNTO);

describe('preset GTech', () => {
  it('é um conjunto válido, também do jeito que vai para rules.mapping', () => {
    expect(validarConjunto(CONJUNTO).ok).toBe(true);
    // Como `carregarContextoFonte` monta: mapping + versão da linha + padrões da empresa.
    const r = validarConjunto(
      { ...mapeamentoGtech(), version: 7 },
      { fuso: 'America/Sao_Paulo', moeda_padrao: 'BRL' },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.conjunto.version).toBe(7);
      expect(r.conjunto.ignorar).toHaveLength(1);
    }
    expect(PRESETS.gtech!()).toEqual(mapeamentoGtech());
  });

  it('USER_CREATED → cadastro com lead, UTMs e canal Meta', () => {
    const { eventos } = aplicar(USER_CREATED);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toEqual({
      type: 'cadastro',
      occurred_at: new Date('2026-10-20T16:29:25.123Z'),
      currency: 'BRL',
      channel: 'Meta',
      lead_key: '90001',
      utm_source: 'facebook',
      utm_medium: 'cpc',
      utm_campaign: 'campanha-teste',
      campaign: 'campanha-teste',
    });
  });

  it('DEPOSIT_PAYMENT com approved_deposits 1 → só ftd (Depósitos já somam o FTD)', () => {
    const { eventos } = aplicar(DEPOSIT_PAYMENT_PRIMEIRO);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toEqual({
      type: 'ftd',
      occurred_at: new Date('2026-10-20T16:36:10.000Z'), // paid_at, não created_at
      value: 20,
      currency: 'BRL',
      channel: 'Outros',
      lead_key: '90001',
    });
    // Contador como texto também conta como primeiro depósito.
    const texto = aplicar({ ...DEPOSIT_PAYMENT_PRIMEIRO, approved_deposits: '1' }).eventos;
    expect(texto.map((e) => e.type)).toEqual(['ftd']);
  });

  it('redepósito (approved_deposits 2) → só deposito; afiliado vira canal Afiliados', () => {
    const { eventos } = aplicar(DEPOSIT_PAYMENT_REDEPOSITO);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      type: 'deposito',
      occurred_at: new Date('2026-10-20T17:01:00.000Z'),
      value: 50.5,
      currency: 'BRL',
      channel: 'Afiliados',
      lead_key: '90001',
      extras: { affiliate_id: '777' },
    });
  });

  it('DEPOSIT_CREATED (pendente) é ignorado sem erro, nos dois formatos', () => {
    for (const p of [DEPOSIT_CREATED, DOC_DEPOSITO_CRIADO]) {
      const r = aplicar(p);
      expect(r.eventos).toEqual([]);
      expect(r.avisos.join(' ')).toMatch(/ignorado/);
    }
  });

  it('formato antigo da doc: PAGAMENTO_DEPÓSITO/PAGO sem contador → deposito', () => {
    const { eventos } = aplicar(DOC_PAGAMENTO_DEPOSITO);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      type: 'deposito',
      occurred_at: new Date('2024-03-27T13:30:31.204Z'),
      value: 0.1,
      currency: 'BRL',
      lead_key: '487',
    });
  });

  it('aceita a chave "evento", o "Ó" decomposto, sem acento e amount em texto', () => {
    const semEvent: Record<string, unknown> = { ...DOC_PAGAMENTO_DEPOSITO };
    delete semEvent.event;
    for (const nome of [
      'PAGAMENTO_DEPÓSITO',
      'PAGAMENTO_DEPÓSITO'.normalize('NFD'),
      'PAGAMENTO_DEPOSITO',
    ]) {
      const { eventos } = aplicar({ ...semEvent, evento: nome, amount: '0.10' });
      expect(eventos.map((e) => [e.type, e.value])).toEqual([['deposito', 0.1]]);
    }
    const criado = { ...DOC_DEPOSITO_CRIADO, evento: 'DEPÓSITO_CRIADO'.normalize('NFD') };
    expect(aplicar(criado).eventos).toEqual([]);
  });

  it('pagamento sem paid_at usa created_at; moeda ausente cai na padrão da empresa', () => {
    const p: Record<string, unknown> = { ...DEPOSIT_PAYMENT_REDEPOSITO };
    delete p.paid_at;
    delete p.currency;
    const [e] = aplicar(p).eventos;
    expect(e!.occurred_at).toEqual(new Date('2026-10-20T17:00:00.000Z'));
    expect(e!.currency).toBe('BRL');
  });

  it('pagamento não pago ou evento desconhecido é erro visível (dead-letter)', () => {
    expect(() => aplicar({ ...DEPOSIT_PAYMENT_PRIMEIRO, status: 'CANCELED' })).toThrow(
      /Nenhum bloco/,
    );
    expect(() => aplicar({ ...USER_CREATED, event: 'WITHDRAW_CREATED' })).toThrow(/Nenhum bloco/);
  });

  it('nenhum campo sensível aparece na saída', () => {
    const todos = [
      USER_CREATED,
      DEPOSIT_PAYMENT_PRIMEIRO,
      DEPOSIT_PAYMENT_REDEPOSITO,
      DOC_PAGAMENTO_DEPOSITO,
    ].flatMap((p) => aplicar(p).eventos);
    expect(todos).toHaveLength(4);
    const saida = JSON.stringify(todos);
    for (const v of VALORES_SENSIVEIS) expect(saida).not.toContain(v);
    for (const chave of [
      'user_token',
      'qrcode',
      'user_document',
      'document',
      'user_birth_date',
      'email',
      'phone',
      'fbp',
    ]) {
      expect(saida).not.toContain(chave);
    }
    // E o preset nem lê esses caminhos.
    const preset = JSON.stringify(mapeamentoGtech());
    for (const chave of ['user_token', 'qrcode', 'document', 'birth', 'email', 'phone', 'name']) {
      expect(preset).not.toContain(chave);
    }
  });
});
