import { EmConstrucao } from '@/componentes/EmConstrucao';

// Lê logo e nome exibido da empresa a cada requisição (Configurações → Apresentação).
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Relatórios' };

export default function Relatorios() {
  return <EmConstrucao ativo="relatorios" titulo="Relatórios" />;
}
