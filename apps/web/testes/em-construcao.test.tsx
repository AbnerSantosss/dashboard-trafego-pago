/** EmConstrucao: lê logo e nome de Configurações → Apresentação, com padrão se a leitura falhar. */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const apresentacao = vi.fn();
vi.mock('@/lib/api', () => ({ api: () => ({ apresentacao }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...resto }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

const { EmConstrucao, lerMarcaSidebar } = await import('@/componentes/EmConstrucao');

afterEach(() => vi.clearAllMocks());

describe('lerMarcaSidebar', () => {
  it('usa o logo enviado e o nome exibido', async () => {
    apresentacao.mockResolvedValue({
      ok: true,
      dados: { logoUrl: '/up/logo.png', logoPadraoUrl: '/brand/x.png', nomeExibicao: 'ACME' },
    });
    expect(await lerMarcaSidebar()).toEqual({ logoUrl: '/up/logo.png', nomeEmpresa: 'ACME' });
  });

  it('sem logo enviado cai no padrão da empresa; sem padrão, null (nome em texto)', async () => {
    apresentacao.mockResolvedValue({
      ok: true,
      dados: { logoUrl: null, logoPadraoUrl: null, nomeExibicao: '' },
    });
    expect(await lerMarcaSidebar()).toEqual({ logoUrl: null });
  });

  it('falha ou exceção na leitura: vazio (a Sidebar usa o padrão)', async () => {
    apresentacao.mockResolvedValue({ ok: false, mensagem: 'erro', status: 500 });
    expect(await lerMarcaSidebar()).toEqual({});
    apresentacao.mockRejectedValue(new Error('rede'));
    expect(await lerMarcaSidebar()).toEqual({});
  });
});

describe('EmConstrucao', () => {
  it('passa a marca para a Sidebar e tem o link de pular para a região principal', async () => {
    apresentacao.mockResolvedValue({
      ok: true,
      dados: { logoUrl: '/up/logo.png', logoPadraoUrl: null, nomeExibicao: 'ACME' },
    });
    const html = renderToStaticMarkup(await EmConstrucao({ ativo: 'relatorios', titulo: 'X' }));
    expect(html).toContain('src="/up/logo.png"');
    expect(html).toContain('alt="ACME"');
    expect(html).toMatch(/<a class="pular-link" href="#conteudo">Pular para o conteúdo<\/a>/);
    expect(html).toContain('<main id="conteudo"');
    expect(html.indexOf('pular-link')).toBeLessThan(html.indexOf('<aside'));
  });

  it('tem o fundo de ondas decorativo, escondido do leitor de tela e atrás do conteúdo', async () => {
    apresentacao.mockResolvedValue({ ok: false, mensagem: 'erro', status: 500 });
    const html = renderToStaticMarkup(await EmConstrucao({ ativo: 'relatorios', titulo: 'X' }));
    expect(html).toContain('<div class="fo" data-fo="espera" aria-hidden="true">');
    expect(html.indexOf('class="fo"')).toBeLessThan(html.indexOf('<h1'));
    expect(html).not.toContain('<circle');
    expect(html).not.toContain('filter=');
  });

  it('com a leitura falhando, mostra o logo padrão', async () => {
    apresentacao.mockResolvedValue({ ok: false, mensagem: 'erro', status: 500 });
    const html = renderToStaticMarkup(
      await EmConstrucao({ ativo: 'relatorios', titulo: 'Relatórios' }),
    );
    expect(html).toContain('src="/brand/pasio-logo.png"');
  });
});
