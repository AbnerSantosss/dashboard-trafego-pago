/** Cliente da Graph API do Meta com `fetch` falso: paginação, token no cabeçalho e erros traduzidos. */
import { describe, expect, it } from 'vitest';
import { criarClienteMeta, ErroMeta, normalizarContaId, traduzirErroMeta } from './meta.js';

const TOKEN = 'EAAB-token-de-teste-0123456789';

function fetchFalso(respostas: Array<{ status?: number; corpo: unknown }>) {
  const chamadas: Array<{ url: string; auth: string | null }> = [];
  const f = (async (url: string, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    chamadas.push({ url, auth: h.get('authorization') });
    const r = respostas.shift() ?? { corpo: { data: [] } };
    return new Response(JSON.stringify(r.corpo), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { f, chamadas };
}

describe('normalizarContaId', () => {
  it.each([
    ['123456', 'act_123456'],
    ['act_123456', 'act_123456'],
    [' 123 456 789 ', 'act_123456789'],
    ['abc', null],
    ['act_', null],
    ['12', null],
  ])('%s → %s', (entrada, saida) => {
    expect(normalizarContaId(entrada)).toBe(saida);
  });
});

describe('criarClienteMeta', () => {
  it('lerGastos segue a paginação, ignora gasto zero e manda o token só no cabeçalho', async () => {
    const { f, chamadas } = fetchFalso([
      {
        corpo: {
          data: [
            { date_start: '2026-03-01', campaign_id: '1', campaign_name: 'Camp A', spend: '10.50' },
            { date_start: '2026-03-01', campaign_id: '2', campaign_name: 'Camp B', spend: '0' },
          ],
          paging: { next: 'https://graph.facebook.com/v23.0/act_1/insights?after=x' },
        },
      },
      {
        corpo: {
          data: [
            { date_start: '2026-03-02', campaign_id: '1', campaign_name: 'Camp A', spend: '3.333' },
          ],
        },
      },
    ]);
    const cliente = criarClienteMeta({ fetch: f });
    const gastos = await cliente.lerGastos('act_1', TOKEN, '2026-03-01', '2026-03-02');
    expect(gastos).toEqual([
      { dia: '2026-03-01', campanhaId: '1', campanha: 'Camp A', valor: 10.5 },
      { dia: '2026-03-02', campanhaId: '1', campanha: 'Camp A', valor: 3.33 },
    ]);
    expect(chamadas).toHaveLength(2);
    for (const c of chamadas) {
      expect(c.auth).toBe(`Bearer ${TOKEN}`);
      expect(c.url).not.toContain(TOKEN);
    }
    expect(chamadas[0]!.url).toContain('/v23.0/act_1/insights?');
    expect(chamadas[0]!.url).toContain('time_increment=1');
  });

  it('não segue link de paginação fora do graph.facebook.com', async () => {
    const { f, chamadas } = fetchFalso([
      { corpo: { data: [], paging: { next: 'https://exemplo.com/roubar' } } },
    ]);
    await criarClienteMeta({ fetch: f }).lerGastos('act_1', TOKEN, '2026-03-01', '2026-03-01');
    expect(chamadas).toHaveLength(1);
  });

  it('lerConta devolve nome, moeda e situação', async () => {
    const { f } = fetchFalso([
      { corpo: { name: 'Conta PASIO', currency: 'BRL', account_status: 1, id: 'act_1' } },
    ]);
    const conta = await criarClienteMeta({ fetch: f }).lerConta('act_1', TOKEN);
    expect(conta).toEqual({ nome: 'Conta PASIO', moeda: 'BRL', status: 1 });
  });

  it('erro da Graph API vira ErroMeta com mensagem em português', async () => {
    const { f } = fetchFalso([
      { status: 400, corpo: { error: { code: 190, message: 'Invalid OAuth access token' } } },
    ]);
    const erro = await criarClienteMeta({ fetch: f })
      .lerConta('act_1', TOKEN)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroMeta);
    expect((erro as ErroMeta).codigo).toBe(190);
    expect((erro as ErroMeta).message).toMatch(/token do Meta é inválido/);
  });

  it('falha de rede vira ErroMeta', async () => {
    const f = (async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;
    await expect(criarClienteMeta({ fetch: f }).lerConta('act_1', TOKEN)).rejects.toBeInstanceOf(
      ErroMeta,
    );
  });

  it('traduzirErroMeta cobre limite de consultas e código desconhecido', () => {
    expect(traduzirErroMeta(17, 'x')).toMatch(/limitou/);
    expect(traduzirErroMeta(undefined, 'algo estranho')).toBe(
      'O Meta recusou a consulta: algo estranho',
    );
  });
});
