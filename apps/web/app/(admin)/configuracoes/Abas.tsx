'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ABAS = [
  { href: '/configuracoes/perfil', rotulo: 'Perfil' },
  { href: '/configuracoes/usuarios', rotulo: 'Usuários' },
  { href: '/configuracoes/tag', rotulo: 'Tag GTM' },
  { href: '/configuracoes/webhooks', rotulo: 'Webhooks' },
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
          aria-current={caminho === a.href ? 'page' : undefined}
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
