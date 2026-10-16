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
});
