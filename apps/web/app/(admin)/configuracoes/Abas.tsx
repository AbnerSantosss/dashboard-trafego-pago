'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Tag GTM, Webhooks e Meta Ads moram dentro de Instalação (submenu em SubInstalacao). */
export const SUB_INSTALACAO = [
  { href: '/configuracoes/instalacao', rotulo: 'Visão geral' },
  { href: '/configuracoes/tag', rotulo: 'Tag do GTM' },
  { href: '/configuracoes/webhooks', rotulo: 'Webhooks' },
  { href: '/configuracoes/meta-ads', rotulo: 'Meta Ads' },
];

const ABAS = [
  {
    href: '/configuracoes/instalacao',
    rotulo: 'Instalação',
    grupo: SUB_INSTALACAO.map((s) => s.href),
  },
  { href: '/configuracoes/perfil', rotulo: 'Perfil' },
  { href: '/configuracoes/usuarios', rotulo: 'Usuários' },
  { href: '/configuracoes/gastos', rotulo: 'Gastos' },
  { href: '/configuracoes/apresentacao', rotulo: 'Apresentação' },
];

export function Abas() {
  const caminho = usePathname();
  return (
    <nav className="cfg-abas" aria-label="Seções das configurações">
      {ABAS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="cfg-aba"
          aria-current={
            caminho === a.href ? 'page' : a.grupo?.includes(caminho) ? 'true' : undefined
          }
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}

/** Submenu de Instalação: botões que trocam entre a visão geral e o passo a passo de cada ligação. */
export function SubInstalacao() {
  const caminho = usePathname();
  if (!SUB_INSTALACAO.some((s) => s.href === caminho)) return null;
  return (
    <nav className="cfg-sub" aria-label="Partes da instalação">
      {SUB_INSTALACAO.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="cfg-sub-botao"
          aria-current={caminho === s.href ? 'page' : undefined}
        >
          {s.rotulo}
        </Link>
      ))}
    </nav>
  );
}
