import { buildCustomRoute } from 'next/dist/server/lib/router-utils/filesystem';
import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig from '../next.config';

/**
 * Cabeçalhos finais de um caminho como o Next aplica: todas as regras que casam, na ordem, e a
 * última vence quando duas definem a mesma chave. O matcher é o mesmo que o roteador do Next monta.
 */
async function cabecalhos(caminho: string): Promise<Record<string, string>> {
  const regras = (await nextConfig.headers?.()) ?? [];
  const final: Record<string, string> = {};
  for (const r of regras) {
    if (!buildCustomRoute('header', r).match(caminho)) continue;
    for (const h of r.headers) final[h.key] = h.value;
  }
  return final;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('next.config: cabeçalhos de segurança', () => {
  it('não anuncia o framework', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it('manda os cabeçalhos básicos em qualquer rota', async () => {
    for (const caminho of ['/', '/leads', '/configuracoes/usuarios']) {
      const h = await cabecalhos(caminho);
      expect(h['X-Frame-Options']).toBe('DENY');
      expect(h['X-Content-Type-Options']).toBe('nosniff');
      expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(h['Permissions-Policy']).toBe(
        'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      );
      expect(h['X-XSS-Protection']).toBe('0');
      expect(h['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    }
  });

  it('convite e redefinição (token na query) ficam com no-referrer', async () => {
    for (const caminho of ['/convite', '/redefinir', '/convite/', '/redefinir/x']) {
      const h = await cabecalhos(caminho);
      expect(h['Referrer-Policy']).toBe('no-referrer');
      expect(h['X-Frame-Options']).toBe('DENY');
    }
    expect((await cabecalhos('/login'))['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect((await cabecalhos('/convites'))['Referrer-Policy']).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('em produção: HSTS sem subdomínios e CSP sem unsafe-eval nem ws:', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const h = await cabecalhos('/');
    expect(h['Strict-Transport-Security']).toBe('max-age=31536000');
    expect(h['Content-Security-Policy']).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data: blob:; " +
        "frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'",
    );
  });

  it('fora de produção: sem HSTS, com unsafe-eval e ws: para o dev do Next', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const h = await cabecalhos('/');
    expect(h['Strict-Transport-Security']).toBeUndefined();
    expect(h['Content-Security-Policy']).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    );
    expect(h['Content-Security-Policy']).toContain("connect-src 'self' data: blob: ws:");
  });
});
