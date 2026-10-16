import Link from 'next/link';
import { EmConstrucao } from '@/componentes/EmConstrucao';

// Lê logo e nome exibido da empresa a cada requisição (Configurações → Apresentação).
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ajuda' };

export default function Ajuda() {
  return (
    <>
      <EmConstrucao ativo="ajuda" titulo="Ajuda" />
      <p
        className="ajuda-links"
        style={{ position: 'absolute', left: 210, top: 130, margin: 0, fontSize: 14 }}
      >
        <Link href="/configuracoes" style={{ color: 'var(--p-nav-ic-ativo)' }}>
          Configurações da empresa
        </Link>
      </p>
    </>
  );
}
