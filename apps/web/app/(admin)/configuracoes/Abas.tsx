'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ABAS = [
  { href: '/configuracoes/apresentacao', rotulo: 'Apresentação' },
  { href: '/configuracoes/webhooks', rotulo: 'Webhooks' },
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
