/**
 * Diferente do layout, o template remonta a cada troca de aba: a cena nova entra com a animação
 * de .cfg-cena (doutrina Hyperframes, D29/D33) enquanto a sidebar, o título e as abas ficam parados.
 */
export default function TemplateConfiguracoes({ children }: { children: React.ReactNode }) {
  return <div className="cfg-cena">{children}</div>;
}
