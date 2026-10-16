// @vitest-environment jsdom
/** Clique no funil: ações do servidor, achatamento do webhook e a gaveta lista → ficha → volta. */
import type { EventoLead, EventosEtapaResposta, FichaLead } from '@trafego/contratos';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiFalsa = { eventosEtapa: vi.fn(), lead: vi.fn() };
vi.mock('@/lib/api', () => ({ api: () => apiFalsa }));

const { buscarEtapa, buscarLead } = await import('@/app/acoes-funil');
const { achatarPayload, GavetaFunil } = await import('@/componentes/GavetaFunil');

const evento = (leadKey: string, canal: string, valor: number): EventoLead => ({
  id: `00000000-0000-4000-8000-${leadKey.slice(-4).padStart(12, '0')}`,
  tipo: 'ftd',
  ocorridoEm: '2024-05-24T11:13:00.000Z',
  valor,
  moeda: 'BRL',
  canal,
  campanha: 'parceiro-tipster',
  pagina: null,
  leadKey,
  utmSource: 'tipster',
  utmMedium: 'affiliate',
  utmCampaign: 'parceiro-tipster',
  referrer: null,
  origem: 'webhook',
});

const LISTA: EventosEtapaResposta = {
  etapa: 'ftd',
  periodo: { de: '2024-05-01', ate: '2024-05-24' },
  fuso: 'America/Sao_Paulo',
  total: 2,
  valorTotal: 150,
  eventos: [evento('demo-1036', 'Afiliados', 50), evento('demo-1001', 'Meta', 100)],
  porCanal: [
    { canal: 'Afiliados', total: 1 },
    { canal: 'Meta', total: 1 },
  ],
  opcoes: { canais: ['Afiliados', 'Meta'], campanhas: ['parceiro-tipster'] },
};

const FICHA: FichaLead = {
  leadKey: 'demo-1036',
  canalOrigem: 'Afiliados',
  primeiroEvento: '2024-05-24T10:48:00.000Z',
  ultimoEvento: '2024-05-24T11:13:00.000Z',
  cadastroEm: '2024-05-24T11:04:00.000Z',
  ftd: { em: '2024-05-24T11:13:00.000Z', valor: 50 },
  depositos: { quantidade: 1, total: 50 },
  eventos: [evento('demo-1036', 'Afiliados', 50)],
  toques: [
    {
      id: 't1',
      tipo: 'page_view',
      recebidoEm: '2024-05-24T10:48:00.000Z',
      url: 'https://pasio.exemplo.com/lp/parceiro-tipster',
      referrer: null,
      utmSource: 'tipster',
      utmMedium: 'affiliate',
      utmCampaign: 'parceiro-tipster',
      utmContent: 'criativo-a',
      utmTerm: null,
      clickIds: { fbclid: 'IwAR123' },
    },
  ],
  webhooks: [
    {
      id: 'w1',
      fonte: 'demo',
      eventKey: 'demo-ftd-1036',
      recebidoEm: '2024-05-24T11:13:00.000Z',
      status: 'processado',
      payload: { event: 'deposit.first', amount: 50, password: '••••' },
    },
  ],
};

beforeEach(() => {
  apiFalsa.eventosEtapa.mockReset();
  apiFalsa.lead.mockReset();
});
afterEach(cleanup);

describe('achatarPayload', () => {
  it('objetos viram a.b, listas a[0], nulos viram —', () => {
    expect(
      achatarPayload({ event: 'x', user: { id: 1, tags: ['a', 'b'] }, vazio: null, ok: true }),
    ).toEqual([
      ['event', 'x'],
      ['user.id', '1'],
      ['user.tags[0]', 'a'],
      ['user.tags[1]', 'b'],
      ['vazio', '—'],
      ['ok', 'true'],
    ]);
  });
});

describe('ações do funil', () => {
  it('recusa etapa desconhecida sem chamar a API e descarta datas inválidas', async () => {
    expect(await buscarEtapa({ etapa: 'xyz' })).toEqual({
      ok: false,
      mensagem: 'Etapa desconhecida.',
    });
    expect(apiFalsa.eventosEtapa).not.toHaveBeenCalled();

    apiFalsa.eventosEtapa.mockResolvedValue({ ok: true, dados: LISTA });
    await buscarEtapa({ etapa: 'ftd', de: '2024-05-01', ate: 'ontem', canal: 'Meta' });
    expect(apiFalsa.eventosEtapa).toHaveBeenCalledWith({
      etapa: 'ftd',
      de: '2024-05-01',
      canal: 'Meta',
    });
  });

  it('traduz 403 e 404 e recusa id vazio', async () => {
    apiFalsa.lead.mockResolvedValueOnce({ ok: false, status: 403, mensagem: 'x' });
    expect(await buscarLead('demo-1')).toMatchObject({
      mensagem: expect.stringMatching(/analistas/),
    });
    apiFalsa.lead.mockResolvedValueOnce({ ok: false, status: 404, mensagem: 'x' });
    expect(await buscarLead('demo-1')).toMatchObject({
      mensagem: expect.stringMatching(/registros/),
    });
    expect(await buscarLead('   ')).toEqual({ ok: false, mensagem: 'Usuário inválido.' });
  });
});

describe('GavetaFunil', () => {
  it('lista com filtro por canal, abre a ficha, volta e fecha com Esc', async () => {
    apiFalsa.eventosEtapa.mockResolvedValue({ ok: true, dados: LISTA });
    apiFalsa.lead.mockResolvedValue({ ok: true, dados: FICHA });
    const onFechar = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <GavetaFunil
        etapa={{ id: 'ftd', rotulo: 'FTD' }}
        de="2024-05-01"
        ate="2024-05-24"
        canal="todos"
        campanha="todas"
        fuso="America/Sao_Paulo"
        onFechar={onFechar}
      />,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    const itemMeta = await screen.findByRole('button', { name: /demo-1001, Meta/ });
    expect(screen.getAllByRole('button', { name: /Abrir ficha/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Afiliados/, pressed: false }));
    expect(screen.queryByRole('button', { name: /demo-1001, Meta/ })).toBeNull();
    expect(itemMeta.isConnected).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /demo-1036, Afiliados/ }));
    expect(apiFalsa.lead).toHaveBeenCalledWith('demo-1036');
    expect(await screen.findByText('utm_content')).toBeTruthy();
    expect(screen.getByText('IwAR123')).toBeTruthy();
    expect(screen.getAllByText('deposit.first').length).toBeGreaterThan(0);
    expect(screen.getByText('••••')).toBeTruthy();

    // Esc na ficha volta para a lista; na lista fecha (depois da animação de saída).
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(await screen.findByRole('button', { name: /demo-1036, Afiliados/ })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(onFechar).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('mostra o erro da ação em vez da lista', async () => {
    apiFalsa.eventosEtapa.mockResolvedValue({ ok: false, status: 403, mensagem: 'x' });
    render(
      <GavetaFunil
        etapa={{ id: 'ftd', rotulo: 'FTD' }}
        de="2024-05-01"
        ate="2024-05-24"
        canal="todos"
        campanha="todas"
        fuso="America/Sao_Paulo"
        onFechar={() => {}}
      />,
    );
    expect((await screen.findByRole('alert')).textContent).toMatch(/analistas/);
  });
});
