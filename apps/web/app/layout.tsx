import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Visão Geral de Aquisição',
  description: 'Acompanhe os resultados do marketing de forma simples e objetiva.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
