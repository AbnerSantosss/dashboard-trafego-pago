import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Icone } from '@/componentes/Nos';
import { api, lerConfig } from '@/lib/api';
import {
  montarPassos,
  progresso,
  type EstadoPasso,
  type IdPasso,
  type Passo,
} from '@/lib/instalacao';
import { lerSessaoDoCookie } from '@/lib/sessao';
import { urlColeta } from '@/lib/tag-gtm';
import { urlWebhook } from '../validacao';
import { Tutorial } from '../Tutorial';
import { Copiavel } from './Copiavel';

export const dynamic = 'force-dynamic';

const ROTULO_ESTADO: Record<EstadoPasso, string> = {
  feito: 'Concluído',
  pendente: 'A fazer',
  atencao: 'Precisa de ajuste',
  manual: 'Confira no site',
};
const ICONE_ESTADO: Record<EstadoPasso, string> = {
  feito: 'feito',
  pendente: 'pendente',
  atencao: 'atencao',
  manual: 'pendente',
};

const EXEMPLO_ASSINATURA = `import { createHmac, randomUUID } from 'node:crypto';

const corpo = JSON.stringify(evento);            // o JSON exato que vai no POST
const ts = Math.floor(Date.now() / 1000).toString();
const assinatura = createHmac('sha256', process.env.SEGREDO_DA_FONTE)
  .update(\`\${ts}.\${corpo}\`)
  .digest('hex');

await fetch(ENDERECO_DA_FONTE, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Timestamp': ts,
    'X-Signature': assinatura,
    'X-Event-Id': evento.id ?? randomUUID(), // repetir o id = não conta duas vezes
  },
  body: corpo,
});`;

const EXEMPLO_BASIC = `curl -X POST "$ENDERECO_DA_FONTE" \\
  -u "slug-da-fonte:$SEGREDO_DA_FONTE" \\
  -H "Content-Type: application/json" \\
  -d @evento.json`;

const EXEMPLO_EVENTO = `{
  "id": "dep-918273",
  "event": "first_deposit",
  "created_at": "2026-10-16T14:32:00-03:00",
  "amount": 15000,
  "user": { "id": "u-48151623" },
  "utm": { "source": "facebook", "medium": "cpc", "campaign": "lancamento-outubro" }
}`;

export default async function Instalacao() {
  const config = lerConfig();
  const empresa = (await lerSessaoDoCookie()).empresa ?? config.empresa;
  const origemPublica = process.env.WEBHOOK_URL_PUBLICA?.trim() || null;

  const [rApresentacao, rFontes, rUsuarios] = await Promise.all([
    api().apresentacao(),
    api().fontes(),
    api().usuarios(),
  ]);
  const fontes = rFontes.ok ? rFontes.dados.fontes : null;
  const ativas = fontes?.filter((f) => f.ativo) ?? [];
  const leituras = await Promise.all(
    ativas.map(async (f) => ({ f, r: await api().entregas(empresa, f.slug) })),
  );
  const entregas = leituras.every((x) => x.r.ok)
    ? leituras.map(({ f, r }) => ({
        slug: f.slug,
        nome: f.nome,
        entregas: r.ok ? r.dados.entregas : [],
      }))
    : null;

  const passos = montarPassos({
    urlPublica: origemPublica,
    nomeExibicao: rApresentacao.ok ? rApresentacao.dados.nomeExibicao : null,
    fontes,
    entregas,
    equipe: rUsuarios.ok
      ? { membros: rUsuarios.dados.membros.length, convites: rUsuarios.dados.convites.length }
      : null,
  });
  const { feitos, total } = progresso(passos);
  const tudoPronto = passos.every((p) => p.estado === 'feito' || p.estado === 'manual');
  const coleta = urlColeta(origemPublica ?? config.apiUrl, empresa);

  const corpo: Record<IdPasso, ReactNode> = {
    servidor: (
      <>
        <p>
          O site (pela tag) e a plataforma (pelos webhooks) precisam alcançar a API por um endereço{' '}
          <strong>https</strong> público. Isso é feito uma vez, por quem cuida do servidor.
        </p>
        <ul className="inst-lista">
          <li>
            No servidor do painel, defina <code>WEBHOOK_URL_PUBLICA</code> com a origem pública da
            API, por exemplo <code>https://api.suaempresa.com.br</code>.
          </li>
          <li>
            No servidor da API, defina <code>WEBHOOK_CHAVE_CIFRA</code> (32 bytes em base64). Sem
            ela, a API não guarda o segredo das fontes e recusa os eventos.
          </li>
          <li>Reinicie os dois serviços e volte a esta aba.</li>
        </ul>
      </>
    ),
    apresentacao: (
      <p>
        Escolha o nome e o logo que aparecem no menu lateral. Dá para trocar depois sem afetar os
        dados.{' '}
        <Link className="inst-link" href="/configuracoes/apresentacao">
          Abrir Apresentação
          <Icone nome="abrir-aba" className="inst-link-ic" />
        </Link>
      </p>
    ),
    fonte: (
      <>
        <p>
          Cada sistema que manda eventos (a plataforma da casa, um parceiro) é uma fonte, com
          endereço e segredo próprios. Crie a fonte e{' '}
          <strong>copie o segredo na hora: ele só aparece uma vez</strong>.{' '}
          <Link className="inst-link" href="/configuracoes/webhooks">
            Abrir Webhooks
            <Icone nome="abrir-aba" className="inst-link-ic" />
          </Link>
        </p>
        {ativas.length > 0 && (
          <div className="inst-fontes">
            {ativas.map((f) => (
              <div key={f.id} className="inst-fonte">
                <span className="inst-fonte-nome">{f.nome}</span>
                <Copiavel
                  valor={urlWebhook(f.caminho, origemPublica ?? undefined)}
                  rotulo={`Endereço da fonte ${f.nome}`}
                />
              </div>
            ))}
          </div>
        )}
      </>
    ),
    tag: (
      <>
        <p>
          A tag guarda de onde a pessoa veio (UTMs e identificadores de clique) e liga essa origem
          ao <code>user_id</code> do site. É o que permite atribuir cadastro, FTD e depósito à
          campanha certa.{' '}
          <Link className="inst-link" href="/configuracoes/tag">
            Abrir Tag GTM
            <Icone nome="abrir-aba" className="inst-link-ic" />
          </Link>
        </p>
        <ol className="inst-lista inst-lista-num">
          <li>
            No GTM, crie uma tag <strong>HTML personalizado</strong> com o código da aba Tag GTM e o
            acionador <strong>All Pages</strong>.
          </li>
          <li>
            Garanta que o site coloca o <code>user_id</code> no dataLayer depois do login ou do
            cadastro.
          </li>
          <li>Publique o contêiner.</li>
        </ol>
        <p className="inst-teste">
          <strong>Como conferir:</strong> abra o site com{' '}
          <code>?utm_source=teste&amp;utm_campaign=instalacao</code>, abra as ferramentas do
          navegador (F12) na aba Rede e procure uma chamada para o endereço abaixo com resposta{' '}
          <strong>204</strong>.
        </p>
        <Copiavel valor={coleta} rotulo="Endereço de coleta da tag" />
      </>
    ),
    plataforma: (
      <>
        <p>
          A plataforma manda um <strong>POST</strong> em JSON para o endereço da fonte a cada{' '}
          <strong>cadastro</strong>, <strong>FTD</strong> e <strong>depósito</strong> (redepósito
          também é depósito), assinado com o segredo. Use o mesmo <code>user_id</code> que o site
          coloca no dataLayer.
        </p>
        <table className="cfg-tabela inst-tabela">
          <caption className="so-leitor">Cabeçalhos de cada envio</caption>
          <thead>
            <tr>
              <th scope="col">Cabeçalho</th>
              <th scope="col">O que mandar</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>X-Timestamp</code>
              </td>
              <td>Hora do envio em segundos (Unix). Aceita até 5 minutos de diferença.</td>
            </tr>
            <tr>
              <td>
                <code>X-Signature</code>
              </td>
              <td>
                HMAC-SHA256 em hexadecimal de <code>X-Timestamp + &quot;.&quot; + corpo</code>, com
                o segredo da fonte.
              </td>
            </tr>
            <tr>
              <td>
                <code>X-Event-Id</code>
              </td>
              <td>Identificador único do evento. Reenviar o mesmo id não duplica a contagem.</td>
            </tr>
          </tbody>
        </table>
        <h3 className="inst-subtitulo">Exemplo de envio (Node.js)</h3>
        <Copiavel valor={EXEMPLO_ASSINATURA} rotulo="Exemplo de envio assinado" bloco />
        <p className="inst-nota">
          Plataforma que só aceita credencial <strong>Basic</strong> (ex.: GTech): no lugar dos
          cabeçalhos acima, use usuário = slug da fonte e senha = segredo. Sem janela de horário;
          reenviar o mesmo corpo não duplica a contagem.
        </p>
        <Copiavel valor={EXEMPLO_BASIC} rotulo="Exemplo de envio com Basic" bloco />
        <h3 className="inst-subtitulo">Exemplo de evento</h3>
        <Copiavel valor={EXEMPLO_EVENTO} rotulo="Exemplo de evento" bloco />
        <p className="inst-nota">
          Respostas: <strong>202</strong> recebido, <strong>200</strong> repetido (ignorado),{' '}
          <strong>401</strong> assinatura, horário ou senha Basic inválidos, <strong>404</strong>{' '}
          fonte desativada ou endereço errado.
        </p>
      </>
    ),
    regras: (
      <>
        <p>
          Cada plataforma tem um formato de JSON. As regras da fonte dizem onde está o tipo do
          evento, o valor, a data, o <code>user_id</code> e as UTMs, e se o valor vem em centavos.
          Por enquanto quem cadastra as regras é a equipe técnica: envie a ela um exemplo real de
          cada evento (cadastro, FTD e depósito).
        </p>
        {leituras.some((x) => x.r.ok && x.r.dados.entregas.length > 0) && (
          <ul className="inst-entregas">
            {leituras.flatMap(({ f, r }) =>
              r.ok
                ? r.dados.entregas.slice(0, 3).map((en) => (
                    <li key={en.id} className="inst-entrega" data-estado={en.status}>
                      <span className="inst-entrega-fonte">{f.nome}</span>
                      <span>{ROTULO_ENTREGA[en.status]}</span>
                      {en.erro && <span className="inst-entrega-erro">{en.erro}</span>}
                    </li>
                  ))
                : [],
            )}
          </ul>
        )}
      </>
    ),
    equipe: (
      <>
        <p>
          Convide quem vai acompanhar os números. O convite chega por e-mail; se não chegar, o link
          aparece para copiar.{' '}
          <Link className="inst-link" href="/configuracoes/usuarios">
            Abrir Usuários
            <Icone nome="abrir-aba" className="inst-link-ic" />
          </Link>
        </p>
        <dl className="inst-papeis">
          <dt>Administrador</dt>
          <dd>Tudo, inclusive estas configurações.</dd>
          <dt>Analista</dt>
          <dd>Painel, exportação e simulação de regras.</dd>
          <dt>Leitor</dt>
          <dd>Só acompanha o painel.</dd>
        </dl>
      </>
    ),
  };

  return (
    <div className="inst">
      <header className="inst-topo">
        <div className="inst-topo-texto">
          <h2 className="inst-titulo">Coloque o painel para funcionar</h2>
          <p className="inst-intro">
            Sete passos, na ordem. Os que dependem de dados são conferidos sozinhos sempre que você
            abre esta aba.
          </p>
          <Tutorial id="instalacao" />
        </div>
        <div className="inst-progresso" aria-label={`${feitos} de ${total} passos concluídos`}>
          <span className="inst-progresso-num">
            {feitos}
            <span className="inst-progresso-total">/{total}</span>
          </span>
          <span className="inst-barra" aria-hidden="true">
            <span className="inst-barra-cheia" style={{ transform: `scaleX(${feitos / total})` }} />
          </span>
        </div>
      </header>

      {tudoPronto && (
        <p className="cfg-sucesso inst-pronto" role="status">
          Tudo conectado. Os eventos já aparecem no painel.{' '}
          <Link className="inst-link" href="/">
            Ver Visão Geral
          </Link>
        </p>
      )}

      <ol className="inst-passos">
        {passos.map((p, i) => (
          <ItemPasso key={p.id} passo={p} numero={i + 1}>
            {corpo[p.id]}
          </ItemPasso>
        ))}
      </ol>
    </div>
  );
}

const ROTULO_ENTREGA = {
  recebido: 'Recebido, aguardando',
  processado: 'No painel',
  erro: 'Não entrou',
} as const;

function ItemPasso(props: { passo: Passo; numero: number; children: ReactNode }) {
  const { passo } = props;
  return (
    <li
      className="inst-passo"
      data-estado={passo.estado}
      style={{ '--i': props.numero - 1 } as CSSProperties}
    >
      <details open={passo.estado !== 'feito'}>
        <summary className="inst-resumo">
          <span className="inst-marcador" aria-hidden="true">
            {passo.estado === 'feito' ? (
              <Icone nome="feito" className="inst-marcador-ic" />
            ) : (
              props.numero
            )}
          </span>
          <span className="inst-resumo-texto">
            <span className="inst-passo-titulo">{passo.titulo}</span>
            <span className="inst-situacao">{passo.situacao}</span>
          </span>
          <span className="inst-estado">
            <Icone nome={ICONE_ESTADO[passo.estado]} className="inst-estado-ic" />
            {ROTULO_ESTADO[passo.estado]}
          </span>
          <Icone nome="chevron-down" className="inst-seta" />
        </summary>
        <div className="inst-corpo">{props.children}</div>
      </details>
    </li>
  );
}
