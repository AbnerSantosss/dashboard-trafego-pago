/**
 * Agregação diária no banco: recalcula `metrics_daily` a partir de `events` para os dias
 * afetados (chave dia no fuso da empresa × canal × campanha × página).
 *
 * Estratégia: apaga e reinsere as linhas dos dias afetados, em SQL (group by), dentro da
 * transação com RLS. Canais reservados (`__funil__` etc.) não são tocados nem gerados.
 * Mesma semântica de `agregarEventos` de `@trafego/rules`: depósitos incluem FTDs,
 * investimento nulo quando não há evento `gasto`.
 *
 * Cliques com `base = true` contam em `base_contatada`, não em `cliques`.
 */
import { localParaUtc } from '@trafego/rules';
import { eq, sql } from 'drizzle-orm';
import { comTenant, tenants, type Db, type Tx } from '../db/client.js';

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Fuso da empresa (tabela global `tenants`, sem RLS). */
export async function fusoDaEmpresa(tx: Tx | Db, tenantId: string): Promise<string> {
  const [t] = await tx.select({ fuso: tenants.fuso }).from(tenants).where(eq(tenants.id, tenantId));
  return t?.fuso ?? 'America/Sao_Paulo';
}

/** Início do dia `dia` no fuso, em UTC. */
function inicioDoDia(dia: string, fuso: string): Date {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return localParaUtc(a, m, d, 0, 0, 0, fuso);
}

function diaSeguinte(dia: string): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Recalcula os dias informados dentro de uma transação já aberta com `comTenant`.
 * Usado por `processar` (incremental) e pelo reprocessamento em lote.
 */
export async function agregarIncremental(
  tx: Tx,
  tenantId: string,
  fuso: string,
  dias: Iterable<string>,
): Promise<void> {
  const lista = [...new Set(dias)].filter((d) => DIA.test(d)).sort();
  if (lista.length === 0) return;
  const listaSql = sql.join(
    lista.map((d) => sql`${d}::date`),
    sql`, `,
  );
  // Faixa em UTC para aproveitar o índice (tenant_id, occurred_at); o filtro exato é pelo dia local.
  const de = inicioDoDia(lista[0]!, fuso).toISOString();
  const ate = inicioDoDia(diaSeguinte(lista[lista.length - 1]!), fuso).toISOString();
  const diaLocal = sql`(e.occurred_at at time zone ${fuso})::date`;

  await tx.execute(sql`
    delete from metrics_daily
    where tenant_id = ${tenantId}
      and day in (${listaSql})
      and left(channel, 2) <> '__'
  `);
  await tx.execute(sql`
    insert into metrics_daily
      (tenant_id, day, channel, campaign, page, investimento, cliques, visitas, cadastros,
       ftds, ftds_valor, depositos, base_contatada)
    select
      e.tenant_id,
      ${diaLocal},
      e.channel,
      coalesce(e.campaign, ''),
      coalesce(e.page, ''),
      case when count(*) filter (where e.type = 'gasto') > 0
        then coalesce(sum(e.value) filter (where e.type = 'gasto'), 0) end,
      count(*) filter (where e.type = 'clique' and not e.base),
      count(*) filter (where e.type = 'visita'),
      count(*) filter (where e.type = 'cadastro'),
      count(*) filter (where e.type = 'ftd'),
      coalesce(sum(e.value) filter (where e.type = 'ftd'), 0),
      coalesce(sum(e.value) filter (where e.type in ('deposito', 'ftd')), 0),
      count(*) filter (where e.type = 'clique' and e.base)
    from events e
    where e.tenant_id = ${tenantId}
      and e.occurred_at >= ${de}::timestamptz
      and e.occurred_at < ${ate}::timestamptz
      and ${diaLocal} in (${listaSql})
      and left(e.channel, 2) <> '__'
    group by 1, 2, 3, 4, 5
  `);
}

/** Recalcula `metrics_daily` dos dias (AAAA-MM-DD, fuso da empresa) a partir de `events`. */
export async function reagregarDias(db: Db, tenantId: string, dias: string[]): Promise<void> {
  await comTenant(db, tenantId, async (tx) => {
    const fuso = await fusoDaEmpresa(tx, tenantId);
    await agregarIncremental(tx, tenantId, fuso, dias);
  });
}
