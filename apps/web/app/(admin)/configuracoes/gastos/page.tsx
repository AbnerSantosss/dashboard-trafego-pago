import Link from 'next/link';
import { api } from '@/lib/api';
import { formatarDia, formatarReais, mensagemErroApi } from '../validacao';
import { Tutorial } from '../Tutorial';
import { PainelGastos } from './PainelGastos';

export const dynamic = 'force-dynamic';

const TITULO = <h2 className="cfg-subtitulo cfg-sem-margem">Gastos em anúncios</h2>;
const PERIODOS = [30, 90, 365] as const;

/** Hoje no fuso da empresa (São Paulo), em AAAA-MM-DD. */
function hoje(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function voltarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function Gastos({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const pedido = Number((await searchParams).dias);
  const dias = (PERIODOS as readonly number[]).includes(pedido) ? pedido : 30;
  const ate = hoje();
  const r = await api().custos(voltarDias(ate, dias - 1), ate);
  if (!r.ok) {
    return (
      <>
        {TITULO}
        <p className="cfg-faixa-erro" role="alert">
          Não foi possível carregar os gastos agora.{' '}
          {r.status === 403
            ? 'Lançar e ver gastos exige o papel analista ou administrador.'
            : mensagemErroApi(r)}
        </p>
      </>
    );
  }
  const { custos, total, porCanal } = r.dados;
  return (
    <>
      {TITULO}
      <section className="cg-explica" aria-labelledby="cg-explica-t">
        <div className="cg-explica-topo">
          <div>
            <h3 id="cg-explica-t" className="cg-explica-titulo">
              Como o gasto vira Investimento
            </h3>
            <p className="cfg-dica">
              O painel não sabe sozinho quanto foi gasto em anúncios: ele lê o Meta Ads e soma o que
              for lançado aqui.
            </p>
          </div>
          <Tutorial id="gastos" />
        </div>
        <ol className="cg-pontos">
          <li>
            <strong>De onde vem</strong>
            <span>
              O Meta Ads entra sozinho, de hora em hora. Google, TikTok, afiliados e os outros
              canais você lança no formulário abaixo.
            </span>
          </li>
          <li>
            <strong>Onde aparece</strong>
            <span>
              A soma do período vira o card <strong>Investimento</strong> e a coluna Investimento da
              tabela por canal, no dia e no canal informados.
            </span>
          </li>
          <li>
            <strong>O que muda junto</strong>
            <span>
              CPA (Investimento ÷ FTDs) e ROAS (Depósitos ÷ Investimento). Gasto esquecido deixa o
              CPA baixo demais e o ROAS alto demais.
            </span>
          </li>
        </ol>
      </section>
      <nav className="cfg-periodos" aria-label="Período">
        {PERIODOS.map((p) => (
          <Link
            key={p}
            href={`/configuracoes/gastos?dias=${p}`}
            className="cfg-periodo"
            aria-current={p === dias ? 'page' : undefined}
          >
            {p === 365 ? '12 meses' : `${p} dias`}
          </Link>
        ))}
      </nav>
      <p className="cfg-total">
        <span>
          {formatarDia(r.dados.de)} a {formatarDia(r.dados.ate)}
        </span>
        <strong>{formatarReais(total)}</strong>
        {porCanal.length > 0 && (
          <span className="cfg-dica">
            {porCanal.map((p) => `${p.canal} ${formatarReais(p.total)}`).join(' · ')}
          </span>
        )}
      </p>
      <PainelGastos custos={custos} hoje={ate} />
    </>
  );
}
