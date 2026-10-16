import type { FonteResumo } from '@trafego/contratos';
import { describe, expect, it } from 'vitest';
import {
  formatarQuando,
  montarPassos,
  progresso,
  type Entrega,
  type EntradaInstalacao,
} from '@/lib/instalacao';

const fonte = (extra: Partial<FonteResumo> = {}): FonteResumo => ({
  id: 'f1',
  slug: 'casa',
  nome: 'Plataforma',
  ativo: true,
  caminho: '/webhooks/pasio/casa',
  segredoUtilizavel: true,
  criadoEm: '2026-10-01T12:00:00Z',
  atualizadoEm: null,
  ...extra,
});

const entrega = (extra: Partial<Entrega>): Entrega => ({
  id: 'e',
  eventKey: 'k',
  status: 'processado',
  erro: null,
  tentativas: 1,
  receivedAt: '2026-10-16T12:00:00Z',
  processedAt: '2026-10-16T12:00:01Z',
  ...extra,
});

const vazio: EntradaInstalacao = {
  urlPublica: null,
  nomeExibicao: '',
  fontes: [],
  entregas: [],
  equipe: { membros: 1, convites: 0 },
};

const estados = (e: EntradaInstalacao) =>
  Object.fromEntries(montarPassos(e).map((p) => [p.id, p.estado]));

describe('montarPassos', () => {
  it('instalação zerada: endereço pede ajuste, o resto está por fazer e a tag é manual', () => {
    expect(estados(vazio)).toEqual({
      servidor: 'atencao',
      apresentacao: 'pendente',
      fonte: 'pendente',
      tag: 'manual',
      plataforma: 'pendente',
      regras: 'pendente',
      equipe: 'pendente',
    });
    expect(montarPassos(vazio).map((p) => p.id)).toEqual([
      'servidor',
      'apresentacao',
      'fonte',
      'tag',
      'plataforma',
      'regras',
      'equipe',
    ]);
  });

  it('tudo conectado: só a tag fica para conferir no site', () => {
    const e: EntradaInstalacao = {
      urlPublica: 'https://api.exemplo.com',
      nomeExibicao: 'PASIO',
      fontes: [fonte()],
      entregas: [{ slug: 'casa', nome: 'Plataforma', entregas: [entrega({})] }],
      equipe: { membros: 2, convites: 1 },
    };
    const passos = montarPassos(e, 'UTC');
    expect(passos.filter((p) => p.estado !== 'feito').map((p) => p.id)).toEqual(['tag']);
    expect(progresso(passos)).toEqual({ feitos: 6, total: 7 });
    expect(passos.find((p) => p.id === 'plataforma')?.situacao).toBe(
      'Último evento recebido de Plataforma em 16/10/2026, 12:00.',
    );
    expect(passos.find((p) => p.id === 'equipe')?.situacao).toBe(
      '2 pessoas com acesso e 1 convite pendente.',
    );
  });

  it('fonte ativa sem segredo utilizável pede ajuste; fonte inativa não conta', () => {
    expect(estados({ ...vazio, fontes: [fonte({ segredoUtilizavel: false })] }).fonte).toBe(
      'atencao',
    );
    expect(estados({ ...vazio, fontes: [fonte({ ativo: false })] }).fonte).toBe('pendente');
  });

  it('erro mais novo que o último processado aparece com o motivo', () => {
    const e: EntradaInstalacao = {
      ...vazio,
      fontes: [fonte()],
      entregas: [
        {
          slug: 'casa',
          nome: 'Plataforma',
          entregas: [
            entrega({
              id: 'b',
              status: 'erro',
              erro: 'A fonte não tem versão de regra ativa.',
              receivedAt: '2026-10-16T13:00:00Z',
            }),
            entrega({ id: 'a' }),
          ],
        },
      ],
    };
    const regras = montarPassos(e).find((p) => p.id === 'regras');
    expect(regras?.estado).toBe('atencao');
    expect(regras?.situacao).toContain('A fonte não tem versão de regra ativa.');
  });

  it('erro antigo não derruba o passo se depois disso um evento entrou', () => {
    const e: EntradaInstalacao = {
      ...vazio,
      entregas: [
        {
          slug: 'casa',
          nome: 'Plataforma',
          entregas: [
            entrega({ id: 'b' }),
            entrega({ id: 'a', status: 'erro', erro: 'x', receivedAt: '2026-10-15T12:00:00Z' }),
          ],
        },
      ],
    };
    expect(estados(e).regras).toBe('feito');
  });

  it('o que a página não conseguiu ler vira "não foi possível conferir", nunca "concluído"', () => {
    const passos = montarPassos({
      urlPublica: null,
      nomeExibicao: null,
      fontes: null,
      entregas: null,
      equipe: null,
    });
    for (const id of ['apresentacao', 'fonte', 'plataforma', 'regras', 'equipe']) {
      const p = passos.find((x) => x.id === id);
      expect(p?.estado).toBe('pendente');
      expect(p?.situacao).toBe('Não foi possível conferir agora.');
    }
  });
});

describe('formatarQuando', () => {
  it('formata no fuso pedido e devolve o texto original se a data for inválida', () => {
    expect(formatarQuando('2026-10-16T15:30:00Z', 'America/Sao_Paulo')).toBe('16/10/2026, 12:30');
    expect(formatarQuando('ontem')).toBe('ontem');
  });
});
