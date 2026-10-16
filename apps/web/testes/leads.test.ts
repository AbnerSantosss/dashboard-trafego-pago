import { describe, expect, it } from 'vitest';
import { consultaLeads, lerFiltrosLeads, mensagemLeads, POR_PAGINA } from '@/lib/leads';

describe('filtros da tela de leads', () => {
  it('sem parâmetros abre em FTD, sem filtros, na primeira página', () => {
    expect(lerFiltrosLeads({})).toEqual({
      etapa: 'ftd',
      canal: null,
      campanha: null,
      busca: '',
      ordem: 'recentes',
      offset: 0,
      lead: null,
    });
  });
  it('descarta o que não valida e troca datas invertidas', () => {
    const f = lerFiltrosLeads({
      etapa: 'xpto',
      de: '2024-05-24',
      ate: '2024-05-01',
      canal: 'todos',
      campanha: 'todas',
      ordem: 'aleatoria',
      offset: '73',
    });
    expect(f.etapa).toBe('ftd');
    expect([f.de, f.ate]).toEqual(['2024-05-01', '2024-05-24']);
    expect(f.canal).toBeNull();
    expect(f.campanha).toBeNull();
    expect(f.ordem).toBe('recentes');
    expect(f.offset).toBe(50);
    expect(lerFiltrosLeads({ de: '2024-02-30' }).de).toBeUndefined();
    expect(lerFiltrosLeads({ offset: '-10' }).offset).toBe(0);
  });
  it('a consulta só leva o que foi filtrado', () => {
    const f = lerFiltrosLeads({ etapa: 'cadastro', canal: 'Meta', busca: 'demo', offset: '100' });
    expect(consultaLeads(f)).toEqual({
      etapa: 'cadastro',
      canal: 'Meta',
      busca: 'demo',
      offset: 100,
      limite: POR_PAGINA,
    });
  });
  it('mensagens de recusa e falha', () => {
    expect(mensagemLeads({ ok: false, status: 403, codigo: 'x', mensagem: '' }, 'a lista')).toMatch(
      /analistas/,
    );
    expect(mensagemLeads({ ok: false, status: 404, codigo: 'x', mensagem: '' }, 'a ficha')).toMatch(
      /Não há mais registros/,
    );
    expect(
      mensagemLeads({ ok: false, status: 500, codigo: 'x', mensagem: 'Falhou.' }, 'a lista'),
    ).toBe('Não foi possível carregar a lista agora. Falhou.');
  });
});
