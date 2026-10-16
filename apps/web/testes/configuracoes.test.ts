import * as contrato from '@trafego/contratos';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
process.env.WEB_MOCK_API = '1';

const { revalidatePath } = await import('next/cache');
const { acaoGastos, acaoMeta, acaoWebhook, salvarApresentacao } =
  await import('@/app/(admin)/configuracoes/acoes');
const v = await import('@/app/(admin)/configuracoes/validacao');
const { adminMock } = await import('@/lib/mock');
const { api } = await import('@/lib/api');

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fd(campos: Record<string, string | File>): FormData {
  const f = new FormData();
  for (const [k, x] of Object.entries(campos)) f.append(k, x);
  return f;
}

describe('validação no cliente', () => {
  it('constantes locais batem com o contrato', () => {
    expect(v.LOGO_TIPOS).toEqual(contrato.LOGO_TIPOS);
    expect(v.LOGO_TAMANHO_MAXIMO).toBe(contrato.LOGO_TAMANHO_MAXIMO);
    expect(v.NOME_EXIBICAO_MAXIMO).toBe(contrato.NOME_EXIBICAO_MAXIMO);
  });
  it('aceita PNG e SVG dentro do limite e deduz o tipo pela extensão', () => {
    expect(v.validarLogo({ name: 'a.png', type: 'image/png', size: 10 })).toBeNull();
    expect(v.validarLogo({ name: 'a.svg', type: '', size: 10 })).toBeNull();
    expect(v.tipoDoLogo({ name: 'a.SVG', type: '' })).toBe('image/svg+xml');
  });
  it('recusa outros tipos, arquivo vazio e acima de 512 KB', () => {
    expect(v.validarLogo({ name: 'a.jpg', type: 'image/jpeg', size: 10 })).toMatch(/PNG ou SVG/);
    expect(v.validarLogo({ name: 'a.png', type: 'image/png', size: 0 })).toMatch(/vazio/);
    expect(
      v.validarLogo({ name: 'a.png', type: 'image/png', size: contrato.LOGO_TAMANHO_MAXIMO + 1 }),
    ).toMatch(/512 KB/);
  });
  it('valida nome (máx. 60) e slug kebab-case', () => {
    expect(v.validarNome('  ')).not.toBeNull();
    expect(v.validarNome('x'.repeat(61))).toMatch(/60/);
    expect(v.validarNome('PASIO')).toBeNull();
    expect(v.validarSlug('hotmart-2')).toBeNull();
    expect(v.validarSlug('a')).not.toBeNull();
    expect(v.validarSlug('-abc')).not.toBeNull();
    expect(v.validarSlug('Abc')).not.toBeNull();
  });
});

describe('formatação', () => {
  it('formata bytes e monta a URL do webhook', () => {
    expect(v.formatarBytes(512)).toBe('512 B');
    expect(v.formatarBytes(512 * 1024)).toBe('512 KB');
    expect(v.formatarBytes(1.5 * 1024 * 1024)).toBe('1,5 MB');
    expect(v.urlWebhook('/webhooks/pasio/x', 'https://ex.com/')).toBe(
      'https://ex.com/webhooks/pasio/x',
    );
    expect(v.urlWebhook('/webhooks/pasio/x', undefined)).toBe('/webhooks/pasio/x');
  });
  it('traduz códigos de erro da API', () => {
    expect(v.mensagemErroApi({ mensagem: 'x', codigo: 'acesso_negado' })).toBe(v.MSG_SO_ADMIN);
    expect(v.mensagemErroApi({ mensagem: 'x', status: 403 })).toBe(v.MSG_SO_ADMIN);
    expect(v.mensagemErroApi({ mensagem: 'x', codigo: 'logo_invalido' })).toMatch(/recusado/);
    expect(v.mensagemErroApi({ mensagem: 'x', codigo: 'logo_grande' })).toMatch(/limite/);
    expect(v.mensagemErroApi({ mensagem: 'boom' })).toMatch(/boom/);
  });
});

describe('gastos e Meta Ads', () => {
  it('lê valor em reais no formato brasileiro', () => {
    expect(v.lerValorReais('150,25')).toBe(150.25);
    expect(v.lerValorReais('R$ 1.234,50')).toBe(1234.5);
    expect(v.lerValorReais('1.500')).toBe(1500);
    expect(v.lerValorReais('99.9')).toBe(99.9);
    expect(v.lerValorReais('0')).toBeNull();
    expect(v.lerValorReais('1,234')).toBeNull();
    expect(v.lerValorReais('-5')).toBeNull();
    expect(v.lerValorReais('abc')).toBeNull();
    expect(v.lerValorReais('')).toBeNull();
  });
  it('formata reais e datas', () => {
    expect(v.formatarReais(1234.5)).toBe('R$ 1.234,50');
    expect(v.formatarDia('2026-03-09')).toBe('09/03/2026');
    expect(v.formatarDia('ontem')).toBe('ontem');
  });
  it('normaliza o ID da conta do Meta', () => {
    expect(v.normalizarContaMeta(' 123 456 789 ')).toBe('act_123456789');
    expect(v.normalizarContaMeta('act_123456789')).toBe('act_123456789');
    expect(v.normalizarContaMeta('minha-conta')).toBeNull();
    expect(v.normalizarContaMeta('12')).toBeNull();
  });
  it('traduz os erros de gasto e Meta', () => {
    expect(v.mensagemErroApi({ mensagem: 'x', codigo: 'custo_nao_encontrado' })).toMatch(/gasto/i);
    expect(v.mensagemErroApi({ mensagem: 'x', codigo: 'meta_conta_existente' })).toMatch(/já/);
    expect(
      v.mensagemErroApi({ mensagem: 'O token do Meta expirou.', codigo: 'meta_recusou' }),
    ).toMatch(/token do Meta expirou/);
  });
  it('recusa lançamento inválido antes de chamar a API', async () => {
    const base = { intencao: 'lancar', dia: '2026-03-09', canal: 'Google', valor: '150,00' };
    expect((await acaoGastos(v.ESTADO_INICIAL, fd({ ...base, valor: '0' }))).mensagem).toMatch(
      /maior que zero/,
    );
    expect((await acaoGastos(v.ESTADO_INICIAL, fd({ ...base, canal: ' ' }))).mensagem).toMatch(
      /canal/,
    );
    expect((await acaoGastos(v.ESTADO_INICIAL, fd({ ...base, dia: '' }))).mensagem).toMatch(/data/);
    const r = await acaoMeta(
      v.ESTADO_INICIAL,
      fd({ intencao: 'conectar', contaId: 'minha-conta', token: 'x'.repeat(30) }),
    );
    expect(r.ok).toBe(false);
  });
});

describe('actions com WEB_MOCK_API=1', () => {
  beforeEach(() => {
    adminMock.reiniciar();
    vi.mocked(revalidatePath).mockClear();
  });

  it('salva nome e logo em base64 e revalida as rotas', async () => {
    const logo = new File([PNG], 'logo.png', { type: 'image/png' });
    const r = await salvarApresentacao(v.ESTADO_INICIAL, fd({ nomeExibicao: 'Nova', logo }));
    expect(r).toEqual({ ok: true, mensagem: v.MSG_SUCESSO_APRESENTACAO });
    const a = await api().apresentacao();
    expect(a.ok && a.dados.nomeExibicao).toBe('Nova');
    expect(a.ok && a.dados.logoUrl).toBe(
      `data:image/png;base64,${Buffer.from(PNG).toString('base64')}`,
    );
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('remover logo envia null; arquivo inválido não chega à API', async () => {
    await salvarApresentacao(
      v.ESTADO_INICIAL,
      fd({ nomeExibicao: 'X', logo: new File([PNG], 'l.png', { type: 'image/png' }) }),
    );
    await salvarApresentacao(v.ESTADO_INICIAL, fd({ nomeExibicao: 'X', remover: '1' }));
    const a = await api().apresentacao();
    expect(a.ok && a.dados.logoUrl).toBeNull();
    const ruim = await salvarApresentacao(
      v.ESTADO_INICIAL,
      fd({ nomeExibicao: 'X', logo: new File(['oi'], 'a.gif', { type: 'image/gif' }) }),
    );
    expect(ruim.ok).toBe(false);
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it('cria fonte e devolve o segredo uma vez; slug repetido vira mensagem', async () => {
    const r = await acaoWebhook(
      v.ESTADO_INICIAL,
      fd({ intencao: 'criar', slug: 'nova-fonte', nome: 'Nova' }),
    );
    expect(r.ok).toBe(true);
    expect(r.segredo).toBeTruthy();
    expect(r.slug).toBe('nova-fonte');
    const de2 = await acaoWebhook(
      v.ESTADO_INICIAL,
      fd({ intencao: 'criar', slug: 'nova-fonte', nome: 'Nova' }),
    );
    expect(de2).toEqual({ ok: false, mensagem: 'Já existe uma fonte com esse slug.' });
  });

  it('rotaciona segredo e alterna ativo', async () => {
    const rot = await acaoWebhook(v.ESTADO_INICIAL, fd({ intencao: 'rotacionar', id: 'mock-1' }));
    expect(rot.segredo).toBeTruthy();
    const alt = await acaoWebhook(
      v.ESTADO_INICIAL,
      fd({ intencao: 'alternar', id: 'mock-1', ativo: '1' }),
    );
    expect(alt.ok).toBe(true);
    expect(alt.segredo).toBeUndefined();
    const f = await api().fontes();
    expect(f.ok && f.dados.fontes[0]?.ativo).toBe(false);
  });
});
