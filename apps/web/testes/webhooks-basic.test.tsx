// @vitest-environment jsdom
/** Aba Webhooks: instrução para plataformas que só aceitam autenticação Basic (ex.: GTech). */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/(admin)/configuracoes/acoes', () => ({ acaoWebhook: vi.fn() }));

const { PainelWebhooks } = await import('@/app/(admin)/configuracoes/webhooks/PainelWebhooks');

const fonte = (slug: string, segredoUtilizavel: boolean) => ({
  id: `id-${slug}`,
  slug,
  nome: slug.toUpperCase(),
  ativo: true,
  caminho: `/webhooks/pasio/${slug}`,
  segredoUtilizavel,
  criadoEm: '2026-10-20T00:00:00.000Z',
  atualizadoEm: null,
  url: `https://api.kapanda.lat/webhooks/pasio/${slug}`,
});

afterEach(cleanup);

describe('ajuda de autenticação Basic', () => {
  it('mostra URL, tipo BASIC e slug como usuário, sem expor segredo', () => {
    const { container } = render(
      <PainelWebhooks fontes={[fonte('gtech', true), fonte('parceiro', false)]} />,
    );
    const ajuda = container.querySelector('details.cfg-ajuda') as HTMLElement;
    expect(ajuda).not.toBeNull();
    expect(
      within(ajuda).getByText('Plataforma que só aceita autenticação Basic (ex.: GTech)'),
    ).toBeTruthy();

    const linhas = within(ajuda).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(2);
    const [gtech, parceiro] = linhas as [HTMLElement, HTMLElement];
    expect(within(gtech).getByText('https://api.kapanda.lat/webhooks/pasio/gtech')).toBeTruthy();
    expect(within(gtech).getByText('BASIC')).toBeTruthy();
    expect(within(gtech).getByText('gtech')).toBeTruthy();
    expect(gtech.textContent).toContain('Segredo da fonte');
    expect(gtech.textContent).not.toContain('gere um segredo novo');
    expect(parceiro.textContent).toContain('(gere um segredo novo)');
  });

  it('sem fontes, mostra só a explicação', () => {
    const { container } = render(<PainelWebhooks fontes={[]} />);
    const ajuda = container.querySelector('details.cfg-ajuda') as HTMLElement;
    expect(ajuda.querySelector('table')).toBeNull();
    expect(ajuda.textContent).toContain('BASIC');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
