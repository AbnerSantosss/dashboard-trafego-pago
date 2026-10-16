/**
 * Sincronização do gasto do Meta Ads: lê o insights da conta e substitui, na tabela `custos`, as
 * linhas `origem = 'meta'` daquela conta no intervalo pedido. Depois recalcula `metrics_daily`
 * dos mesmos dias, para o investimento do painel refletir o valor novo.
 *
 * Substituir (apagar e inserir) em vez de somar deixa a sincronização idempotente: rodar duas
 * vezes no mesmo dia não duplica gasto, e correções do Meta nos últimos dias entram sozinhas.
 */
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { decifrar } from '../admin/cifra.js';
import { comTenant, custos, metaContas, tenants, type Db } from '../db/client.js';
import { limparCacheMetricas } from '../metricas/cache.js';
import { agregarIncremental, fusoDaEmpresa } from '../rules/agregar.js';
import { ErroMeta, type ClienteMeta } from './meta.js';

/** Dias relidos em cada sincronização automática (o Meta ainda ajusta o gasto dos últimos dias). */
export const DIAS_SINCRONIZACAO = 3;
/** Dias lidos ao conectar uma conta. */
export const DIAS_CONEXAO = 30;
export const DIAS_MAXIMO = 90;

export interface OpcoesSincronizar {
  cliente: ClienteMeta;
  chaveCifra: Buffer;
  /** Quantos dias, terminando hoje (fuso da empresa). */
  dias?: number;
  agora?: () => Date;
}

export type ResultadoSincronizar =
  | { ok: true; de: string; ate: string; linhas: number; total: number }
  | { ok: false; mensagem: string };

/** Data AAAA-MM-DD de `data` no fuso informado. */
export function diaNoFuso(data: Date, fuso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

/** Lista de dias de `de` a `ate`, inclusive. */
export function diasEntre(de: string, ate: string): string[] {
  const lista: string[] = [];
  const d = new Date(`${de}T00:00:00Z`);
  const fim = new Date(`${ate}T00:00:00Z`);
  while (d <= fim && lista.length <= DIAS_MAXIMO) {
    lista.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return lista;
}

function voltarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function sincronizarConta(
  db: Db,
  tenantId: string,
  contaRowId: string,
  opcoes: OpcoesSincronizar,
): Promise<ResultadoSincronizar> {
  const dias = Math.min(Math.max(opcoes.dias ?? DIAS_SINCRONIZACAO, 1), DIAS_MAXIMO);
  const agora = opcoes.agora ?? (() => new Date());

  const contexto = await comTenant(db, tenantId, async (tx) => {
    const [conta] = await tx.select().from(metaContas).where(eq(metaContas.id, contaRowId));
    return conta ? { conta, fuso: await fusoDaEmpresa(tx, tenantId) } : null;
  });
  if (!contexto) return { ok: false, mensagem: 'Conta do Meta não encontrada.' };
  const { conta, fuso } = contexto;

  const registrarErro = async (mensagem: string): Promise<ResultadoSincronizar> => {
    await comTenant(db, tenantId, (tx) =>
      tx
        .update(metaContas)
        .set({ ultimoErro: mensagem, updatedAt: agora() })
        .where(eq(metaContas.id, conta.id)),
    );
    return { ok: false, mensagem };
  };

  const token = decifrar(conta.tokenEnc, opcoes.chaveCifra);
  if (!token) {
    return registrarErro('O token guardado não pôde ser lido. Conecte a conta de novo.');
  }

  const ate = diaNoFuso(agora(), fuso);
  const de = voltarDias(ate, dias - 1);
  let gastos;
  try {
    gastos = await opcoes.cliente.lerGastos(conta.contaId, token, de, ate);
  } catch (e) {
    return registrarErro(e instanceof ErroMeta ? e.message : 'Falha inesperada ao ler o Meta.');
  }

  const total = gastos.reduce((s, g) => s + Math.round(g.valor * 100), 0) / 100;
  await comTenant(db, tenantId, async (tx) => {
    await tx
      .delete(custos)
      .where(
        and(
          eq(custos.metaContaId, conta.id),
          eq(custos.origem, 'meta'),
          gte(custos.dia, de),
          lte(custos.dia, ate),
        ),
      );
    if (gastos.length > 0) {
      await tx.insert(custos).values(
        gastos.map((g) => ({
          tenantId,
          dia: g.dia,
          canal: conta.canal,
          campanha: g.campanha,
          valor: g.valor.toFixed(2),
          origem: 'meta',
          metaContaId: conta.id,
          refExterna: g.campanhaId,
        })),
      );
    }
    const afetados = new Set([...diasEntre(de, ate), ...gastos.map((g) => g.dia)]);
    await agregarIncremental(tx, tenantId, fuso, afetados);
    await tx
      .update(metaContas)
      .set({ ultimaSync: agora(), ultimoErro: null, updatedAt: agora() })
      .where(eq(metaContas.id, conta.id));
  });
  limparCacheMetricas(tenantId);
  return { ok: true, de, ate, linhas: gastos.length, total };
}

export interface Registro {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
}

/** Sincroniza todas as contas ativas de todas as empresas (rodada automática). */
export async function sincronizarTodas(
  db: Db,
  opcoes: OpcoesSincronizar & { log: Registro },
): Promise<void> {
  const empresas = await db.select({ id: tenants.id, slug: tenants.slug }).from(tenants);
  for (const empresa of empresas) {
    const contas = await comTenant(db, empresa.id, (tx) =>
      tx
        .select({ id: metaContas.id, contaId: metaContas.contaId })
        .from(metaContas)
        .where(eq(metaContas.ativo, true))
        .orderBy(asc(metaContas.createdAt)),
    );
    for (const c of contas) {
      const r = await sincronizarConta(db, empresa.id, c.id, opcoes);
      if (r.ok) {
        opcoes.log.info(
          { tenant: empresa.slug, conta: c.contaId, linhas: r.linhas },
          'gasto do Meta sincronizado',
        );
      } else {
        opcoes.log.warn(
          { tenant: empresa.slug, conta: c.contaId, motivo: r.mensagem },
          'falha ao sincronizar o Meta',
        );
      }
    }
  }
}
