/**
 * Peças da leitura por pessoa usadas pela gaveta do funil e pela tela expandida (/leads): ícone do
 * canal, pares chave–valor, estados de carga e a ficha do lead no jeito de um CRM. Sem estado:
 * serve tanto a componentes cliente quanto a páginas do servidor.
 */
import type {
  EventoLead,
  FichaLead,
  TipoEventoLead,
  ToqueLead,
  WebhookLead,
} from '@trafego/contratos';
import type { ReactNode } from 'react';
import { formatarDataHora } from '@/lib/regras';
import { iconeDoCanal } from '@/lib/tela';
import { Icone } from './Nos';
export const NOME_TIPO: Record<TipoEventoLead, string> = {
  clique: 'Clique',
  visita: 'Visita',
  cadastro: 'Cadastro',
  ftd: 'FTD · primeiro depósito',
  deposito: 'Depósito',
  gasto: 'Gasto',
};

export const ORIGEM: Record<EventoLead['origem'], string> = {
  webhook: 'webhook',
  tag: 'tag do site',
  manual: 'lançamento manual',
};

/** Quem a lista mostra em cada etapa (cabeçalho e estado vazio). */
export const COLETIVO: Record<string, string> = {
  base: 'contatos',
  cliques: 'cliques',
  visitas: 'visitas',
  cadastro: 'cadastros',
  ftd: 'FTDs',
  redeposito: 'redepósitos',
  depositos: 'depósitos',
};

/** Nome de cada etapa fora do funil (tela expandida e tabela por canal). */
export const ROTULO_ETAPA: Record<string, string> = {
  base: 'Base contatada',
  cliques: 'Cliques',
  visitas: 'Visitas ao site',
  cadastro: 'Cadastro',
  ftd: 'FTD',
  redeposito: 'Redepósito',
  depositos: 'Depósitos',
};

export interface FiltrosLeads {
  etapa: string;
  de?: string | undefined;
  ate?: string | undefined;
  canal?: string | null | undefined;
  campanha?: string | null | undefined;
  busca?: string | null | undefined;
  ordem?: string | null | undefined;
  offset?: number | null | undefined;
  lead?: string | null | undefined;
}

/** Endereço da tela expandida só com o que difere do padrão (`todos`, `todas`, `recentes`, 0). */
export function urlLeads(f: FiltrosLeads): string {
  const s = new URLSearchParams({ etapa: f.etapa });
  if (f.de) s.set('de', f.de);
  if (f.ate) s.set('ate', f.ate);
  if (f.canal && f.canal !== 'todos') s.set('canal', f.canal);
  if (f.campanha && f.campanha !== 'todas') s.set('campanha', f.campanha);
  if (f.busca?.trim()) s.set('busca', f.busca.trim());
  if (f.ordem && f.ordem !== 'recentes') s.set('ordem', f.ordem);
  if (f.offset && f.offset > 0) s.set('offset', String(f.offset));
  if (f.lead) s.set('lead', f.lead);
  return `/leads?${s.toString()}`;
}

export const ETAPAS_AGREGADAS = new Set(['base', 'cliques']);

export function dinheiro(valor: number, moeda: string | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda || 'BRL' }).format(
    valor,
  );
}

export const inteiro = (n: number) => new Intl.NumberFormat('pt-BR').format(n);

/** Payload do webhook em pares chave–valor (objetos aninhados viram `a.b`, listas `a[0]`). */
export function achatarPayload(valor: unknown, prefixo = '', fundo = 0): [string, string][] {
  if (valor === null || valor === undefined) return prefixo ? [[prefixo, '—']] : [];
  if (Array.isArray(valor)) {
    if (valor.length === 0) return [[prefixo, '[]']];
    return valor.flatMap((v, i) => achatarPayload(v, `${prefixo}[${i}]`, fundo + 1));
  }
  if (typeof valor === 'object') {
    if (fundo >= 4) return [[prefixo, JSON.stringify(valor)]];
    const pares = Object.entries(valor as Record<string, unknown>);
    if (pares.length === 0) return [[prefixo, '{}']];
    return pares.flatMap(([k, v]) => achatarPayload(v, prefixo ? `${prefixo}.${k}` : k, fundo + 1));
  }
  return [[prefixo || 'valor', String(valor)]];
}

export function IconeCanal({ canal, grande }: { canal: string; grande?: boolean }) {
  const { nome, cor } = iconeDoCanal(canal);
  return (
    <span
      className={grande ? 'gf-canal gf-canal-grande' : 'gf-canal'}
      style={{ color: cor, background: `color-mix(in srgb, ${cor} 14%, transparent)` }}
    >
      <Icone nome={nome} className="gf-icone" />
    </span>
  );
}

export function Pares({ itens }: { itens: [string, ReactNode][] }) {
  const visiveis = itens.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (visiveis.length === 0) return <p className="gf-nada">Nada informado.</p>;
  return (
    <dl className="gf-pares">
      {visiveis.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Estado({ carregando, erro }: { carregando: boolean; erro: string | null }) {
  if (erro)
    return (
      <p className="gf-erro" role="alert">
        {erro}
      </p>
    );
  if (carregando)
    return (
      <div className="gf-carregando" role="status">
        <span className="so-leitor">Carregando…</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="gf-esqueleto" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
    );
  return null;
}
// ---------------------------------------------------------------------------
// Ficha do lead

function primeiroToque(f: FichaLead): ToqueLead | null {
  return f.toques.length ? f.toques[f.toques.length - 1]! : null;
}

function Origem({ ficha, fuso }: { ficha: FichaLead; fuso: string }) {
  const toque = primeiroToque(ficha);
  const primeiro = ficha.eventos.length ? ficha.eventos[ficha.eventos.length - 1]! : null;
  const utm = {
    source: toque?.utmSource ?? primeiro?.utmSource ?? null,
    medium: toque?.utmMedium ?? primeiro?.utmMedium ?? null,
    campaign: toque?.utmCampaign ?? primeiro?.utmCampaign ?? null,
  };
  return (
    <Pares
      itens={[
        ['utm_source', utm.source],
        ['utm_medium', utm.medium],
        ['utm_campaign', utm.campaign],
        ['utm_content', toque?.utmContent],
        ['utm_term', toque?.utmTerm],
        ...Object.entries(toque?.clickIds ?? {}).map(
          ([k, v]) => [k, <code key={k}>{v}</code>] as [string, ReactNode],
        ),
        ['Página de entrada', toque?.url ? <span className="gf-url">{toque.url}</span> : null],
        ['Referência', toque?.referrer ?? primeiro?.referrer],
        ['Primeira visita', toque ? formatarDataHora(toque.recebidoEm, fuso) : null],
      ]}
    />
  );
}

function Webhook({ w, fuso }: { w: WebhookLead; fuso: string }) {
  const evento =
    w.payload && typeof w.payload === 'object' && 'event' in w.payload
      ? String((w.payload as { event: unknown }).event)
      : null;
  return (
    <details className="gf-webhook">
      <summary>
        <span className="gf-webhook-titulo">{evento ?? w.eventKey}</span>
        <span className="gf-item-sub">
          {w.fonte} · {formatarDataHora(w.recebidoEm, fuso)}
          {w.status !== 'processado' ? ` · ${w.status}` : ''}
        </span>
      </summary>
      <Pares itens={achatarPayload(w.payload).map(([k, v]) => [k, v] as [string, ReactNode])} />
    </details>
  );
}

export function Ficha({ ficha, fuso }: { ficha: FichaLead; fuso: string }) {
  const canal = ficha.canalOrigem ?? 'Outros';
  const campanha = ficha.eventos.find((e) => e.campanha)?.campanha;
  const moeda = ficha.eventos.find((e) => e.moeda)?.moeda ?? 'BRL';
  return (
    <>
      <div className="gf-origem">
        <IconeCanal canal={canal} grande />
        <div>
          <p className="gf-origem-rotulo">Veio de</p>
          <p className="gf-origem-canal">
            {canal}
            {campanha ? <span className="gf-item-sub"> · {campanha}</span> : null}
          </p>
        </div>
      </div>

      <dl className="gf-resumo">
        <div>
          <dt>Cadastro</dt>
          <dd>{ficha.cadastroEm ? formatarDataHora(ficha.cadastroEm, fuso) : '—'}</dd>
        </div>
        <div>
          <dt>FTD</dt>
          <dd>
            {ficha.ftd ? (
              <>
                <strong>{dinheiro(ficha.ftd.valor, moeda)}</strong>
                <span className="gf-item-sub">{formatarDataHora(ficha.ftd.em, fuso)}</span>
              </>
            ) : (
              'Ainda não'
            )}
          </dd>
        </div>
        <div>
          <dt>Depósitos (com o FTD)</dt>
          <dd>
            <strong>{inteiro(ficha.depositos.quantidade)}</strong>
            {ficha.depositos.quantidade > 0 && (
              <span className="gf-item-sub">{dinheiro(ficha.depositos.total, moeda)}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Último evento</dt>
          <dd>{ficha.ultimoEvento ? formatarDataHora(ficha.ultimoEvento, fuso) : '—'}</dd>
        </div>
      </dl>

      <section className="gf-secao" aria-labelledby="gf-sec-origem">
        <h3 id="gf-sec-origem">
          <Icone nome="link" className="gf-secao-icone" /> Origem
        </h3>
        <Origem ficha={ficha} fuso={fuso} />
      </section>

      <section className="gf-secao" aria-labelledby="gf-sec-tempo">
        <h3 id="gf-sec-tempo">Linha do tempo</h3>
        <ol className="gf-tempo">
          {ficha.eventos.map((e) => (
            <li key={e.id} data-tipo={e.tipo}>
              <span className="gf-tempo-ponto" aria-hidden="true" />
              <span className="gf-item-meio">
                <span className="gf-item-titulo">
                  {NOME_TIPO[e.tipo]}
                  {e.valor !== null && e.tipo !== 'gasto' ? ` · ${dinheiro(e.valor, e.moeda)}` : ''}
                </span>
                <span className="gf-item-sub">
                  {formatarDataHora(e.ocorridoEm, fuso)} · via {ORIGEM[e.origem]}
                  {e.pagina ? ` · ${e.pagina}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="gf-secao" aria-labelledby="gf-sec-webhook">
        <h3 id="gf-sec-webhook">
          <Icone nome="webhook" className="gf-secao-icone" /> Dados do webhook
        </h3>
        {ficha.webhooks.length === 0 ? (
          <p className="gf-nada">Nenhum webhook ligado a este usuário.</p>
        ) : (
          ficha.webhooks.map((w) => <Webhook key={w.id} w={w} fuso={fuso} />)
        )}
        <p className="gf-rodape">Senhas, tokens e dados de cartão aparecem mascarados.</p>
      </section>
    </>
  );
}
