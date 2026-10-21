/**
 * Bloqueio por conta contra força bruta de senha. O limite por IP (conta/rotas.ts) não segura
 * quem troca de IP; este conta as falhas por e-mail (ou usuário) e trava a chave por um tempo.
 * Vale também para e-mail que não existe, para o bloqueio não revelar quem tem conta.
 * Fica em memória: zera no redeploy e serve para uma réplica só (a produção tem uma).
 */

export interface OpcoesTentativas {
  /** Falhas dentro da janela que disparam o bloqueio (default 5). */
  maxFalhas?: number;
  /** Janela de contagem e duração do bloqueio, em ms (default 15 min). */
  janelaMs?: number;
  /** Teto de chaves guardadas; acima dele as vencidas são descartadas (default 10 000). */
  maxChaves?: number;
  agora?: () => number;
}

interface Registro {
  falhas: number;
  desde: number;
  bloqueadoAte: number;
}

export interface Tentativas {
  /** Milissegundos que faltam de bloqueio; 0 se a chave está livre. */
  bloqueio(chave: string): number;
  falhou(chave: string): void;
  acertou(chave: string): void;
}

export function criarTentativas(opcoes: OpcoesTentativas = {}): Tentativas {
  const maxFalhas = opcoes.maxFalhas ?? 5;
  const janelaMs = opcoes.janelaMs ?? 15 * 60_000;
  const maxChaves = opcoes.maxChaves ?? 10_000;
  const agora = opcoes.agora ?? Date.now;
  const registros = new Map<string, Registro>();

  function limpar(t: number): void {
    for (const [chave, r] of registros) {
      if (r.bloqueadoAte <= t && t - r.desde > janelaMs) registros.delete(chave);
    }
  }

  return {
    bloqueio(chave) {
      const r = registros.get(chave);
      return r ? Math.max(0, r.bloqueadoAte - agora()) : 0;
    },
    falhou(chave) {
      const t = agora();
      if (registros.size >= maxChaves) limpar(t);
      let r = registros.get(chave);
      if (!r || t - r.desde > janelaMs) {
        r = { falhas: 0, desde: t, bloqueadoAte: 0 };
        registros.set(chave, r);
      }
      r.falhas += 1;
      if (r.falhas >= maxFalhas) {
        r.bloqueadoAte = t + janelaMs;
        // A próxima janela começa quando o bloqueio acaba.
        r.falhas = 0;
        r.desde = r.bloqueadoAte;
      }
    },
    acertou(chave) {
      registros.delete(chave);
    },
  };
}

/** Chave por e-mail normalizado, a mesma no login, no aceite de convite e na troca de senha. */
export const chaveConta = (email: string) => email.trim().toLowerCase();
