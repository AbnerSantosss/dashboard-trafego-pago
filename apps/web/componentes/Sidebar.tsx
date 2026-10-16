import { referencia } from '@trafego/fixtures';
import Link from 'next/link';
import { montarSidebar, NAV_Y } from '@/lib/tela';
import { Nos } from './Nos';

export const ROTAS: Record<string, string> = {
  'visao-geral': '/',
  'gestao-custos': '/gestao-de-custos',
  relatorios: '/relatorios',
  ajuda: '/ajuda',
};

/** Sidebar de 180 px: logo, menu principal e Ajuda no rodapé. */
export function Sidebar({
  ativo,
  logoUrl = '/brand/pasio-logo.png',
  nomeEmpresa = referencia.empresa,
}: {
  ativo: string;
  logoUrl?: string;
  nomeEmpresa?: string;
}) {
  return (
    <aside className="sidebar" aria-label="Menu principal">
      <img className="logo logo-pasio" src={logoUrl} alt={nomeEmpresa} />
      <Nos nos={montarSidebar(referencia.menu, ativo)} />
      <nav aria-label="Seções">
        {referencia.menu.map((m) => {
          const topo = m.posicao === 'rodape' ? 680 : (NAV_Y[m.id] ?? 0) - 20;
          return (
            <Link
              key={m.id}
              href={ROTAS[m.id] ?? '/'}
              className="alvo nav-link"
              style={{ left: 8, top: topo, width: 160, height: m.posicao === 'rodape' ? 30 : 40 }}
              aria-current={m.id === ativo ? 'page' : undefined}
            >
              <span className="so-leitor">{m.rotulo}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
