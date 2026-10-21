/**
 * Invariante "um FTD por jogador" (D46): o FTD de um lead é o depósito mais antigo dele, e todo
 * outro depósito é `deposito` (redepósito). É o que calcula o redepósito do nosso lado quando a
 * plataforma não diz qual é o primeiro (GTech sem `approved_deposits`, reenvio, chegada fora de
 * ordem). Roda em `processarLote`, antes do insert, sobre os eventos novos do lote e os já
 * gravados dos mesmos leads:
 *
 * - o depósito mais antigo do lead (empate: `ftd` antes de `deposito`, gravado antes de novo)
 *   continua `ftd` se já for. Um `deposito` nunca vira `ftd`: a regra já disse que não é o primeiro;
 * - todo outro `ftd`, novo ou gravado, vira `deposito`. Os gravados mudam por UPDATE, e o dia
 *   deles entra em `dias` para a agregação refazer.
 *
 * Concorrência: trava consultiva por lead (`pg_advisory_xact_lock`), sempre na mesma ordem, então
 * dois webhooks do mesmo jogador processados ao mesmo tempo não viram dois FTDs.
 *
 * Limite: não promove de volta. Se o FTD sumir (bruto apagado), o depósito seguinte continua
 * `deposito` até reprocessar a fonte.
 */
import { diaNoFuso } from '@trafego/rules';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { events, type NovoEvento, type Tx } from '../db/client.js';

interface Deposito {
  quando: Date;
  ftd: boolean;
  /** Já estava em `events` (id) ou é linha nova do lote. */
  id?: string;
  linha?: NovoEvento;
}

const ehDeposito = (tipo: string) => tipo === 'ftd' || tipo === 'deposito';

/** Ordem do histórico do jogador: mais antigo, `ftd` antes de `deposito`, gravado antes de novo. */
function antes(a: Deposito, b: Deposito): number {
  return (
    a.quando.getTime() - b.quando.getTime() ||
    Number(b.ftd) - Number(a.ftd) ||
    Number(!a.id) - Number(!b.id)
  );
}

/**
 * Ajusta `linhas` no lugar (FTDs a mais viram `deposito`) e rebaixa os FTDs gravados que deixaram
 * de ser o primeiro. Devolve quantos eventos viraram `deposito`.
 */
export async function garantirUmFtdPorLead(
  tx: Tx,
  tenantId: string,
  linhas: NovoEvento[],
  fuso: string,
  dias: Set<string>,
): Promise<number> {
  const novos = linhas.filter((l) => l.leadKey && ehDeposito(l.type));
  if (novos.length === 0) return 0;
  const leads = [...new Set(novos.map((l) => l.leadKey!))].sort();

  // Uma trava por jogador, em ordem alfabética em todas as transações (sem deadlock).
  const chaves = leads.map((l) => sql`(${`${tenantId}:${l}`}::text)`);
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(v.k, 0)) from (values ${sql.join(chaves, sql`, `)}) as v(k)`,
  );

  const gravados = await tx
    .select({
      id: events.id,
      type: events.type,
      occurredAt: events.occurredAt,
      leadKey: events.leadKey,
    })
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenantId),
        inArray(events.leadKey, leads),
        inArray(events.type, ['ftd', 'deposito']),
      ),
    );

  const porLead = new Map<string, Deposito[]>();
  const historico = (lead: string) => {
    let h = porLead.get(lead);
    if (!h) porLead.set(lead, (h = []));
    return h;
  };
  for (const g of gravados) {
    historico(g.leadKey!).push({ quando: g.occurredAt, ftd: g.type === 'ftd', id: g.id });
  }
  for (const l of novos) {
    historico(l.leadKey!).push({ quando: l.occurredAt, ftd: l.type === 'ftd', linha: l });
  }

  const rebaixar: string[] = [];
  let rebaixados = 0;
  for (const h of porLead.values()) {
    h.sort(antes);
    for (const d of h.slice(1)) {
      if (!d.ftd) continue;
      rebaixados++;
      dias.add(diaNoFuso(d.quando, fuso));
      if (d.linha) d.linha.type = 'deposito';
      else rebaixar.push(d.id!);
    }
  }
  if (rebaixar.length > 0) {
    await tx
      .update(events)
      .set({ type: 'deposito' })
      .where(and(eq(events.tenantId, tenantId), inArray(events.id, rebaixar)));
  }
  return rebaixados;
}
