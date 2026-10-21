import { jwtVerify, SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { criarClienteApi, lerConfig } from '@/lib/api';

const SEGREDO = 'segredo-de-teste-0123456789abcdef-0123456789';
const chave = new TextEncoder().encode(SEGREDO);

async function tokenCom(expSeg: number) {
  return new SignJWT({ email: 'a@b.c' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(expSeg))
    .sign(chave);
}

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const config = lerConfig({ API_URL: 'http://api.teste', AUTH_SECRET: SEGREDO });
type F = typeof globalThis.fetch;

describe('lib/api', () => {
  it('usa sessao-dev, reaproveita o token e manda os cabeçalhos', async () => {
    const agora = 1_700_000_000_000;
    const token = await tokenCom(agora / 1000 + 3600);
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void init; // só tipa o 2º argumento para inspecionar as chamadas
      return String(url).endsWith('/auth/sessao-dev')
        ? resposta(200, { token })
        : resposta(200, {});
    });
    const cli = criarClienteApi(config, { fetch: fetch as unknown as F, agora: () => agora });
    await cli.visaoGeral({ de: '2024-05-01', ate: '2024-05-24' });
    const r = await cli.visaoGeral({});
    expect(r.ok).toBe(true);
    const sessoes = fetch.mock.calls.filter(([u]) => String(u).endsWith('/auth/sessao-dev'));
    expect(sessoes).toHaveLength(1);
    const [url, init] = fetch.mock.calls[1]!;
    expect(String(url)).toContain('/metricas/visao-geral?');
    expect(String(url)).toContain('de=2024-05-01');
    const h = init!.headers as Record<string, string>;
    expect(h.authorization).toBe(`Bearer ${token}`);
    expect(h['x-tenant']).toBe('pasio');
    expect(init!.cache).toBe('no-store');
  });

  it('sem sessao-dev, assina localmente com WEB_USUARIO_ID', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const cfg = lerConfig({ AUTH_SECRET: SEGREDO, WEB_USUARIO_ID: id });
    const fetch = vi.fn(async () => resposta(404, {}));
    const cli = criarClienteApi(cfg, { fetch: fetch as unknown as F });
    const { payload } = await jwtVerify(await cli.obterToken(), chave);
    expect(payload.sub).toBe(id);
    expect(payload.email).toBe('admin@pasio.local');
  });

  it('falha da API vira mensagem em pt-BR, sem lançar', async () => {
    const token = await tokenCom(Date.now() / 1000 + 3600);
    const fetch = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith('/auth/sessao-dev')
        ? resposta(200, { token })
        : resposta(503, { erro: { mensagem: 'Banco fora.' } }),
    );
    const cli = criarClienteApi(config, { fetch: fetch as unknown as F });
    expect(await cli.visaoGeral({})).toEqual({
      ok: false,
      status: 503,
      mensagem: 'Banco fora. (HTTP 503)',
    });
  });

  it('tempo esgotado vira mensagem em português; numa escrita, avisa que pode ter sido feita', async () => {
    const fetch = vi.fn(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    const cli = criarClienteApi(config, {
      fetch: fetch as unknown as F,
      sessao: async () => ({ token: 'tok', empresa: 'pasio' }),
    });
    expect(await cli.visaoGeral({})).toEqual({
      ok: false,
      mensagem: 'A API não respondeu em 4 s (tempo esgotado).',
    });
    expect(await cli.convidar('pessoa@empresa.com', 'leitor')).toEqual({
      ok: false,
      mensagem:
        'A API não respondeu em 4 s (tempo esgotado). A ação pode ter sido concluída mesmo ' +
        'assim: recarregue a página para conferir.',
    });
  });

  it('repassa o IP do visitante (cf-connecting-ip) nas rotas com e sem login', async () => {
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void url;
      void init;
      return resposta(200, {});
    });
    const cli = criarClienteApi(config, {
      fetch: fetch as unknown as F,
      sessao: async () => ({ token: 'tok', empresa: 'pasio' }),
      ip: async () => '203.0.113.7',
    });
    await cli.visaoGeral({});
    await cli.entrar('a@b.c', 'senha-qualquer');
    for (const [, init] of fetch.mock.calls) {
      expect((init!.headers as Record<string, string>)['cf-connecting-ip']).toBe('203.0.113.7');
    }
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('em produção, sem cookie de sessão, falha como não autenticada sem sessão provisória', async () => {
    const cfg = lerConfig({
      NODE_ENV: 'production',
      AUTH_SECRET: SEGREDO,
      WEB_USUARIO_ID: '11111111-1111-4111-8111-111111111111',
    });
    const fetch = vi.fn(async () => resposta(200, {}));
    const cli = criarClienteApi(cfg, { fetch: fetch as unknown as F, sessao: async () => ({}) });
    expect(await cli.visaoGeral({})).toEqual({
      ok: false,
      mensagem: 'Sessão ausente. Entre de novo.',
      status: 401,
    });
    expect(await cli.convidar('pessoa@empresa.com', 'leitor')).toMatchObject({ status: 401 });
    await expect(cli.obterToken()).rejects.toThrow('produção');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('em produção, com cookie de sessão, usa o token do cookie', async () => {
    const cfg = lerConfig({ NODE_ENV: 'production' });
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void url;
      void init;
      return resposta(200, {});
    });
    const cli = criarClienteApi(cfg, {
      fetch: fetch as unknown as F,
      sessao: async () => ({ token: 'tok', empresa: 'pasio' }),
    });
    expect((await cli.visaoGeral({})).ok).toBe(true);
    const h = fetch.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(h.authorization).toBe('Bearer tok');
  });

  it('sair manda POST /auth/sair com o token dado, sem corpo, e aceita 204', async () => {
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void url;
      void init;
      return new Response(null, { status: 204 });
    });
    const cli = criarClienteApi(config, {
      fetch: fetch as unknown as F,
      sessao: async () => ({ token: 'outro', empresa: 'pasio' }),
      ip: async () => undefined,
    });
    expect(await cli.sair('tok-do-cookie')).toEqual({ ok: true, dados: null });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('http://api.teste/auth/sair');
    expect(init!.method).toBe('POST');
    expect(init!.body).toBeUndefined();
    const h = init!.headers as Record<string, string>;
    expect(h.authorization).toBe('Bearer tok-do-cookie');
    expect(h['content-type']).toBeUndefined();
  });

  it('sair com a API fora devolve a falha sem lançar; no mock nem chama', async () => {
    const fora = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const cli = criarClienteApi(config, { fetch: fora as unknown as F, ip: async () => undefined });
    expect(await cli.sair('tok')).toEqual({
      ok: false,
      mensagem: 'API indisponível: fetch failed',
    });
    const fetch = vi.fn();
    const mock = criarClienteApi(lerConfig({ WEB_MOCK_API: '1' }), {
      fetch: fetch as unknown as F,
    });
    expect(await mock.sair('tok')).toEqual({ ok: true, dados: null });
    expect(fetch).not.toHaveBeenCalled();
  });
});
