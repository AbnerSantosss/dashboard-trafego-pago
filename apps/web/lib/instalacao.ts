/**
 * Estado dos passos da aba Configurações → Instalação. Função pura (sem React nem Next): recebe o
 * que a página conseguiu ler da API e devolve cada passo com o estado. Testada em
 * `testes/instalacao.test.ts`.
 */
import type { FonteResumo } from '@trafego/contratos';

/** `GET /webhooks/:empresa/:fonte/entregas` (apps/api/src/rotas/webhooks.ts). */
export interface Entrega {
  id: string;
  eventKey: string;
  status: 'recebido' | 'processado' | 'erro';
  erro: string | null;
  tentativas: number;
  receivedAt: string;
  processedAt: string | null;
}

/** `feito` e `pendente` vêm de dados; `atencao` pede ação; `manual` não dá para conferir daqui. */
export type EstadoPasso = 'feito' | 'pendente' | 'atencao' | 'manual';

export type IdPasso =
  'servidor' | 'apresentacao' | 'fonte' | 'tag' | 'plataforma' | 'regras' | 'equipe';

export interface Passo {
  id: IdPasso;
  titulo: string;
  estado: EstadoPasso;
  /** Uma frase sobre o estado atual, com dados reais quando houver. */
  situacao: string;
}

/** `null` em qualquer campo = a página não conseguiu ler aquilo (API fora, sem permissão). */
export interface EntradaInstalacao {
  urlPublica: string | null;
  nomeExibicao: string | null;
  fontes: FonteResumo[] | null;
  /** Últimas entregas de cada fonte ativa, mais recentes primeiro. */
  entregas: { slug: string; nome: string; entregas: Entrega[] }[] | null;
  equipe: { membros: number; convites: number } | null;
}

const SEM_LEITURA = 'Não foi possível conferir agora.';

export function formatarQuando(iso: string, fuso = 'America/Sao_Paulo'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: fuso,
  }).format(d);
}

function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
}

export function montarPassos(e: EntradaInstalacao, fuso?: string): Passo[] {
  const ativas = e.fontes?.filter((f) => f.ativo) ?? [];
  const prontas = ativas.filter((f) => f.segredoUtilizavel);
  const todas = (e.entregas ?? []).flatMap((x) =>
    x.entregas.map((en) => ({ ...en, fonte: x.nome })),
  );
  todas.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const ultima = todas[0];
  const processadas = todas.filter((x) => x.status === 'processado');
  const ultimaComErro = todas.find((x) => x.status === 'erro');

  const servidor: Passo = e.urlPublica
    ? { id: 'servidor', titulo: 'Endereço público da API', estado: 'feito', situacao: e.urlPublica }
    : {
        id: 'servidor',
        titulo: 'Endereço público da API',
        estado: 'atencao',
        situacao:
          'Ainda sem endereço público: o site e a plataforma não conseguem enviar dados para cá.',
      };

  const apresentacao: Passo = {
    id: 'apresentacao',
    titulo: 'Nome e logo da empresa',
    estado: e.nomeExibicao === null ? 'pendente' : e.nomeExibicao.trim() ? 'feito' : 'pendente',
    situacao:
      e.nomeExibicao === null
        ? SEM_LEITURA
        : e.nomeExibicao.trim()
          ? `O painel aparece como “${e.nomeExibicao}”.`
          : 'Defina o nome que aparece no menu.',
  };

  let fonte: Passo;
  if (e.fontes === null) {
    fonte = { id: 'fonte', titulo: 'Fonte de webhook', estado: 'pendente', situacao: SEM_LEITURA };
  } else if (prontas.length > 0) {
    fonte = {
      id: 'fonte',
      titulo: 'Fonte de webhook',
      estado: 'feito',
      situacao: `${plural(prontas.length, 'fonte pronta', 'fontes prontas')} para receber: ${prontas
        .map((f) => f.nome)
        .join(', ')}.`,
    };
  } else if (ativas.length > 0) {
    fonte = {
      id: 'fonte',
      titulo: 'Fonte de webhook',
      estado: 'atencao',
      situacao: 'A fonte existe, mas o servidor não tem o segredo dela. Gere um segredo novo.',
    };
  } else {
    fonte = {
      id: 'fonte',
      titulo: 'Fonte de webhook',
      estado: 'pendente',
      situacao: 'Nenhuma fonte ativa ainda.',
    };
  }

  const tag: Passo = {
    id: 'tag',
    titulo: 'Tag no Google Tag Manager',
    estado: 'manual',
    situacao: 'Confira no próprio site, com o teste descrito abaixo.',
  };

  let plataforma: Passo;
  if (e.entregas === null) {
    plataforma = {
      id: 'plataforma',
      titulo: 'Plataforma enviando eventos',
      estado: 'pendente',
      situacao: SEM_LEITURA,
    };
  } else if (ultima) {
    plataforma = {
      id: 'plataforma',
      titulo: 'Plataforma enviando eventos',
      estado: 'feito',
      situacao: `Último evento recebido de ${ultima.fonte} em ${formatarQuando(ultima.receivedAt, fuso)}.`,
    };
  } else {
    plataforma = {
      id: 'plataforma',
      titulo: 'Plataforma enviando eventos',
      estado: 'pendente',
      situacao: 'Nenhum evento recebido ainda.',
    };
  }

  let regras: Passo;
  if (e.entregas === null) {
    regras = {
      id: 'regras',
      titulo: 'Tradução dos eventos',
      estado: 'pendente',
      situacao: SEM_LEITURA,
    };
  } else if (
    ultimaComErro &&
    (!processadas[0] || ultimaComErro.receivedAt > processadas[0].receivedAt)
  ) {
    regras = {
      id: 'regras',
      titulo: 'Tradução dos eventos',
      estado: 'atencao',
      situacao: `O último evento de ${ultimaComErro.fonte} não entrou no painel: ${ultimaComErro.erro ?? 'erro sem motivo registrado'}.`,
    };
  } else if (processadas.length > 0) {
    regras = {
      id: 'regras',
      titulo: 'Tradução dos eventos',
      estado: 'feito',
      situacao: `${plural(processadas.length, 'evento recente entrou', 'eventos recentes entraram')} no painel.`,
    };
  } else {
    regras = {
      id: 'regras',
      titulo: 'Tradução dos eventos',
      estado: 'pendente',
      situacao: ultima
        ? 'Eventos recebidos, aguardando processamento.'
        : 'Depende do primeiro evento recebido.',
    };
  }

  const equipe: Passo =
    e.equipe === null
      ? { id: 'equipe', titulo: 'Equipe com acesso', estado: 'pendente', situacao: SEM_LEITURA }
      : e.equipe.membros > 1 || e.equipe.convites > 0
        ? {
            id: 'equipe',
            titulo: 'Equipe com acesso',
            estado: 'feito',
            situacao: `${plural(e.equipe.membros, 'pessoa', 'pessoas')} com acesso${
              e.equipe.convites > 0
                ? ` e ${plural(e.equipe.convites, 'convite pendente', 'convites pendentes')}`
                : ''
            }.`,
          }
        : {
            id: 'equipe',
            titulo: 'Equipe com acesso',
            estado: 'pendente',
            situacao: 'Só você tem acesso por enquanto.',
          };

  return [servidor, apresentacao, fonte, tag, plataforma, regras, equipe];
}

/** Passos concluídos sobre o total (o passo manual conta como não verificado). */
export function progresso(passos: Passo[]): { feitos: number; total: number } {
  return { feitos: passos.filter((p) => p.estado === 'feito').length, total: passos.length };
}
