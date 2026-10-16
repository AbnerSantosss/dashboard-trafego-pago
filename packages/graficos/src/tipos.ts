/** Contrato dos componentes de gráfico (fixado pelo orquestrador; implementação em P4.3/P4.4). */

export interface EtapaFunilProps {
  id: string;
  rotulo: string;
  /** Texto já formatado (ex.: "320.840"). */
  valorFormatado: string;
  /** Texto já formatado da taxa (ex.: "12,5%"). */
  taxaFormatada: string;
  /** Legenda sob a taxa ("de conversão" / "base de referência"). */
  legenda: string;
  /** Valor numérico, usado só para animação do contador. */
  valor: number;
}

export interface FunilProps {
  etapas: EtapaFunilProps[];
  /** Largura total em px (padrão: 100% do contêiner). */
  largura?: number;
  /** Desliga animações (também respeitado automaticamente com prefers-reduced-motion). */
  semAnimacao?: boolean;
  /** Atraso da entrada (barras em sequência) em ms, para começar depois do card. */
  atrasoMs?: number;
  /**
   * Torna cada etapa um botão (clique, Enter ou Espaço) que chama esta função com o id da etapa.
   * Sem ela, o funil é só imagem (`role="img"`).
   */
  onEtapa?: (id: string) => void;
  /** Etapa aberta no momento: fica acesa como no hover. */
  etapaAtiva?: string | null;
  className?: string;
}

export interface SparklineProps {
  /** Pontos em ordem cronológica; vazio renderiza um traço plano. */
  pontos: number[];
  largura: number;
  altura: number;
  /** Cor da linha (hex ou var CSS). */
  cor: string;
  semAnimacao?: boolean;
  className?: string;
}

export interface ContadorProps {
  /** Valor final. */
  valor: number;
  /** Formata o valor intermediário e final (ex.: formatarMoeda). */
  formatar: (n: number) => string;
  /** Duração em ms (padrão 800). */
  duracaoMs?: number;
  /** Atraso em ms (entrada em cascata). */
  atrasoMs?: number;
  /**
   * Seletor do ancestral cuja animação CSS de entrada comanda a contagem da montagem: conta junto com
   * ela (o atraso vem dela) e, se ela já terminou quando o JS chega, mostra direto o valor final.
   */
  sincronizarCom?: string;
  semAnimacao?: boolean;
  className?: string;
}
