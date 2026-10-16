/**
 * Roda a tag gerada num navegador falso (node:vm) e confere o que ela envia para a API.
 */
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { gerarTagGtm, urlColeta } from '@/lib/tag-gtm';

const ENDPOINT = urlColeta('https://api.teste/', 'pasio');

function armazenamento() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    mapa: m,
  };
}

function navegador(opcoes: { busca?: string; cookie?: string; dataLayer?: unknown[] } = {}) {
  const enviados: { url: string; corpo: Record<string, unknown> }[] = [];
  const local = armazenamento();
  const sessao = armazenamento();
  const ctx = {
    location: { search: opcoes.busca ?? '', href: `https://site.teste/${opcoes.busca ?? ''}` },
    document: { cookie: opcoes.cookie ?? '', referrer: '' },
    localStorage: local,
    sessionStorage: sessao,
    navigator: {
      sendBeacon: (url: string, blob: { texto: string }) => {
        enviados.push({ url, corpo: JSON.parse(blob.texto) });
        return true;
      },
    },
    Blob: class {
      texto: string;
      constructor(partes: string[]) {
        this.texto = partes.join('');
      }
    },
    window: {} as Record<string, unknown>,
  };
  ctx.window.dataLayer = opcoes.dataLayer;
  const codigo = gerarTagGtm(ENDPOINT).replace(/^<script>|<\/script>$/g, '');
  const rodar = () => runInNewContext(codigo, { ...ctx, window: ctx.window });
  return { rodar, enviados, local, ctx };
}

describe('tag GTM', () => {
  it('monta o endereço de coleta', () => {
    expect(ENDPOINT).toBe('https://api.teste/t/pasio/clk');
  });

  it('envia clique, utms, user_id do dataLayer e cv=1 só na primeira página', () => {
    const n = navegador({
      busca: '?gclid=G1&utm_source=google&utm_campaign=bf&utm_content={{Click Text}}',
      cookie: '_fbp=fb.1.2.3; _fbc=fb.1.1700000000.FBCLICK',
      dataLayer: [{ event: 'gtm.js' }, { custom_parameters: { player_id: 'J42' } }],
    });
    n.rodar();
    expect(n.enviados).toHaveLength(1);
    expect(n.enviados[0]!.url).toBe(ENDPOINT);
    expect(n.enviados[0]!.corpo).toMatchObject({
      tipo: 'page_view',
      cv: 1,
      gclid: 'G1',
      fbclid: 'FBCLICK',
      fbp: 'fb.1.2.3',
      utm_source: 'google',
      utm_campaign: 'bf',
      user_id: 'J42',
    });
    expect(n.enviados[0]!.corpo).not.toHaveProperty('utm_content');

    // Mesma sessão e mesma identidade: não envia de novo.
    n.rodar();
    expect(n.enviados).toHaveLength(1);
  });

  it('guarda a campanha (sticky) e reenvia quando o user_id aparece depois', () => {
    const n = navegador({ busca: '?fbclid=F1&utm_campaign=lancamento', dataLayer: [] });
    n.rodar();
    expect(n.enviados[0]!.corpo).toMatchObject({ fbclid: 'F1', cv: 1 });
    expect(n.enviados[0]!.corpo).not.toHaveProperty('user_id');

    n.ctx.location.search = '';
    n.ctx.window.dataLayer = [{ user_id: 'U9' }];
    n.rodar();
    expect(n.enviados).toHaveLength(2);
    expect(n.enviados[1]!.corpo).toMatchObject({
      user_id: 'U9',
      fbclid: 'F1',
      utm_campaign: 'lancamento',
    });
    expect(n.enviados[1]!.corpo).not.toHaveProperty('cv');
  });
});
