import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarClienteApi, INICIO_DUAS_ETAPAS_MOCK, lerConfig } from '@/lib/api';
import { agruparSegredo } from '@/app/(admin)/configuracoes/validacao';

// Cookies da requisição em memória, com as opções de cada `set` para conferir httpOnly e validade.
const cookies = new Map<string, { valor: string; opcoes?: Record<string, unknown> | undefined }>();
const apiFalsa = {
  entrar: vi.fn(),
  redefinir: vi.fn(),
  aceitarConvite: vi.fn(),
  confirmarDuasEtapas: vi.fn(),
  iniciarDuasEtapas: vi.fn(),
  ativarDuasEtapas: vi.fn(),
  desativarDuasEtapas: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (nome: string) => (cookies.has(nome) ? { value: cookies.get(nome)!.valor } : undefined),
    set: (nome: string, valor: string, opcoes?: Record<string, unknown>) =>
      cookies.set(nome, { valor, opcoes }),
    delete: (nome: string) => cookies.delete(nome),
  }),
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  api: () => apiFalsa,
}));

const { redirect } = await import('next/navigation');
const { revalidatePath } = await import('next/cache');
const { aceitarConvite, confirmarCodigo, entrar } = await import('@/app/(conta)/acoes');
const { acaoDuasEtapas } = await import('@/app/(admin)/configuracoes/acoes');

const INICIAL = { ok: true, mensagem: '' };
const form = (campos: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
};
const sessao = {
  token: 'jwt-da-sessao',
  usuario: { id: 'u1', email: 'a@b.c', nome: 'A', sobrenome: 'B' },
  empresas: [
    { id: 'e1', slug: 'pasio', nome: 'PASIO', papel: 'admin' as const },
    { id: 'e2', slug: 'outra', nome: 'Outra', papel: 'leitor' as const },
  ],
};

function resposta(status: number, corpo?: unknown) {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
type F = typeof globalThis.fetch;

describe('lib/api: verificação em duas etapas', () => {
  const config = lerConfig({ API_URL: 'http://api.teste', NODE_ENV: 'production' });

  it('confirmarDuasEtapas é rota pública: manda desafio e código, sem token', async () => {
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void url; // só tipa os argumentos para inspecionar as chamadas
      void init;
      return resposta(200, sessao);
    });
    const cli = criarClienteApi(config, {
      fetch: fetch as unknown as F,
      ip: async () => undefined,
    });
    const r = await cli.confirmarDuasEtapas('desafio-x', '123456');
    expect(r).toEqual({ ok: true, dados: sessao });
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('http://api.teste/auth/duas-etapas');
    expect(init!.method).toBe('POST');
    expect(JSON.parse(String(init!.body))).toEqual({ desafio: 'desafio-x', codigo: '123456' });
    expect((init!.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('entrar devolve o desafio quando a conta pede a segunda etapa', async () => {
    const corpo = { segundoFator: true, desafio: 'desafio-x' };
    const fetch = vi.fn(async () => resposta(200, corpo));
    const cli = criarClienteApi(config, {
      fetch: fetch as unknown as F,
      ip: async () => undefined,
    });
    expect(await cli.entrar('a@b.c', 'senha')).toEqual({ ok: true, dados: corpo });
  });

  it('iniciar, ativar e desativar usam o token da sessão nas rotas /me/duas-etapas', async () => {
    const fetch = vi.fn(async (u: string | URL | Request, init?: RequestInit) => {
      void init; // só tipa o 2º argumento para inspecionar as chamadas
      return String(u).endsWith('/iniciar')
        ? resposta(200, { segredo: 'ABCD', uri: 'otpauth://totp/x?secret=ABCD' })
        : new Response(null, { status: 204 });
    });
    const cli = criarClienteApi(config, {
      fetch: fetch as unknown as F,
      sessao: async () => ({ token: 'tok', empresa: 'pasio' }),
      ip: async () => undefined,
    });
    expect(await cli.iniciarDuasEtapas('senha1')).toEqual({
      ok: true,
      dados: { segredo: 'ABCD', uri: 'otpauth://totp/x?secret=ABCD' },
    });
    expect(await cli.ativarDuasEtapas('123456')).toEqual({ ok: true, dados: null });
    expect(await cli.desativarDuasEtapas('senha1', '654321')).toEqual({ ok: true, dados: null });
    const chamadas = fetch.mock.calls.map(([u, i]) => ({
      url: String(u),
      corpo: JSON.parse(String(i!.body)),
      auth: (i!.headers as Record<string, string>).authorization,
    }));
    expect(chamadas).toEqual([
      {
        url: 'http://api.teste/me/duas-etapas/iniciar',
        corpo: { senhaAtual: 'senha1' },
        auth: 'Bearer tok',
      },
      {
        url: 'http://api.teste/me/duas-etapas/ativar',
        corpo: { codigo: '123456' },
        auth: 'Bearer tok',
      },
      {
        url: 'http://api.teste/me/duas-etapas/desativar',
        corpo: { senhaAtual: 'senha1', codigo: '654321' },
        auth: 'Bearer tok',
      },
    ]);
  });

  it('no mock: iniciar devolve o segredo fixo, ativar e desativar dão ok, me segue indisponível', async () => {
    const fetch = vi.fn();
    const cli = criarClienteApi(lerConfig({ WEB_MOCK_API: '1' }), {
      fetch: fetch as unknown as F,
    });
    expect(await cli.iniciarDuasEtapas('x')).toEqual({ ok: true, dados: INICIO_DUAS_ETAPAS_MOCK });
    expect(INICIO_DUAS_ETAPAS_MOCK.uri).toContain(`secret=${INICIO_DUAS_ETAPAS_MOCK.segredo}`);
    expect(await cli.ativarDuasEtapas('123456')).toEqual({ ok: true, dados: null });
    expect(await cli.desativarDuasEtapas('x', '123456')).toEqual({ ok: true, dados: null });
    // A sidebar depende disso para a captura visual da Visão geral não mudar.
    expect((await cli.me()).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('actions de login com a segunda etapa', () => {
  beforeEach(() => {
    cookies.clear();
    for (const f of Object.values(apiFalsa)) f.mockReset();
    vi.mocked(redirect).mockClear();
    vi.mocked(revalidatePath).mockClear();
  });

  it('entrar com desafio grava o cookie httpOnly de 5 min e vai para /login/codigo', async () => {
    apiFalsa.entrar.mockResolvedValue({
      ok: true,
      dados: { segundoFator: true, desafio: 'desafio-x' },
    });
    await entrar(INICIAL, form({ email: 'a@b.c', senha: 'senha123' }));
    const c = cookies.get('duas_etapas');
    expect(JSON.parse(c!.valor)).toEqual({ desafio: 'desafio-x' });
    expect(c!.opcoes).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 300 });
    expect(cookies.has('sessao')).toBe(false);
    expect(redirect).toHaveBeenCalledWith('/login/codigo');
    expect(redirect).not.toHaveBeenCalledWith('/');
  });

  it('entrar sem segunda etapa segue abrindo a sessão direto', async () => {
    apiFalsa.entrar.mockResolvedValue({ ok: true, dados: sessao });
    await entrar(INICIAL, form({ email: 'a@b.c', senha: 'senha123' }));
    expect(cookies.get('sessao')?.valor).toBe('jwt-da-sessao');
    expect(cookies.get('empresa')?.valor).toBe('pasio');
    expect(cookies.has('duas_etapas')).toBe(false);
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('aceite de convite com desafio guarda a empresa do convite para a sessão abrir nela', async () => {
    apiFalsa.aceitarConvite.mockResolvedValue({
      ok: true,
      dados: { segundoFator: true, desafio: 'desafio-y' },
    });
    await aceitarConvite(
      INICIAL,
      form({ token: 'e2.aleatorio', nome: 'Ana', senha: 'x', jaTemSenha: '1' }),
    );
    expect(JSON.parse(cookies.get('duas_etapas')!.valor)).toEqual({
      desafio: 'desafio-y',
      empresa: 'e2',
    });
    expect(redirect).toHaveBeenCalledWith('/login/codigo');

    apiFalsa.confirmarDuasEtapas.mockResolvedValue({ ok: true, dados: sessao });
    await confirmarCodigo(INICIAL, form({ codigo: '123 456' }));
    expect(apiFalsa.confirmarDuasEtapas).toHaveBeenCalledWith('desafio-y', '123456');
    expect(cookies.get('empresa')?.valor).toBe('outra');
    expect(cookies.has('duas_etapas')).toBe(false);
    expect(redirect).toHaveBeenLastCalledWith('/');
  });

  it('confirmarCodigo sem o cookie diz que expirou e não chama a API', async () => {
    const r = await confirmarCodigo(INICIAL, form({ codigo: '123456' }));
    expect(r).toEqual({
      ok: false,
      mensagem: 'A verificação expirou. Entre de novo.',
      expirou: true,
    });
    expect(apiFalsa.confirmarDuasEtapas).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('código errado mantém o desafio; desafio vencido apaga e pede para entrar de novo', async () => {
    cookies.set('duas_etapas', { valor: JSON.stringify({ desafio: 'd' }) });
    apiFalsa.confirmarDuasEtapas.mockResolvedValueOnce({
      ok: false,
      status: 401,
      codigo: 'nao_autenticado',
      mensagem: 'x',
    });
    expect(await confirmarCodigo(INICIAL, form({ codigo: '000000' }))).toEqual({
      ok: false,
      mensagem: 'Código incorreto.',
    });
    expect(cookies.has('duas_etapas')).toBe(true);

    apiFalsa.confirmarDuasEtapas.mockResolvedValueOnce({
      ok: false,
      status: 429,
      codigo: 'muitas_tentativas',
      mensagem: 'Muitas tentativas. Espere 15 minutos. (HTTP 429)',
    });
    expect((await confirmarCodigo(INICIAL, form({ codigo: '000000' }))).mensagem).toBe(
      'Muitas tentativas. Espere 15 minutos. (HTTP 429)',
    );

    apiFalsa.confirmarDuasEtapas.mockResolvedValueOnce({
      ok: false,
      status: 401,
      codigo: 'token_invalido',
      mensagem: 'x',
    });
    expect(await confirmarCodigo(INICIAL, form({ codigo: '000000' }))).toMatchObject({
      mensagem: 'A verificação expirou. Entre de novo.',
      expirou: true,
    });
    expect(cookies.has('duas_etapas')).toBe(false);
    expect(cookies.has('sessao')).toBe(false);
  });

  it('código fora do formato nem chega à API', async () => {
    cookies.set('duas_etapas', { valor: JSON.stringify({ desafio: 'd' }) });
    const r = await confirmarCodigo(INICIAL, form({ codigo: '12a456' }));
    expect(r.ok).toBe(false);
    expect(apiFalsa.confirmarDuasEtapas).not.toHaveBeenCalled();
  });
});

describe('action do perfil: verificação em duas etapas', () => {
  beforeEach(() => {
    for (const f of Object.values(apiFalsa)) f.mockReset();
    vi.mocked(revalidatePath).mockClear();
  });

  it('iniciar gera o QR em SVG (base64) a partir do otpauth e devolve o segredo', async () => {
    apiFalsa.iniciarDuasEtapas.mockResolvedValue({ ok: true, dados: INICIO_DUAS_ETAPAS_MOCK });
    const r = await acaoDuasEtapas(INICIAL, form({ intencao: 'iniciar', senhaAtual: 's' }));
    expect(apiFalsa.iniciarDuasEtapas).toHaveBeenCalledWith('s');
    expect(r.ok).toBe(true);
    expect(r.duasEtapas?.segredo).toBe(INICIO_DUAS_ETAPAS_MOCK.segredo);
    const svg = Buffer.from(r.duasEtapas!.qrSvgBase64, 'base64').toString('utf8');
    expect(svg).toMatch(/^<svg[\s\S]*<\/svg>\s*$/);
  });

  it('senha errada ao iniciar e código errado ao ativar viram mensagens claras', async () => {
    apiFalsa.iniciarDuasEtapas.mockResolvedValue({ ok: false, status: 403, mensagem: 'x' });
    expect(
      (await acaoDuasEtapas(INICIAL, form({ intencao: 'iniciar', senhaAtual: 's' }))).mensagem,
    ).toBe('A senha atual está incorreta.');

    apiFalsa.ativarDuasEtapas.mockResolvedValue({ ok: false, status: 403, mensagem: 'x' });
    const r = await acaoDuasEtapas(INICIAL, form({ intencao: 'ativar', codigo: '123456' }));
    expect(r.ok).toBe(false);
    expect(r.mensagem).toMatch(/^Código incorreto/);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('ativar e desativar com sucesso recarregam o perfil', async () => {
    apiFalsa.ativarDuasEtapas.mockResolvedValue({ ok: true, dados: null });
    apiFalsa.desativarDuasEtapas.mockResolvedValue({ ok: true, dados: null });
    expect(await acaoDuasEtapas(INICIAL, form({ intencao: 'ativar', codigo: '123 456' }))).toEqual({
      ok: true,
      mensagem: 'Verificação em duas etapas ativada.',
    });
    expect(apiFalsa.ativarDuasEtapas).toHaveBeenCalledWith('123456');
    await acaoDuasEtapas(
      INICIAL,
      form({ intencao: 'desativar', senhaAtual: 's', codigo: '654321' }),
    );
    expect(apiFalsa.desativarDuasEtapas).toHaveBeenCalledWith('s', '654321');
    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith('/configuracoes/perfil');
  });

  it('agrupa o segredo de 4 em 4 para digitar no app', () => {
    expect(agruparSegredo('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(agruparSegredo('ABCDEF')).toBe('ABCD EF');
  });
});
