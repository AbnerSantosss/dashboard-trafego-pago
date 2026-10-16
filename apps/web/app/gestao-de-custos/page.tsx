import { redirect } from 'next/navigation';

// Gestão de Custos vive em Configurações → Gastos (lançamento manual e leitura do Meta Ads).
export default function GestaoCustos() {
  redirect('/configuracoes/gastos');
}
