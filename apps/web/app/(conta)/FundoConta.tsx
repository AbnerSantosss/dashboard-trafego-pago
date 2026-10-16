'use client';
import { usePathname } from 'next/navigation';

/**
 * Fundo das telas de conta. O login usa as ondas que sobem para a direita (conta-ondas-1); nova
 * senha e convite, as que descem pela esquerda (conta-ondas-2). A imagem em si fica no conta.css.
 */
export function FundoConta({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  return (
    <main className="conta-fundo" data-fundo={caminho?.startsWith('/login') ? '1' : '2'}>
      {children}
    </main>
  );
}
