/**
 * Roteiro dos tutoriais animados (ver Tutorial.tsx). Cada cena é uma mini-interface montada com
 * as peças abaixo. As peças só declaram o movimento (`data-hf` = receita, `data-t` = instante em
 * ms dentro da cena); quem anima é a linha do tempo de linha-do-tempo.ts, no contrato do
 * Hyperframes. A cena dura ~5,6 s: as entradas terminam até ~3 s e o resto é leitura. Tudo é
 * medido em em, então a cena escala junto com a largura do palco, do celular ao desktop.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Icone } from '@/componentes/Nos';
import { formatarValor } from './linha-do-tempo';

export interface CenaTutorial {
  titulo: string;
  texto: string;
  visual: ReactNode;
}

export interface RoteiroTutorial {
  botao: string;
  resumo: string;
  titulo: string;
  cenas: CenaTutorial[];
}

type Tom = 'ok' | 'aviso' | 'erro' | 'info';
type Hf = Record<`data-${string}`, string | number | undefined>;

/** Declara o movimento da peça: a receita e o instante (ms) em que ela começa. */
const hf = (receita: string, d = 0, extra: Hf = {}): Hf => ({
  'data-hf': receita,
  'data-t': d,
  ...extra,
});

/* ---------------------------------------------------------------- peças da mini-interface */

/** Cursor que entra em diagonal e clica; o anel (.tt-clique) vem logo antes dele. */
function Cursor({ d }: { d: number }) {
  return (
    <>
      <span className="tt-clique" />
      <span className="tt-cursor" {...hf('cursor', d)}>
        <Icone nome="cursor" className="tt-cursor-ic" />
      </span>
    </>
  );
}

function Botao(props: { d?: number; clique?: number; primario?: boolean; children: ReactNode }) {
  const { d = 0, clique } = props;
  return (
    <span
      className="tt-botao tt-alvo"
      data-primario={props.primario || undefined}
      {...hf('surge', d)}
    >
      {props.children}
      {clique !== undefined && <Cursor d={clique} />}
    </span>
  );
}

function Selo({ d = 0, tom = 'ok', children }: { d?: number; tom?: Tom; children: ReactNode }) {
  return (
    <span className="tt-selo" data-tom={tom} {...hf('pop', d)}>
      {tom === 'ok' && <Icone nome="feito" className="tt-selo-ic" />}
      {tom === 'aviso' && <Icone nome="atencao" className="tt-selo-ic" />}
      {children}
    </span>
  );
}

function Chip({ d = 0, children }: { d?: number; children: ReactNode }) {
  return (
    <span className="tt-chip" {...hf('surge', d)}>
      {children}
    </span>
  );
}

/** Valor que troca no mesmo lugar: o antigo encolhe e o novo estoura (scale-swap). */
function Troca({ d, de, para }: { d: number; de: ReactNode; para: ReactNode }) {
  return (
    <span className="tt-troca" {...hf('troca', d)}>
      <span>{de}</span>
      <span>{para}</span>
    </span>
  );
}

/** Número que conta de `de` até `para` e cresce junto (counting-dynamic-scale). */
function Conta(props: {
  d: number;
  de: number;
  para: number;
  casas?: number;
  prefixo?: string;
  sufixo?: string;
}) {
  const { d, de, para, casas = 0, prefixo = '', sufixo = '' } = props;
  return (
    <span
      className="tt-conta"
      {...hf('contar', d, {
        'data-de': de,
        'data-para': para,
        'data-casas': casas,
        'data-prefixo': prefixo,
        'data-sufixo': sufixo,
      })}
    >
      {formatarValor(de, casas, prefixo, sufixo)}
    </span>
  );
}

function Janela(props: { d?: number; titulo: string; children: ReactNode; largura?: string }) {
  return (
    <div
      className="tt-janela"
      style={props.largura ? { width: props.largura } : undefined}
      {...hf('janela', props.d)}
    >
      <div className="tt-janela-barra">
        <span className="tt-janela-pontos" />
        <span className="tt-janela-titulo">{props.titulo}</span>
      </div>
      <div className="tt-janela-corpo">{props.children}</div>
    </div>
  );
}

function Campo({
  d = 0,
  rotulo,
  valor,
  dv,
}: {
  d?: number;
  rotulo: string;
  valor: ReactNode;
  dv?: number;
}) {
  return (
    <span className="tt-campo" {...hf('surge', d)}>
      <span className="tt-campo-rot">{rotulo}</span>
      <span className="tt-campo-caixa">
        <span {...hf('surge', dv ?? d + 300)}>{valor}</span>
      </span>
    </span>
  );
}

function No(props: {
  d?: number;
  icone: string;
  titulo: string;
  sub?: string;
  destaque?: boolean;
}) {
  return (
    <div className="tt-no" data-destaque={props.destaque || undefined} {...hf('surge', props.d)}>
      {props.destaque && <span className="tt-no-brilho" {...hf('brilho', (props.d ?? 0) + 300)} />}
      <span className="tt-no-ic">
        <Icone nome={props.icone} className="tt-ic" />
      </span>
      <span className="tt-no-texto">
        <strong>{props.titulo}</strong>
        {props.sub && <span>{props.sub}</span>}
      </span>
    </div>
  );
}

/** Linha que se desenha da esquerda para a direita; `pacotes` são pontos que viajam por ela. */
function Conector({
  d = 0,
  pacotes = [],
  largura = '3em',
}: {
  d?: number;
  pacotes?: number[];
  largura?: string;
}) {
  return (
    <span className="tt-conector" style={{ width: largura }}>
      <span className="tt-conector-linha" {...hf('desenha', d)} />
      <span className="tt-conector-seta" {...hf('surge', d + 380)} />
      {pacotes.map((p) => (
        <span key={p} className="tt-pacote" {...hf('pacote', p)} />
      ))}
    </span>
  );
}

/** Duas ou três origens que se juntam num destino (estrutura em chave). */
function Converge({
  origens,
  destino,
  d = 0,
}: {
  origens: ReactNode[];
  destino: ReactNode;
  d?: number;
}) {
  return (
    <div className="tt-converge" style={{ '--n': origens.length } as CSSProperties}>
      {origens.map((o, i) => (
        <div key={i} className="tt-converge-origem" style={{ gridRow: i + 1 }}>
          {o}
          <span className="tt-toco" {...hf('desenha', d + 500 + i * 80)} />
        </div>
      ))}
      <span className="tt-vertical" {...hf('desenha-v', d + 760)} />
      <Conector d={d + 900} pacotes={[d + 1300, d + 2300]} largura="2.5em" />
      <div className="tt-converge-destino">{destino}</div>
    </div>
  );
}

function Linha({
  d = 0,
  sai,
  children,
  tom,
}: {
  d?: number;
  sai?: number;
  tom?: Tom;
  children: ReactNode;
}) {
  return (
    <div className="tt-linha" data-tom={tom} {...hf('surge', d, { 'data-sai': sai })}>
      {children}
    </div>
  );
}

function Kpi({
  d = 0,
  icone,
  rotulo,
  children,
}: {
  d?: number;
  icone: string;
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <div className="tt-kpi" {...hf('surge', d)}>
      <span className="tt-kpi-rot">
        <Icone nome={icone} className="tt-ic" />
        {rotulo}
      </span>
      <strong className="tt-kpi-valor">{children}</strong>
    </div>
  );
}

function Codigo({ d = 0, linhas, realce }: { d?: number; linhas: string[]; realce?: number }) {
  return (
    <pre className="tt-codigo">
      {linhas.map((l, i) => (
        <span
          key={i}
          className="tt-codigo-linha"
          data-realce={i === realce || undefined}
          {...hf('cascata', d + i * 110)}
        >
          {i === realce && <span className="tt-marca" {...hf('marca', d + i * 110 + 300)} />}
          {l || ' '}
        </span>
      ))}
    </pre>
  );
}

function Barra({
  d = 0,
  f,
  rotulo,
  valor,
}: {
  d?: number;
  f: number;
  rotulo: string;
  valor: number;
}) {
  return (
    <div className="tt-barra-linha" {...hf('surge', d)}>
      <span className="tt-barra-rot">{rotulo}</span>
      <span className="tt-barra-trilho">
        <span className="tt-barra-cheia" {...hf('desenha', d + 200, { 'data-f': f })} />
      </span>
      <span className="tt-barra-valor">
        <Conta d={d + 200} de={0} para={valor} />
      </span>
    </div>
  );
}

function Simbolo({ d = 0, children }: { d?: number; children: ReactNode }) {
  return (
    <span className="tt-simbolo" {...hf('pop', d)}>
      {children}
    </span>
  );
}

const Grade = ({ children }: { children: ReactNode }) => <div className="tt-grade">{children}</div>;
const Fila = ({ children, gap }: { children: ReactNode; gap?: string }) => (
  <div className="tt-fila" style={gap ? { gap } : undefined}>
    {children}
  </div>
);
const Coluna = ({ children, gap }: { children: ReactNode; gap?: string }) => (
  <div className="tt-coluna" style={gap ? { gap } : undefined}>
    {children}
  </div>
);

/* ---------------------------------------------------------------- roteiros */

const GASTOS: RoteiroTutorial = {
  botao: 'Ver como o Investimento é calculado',
  resumo: 'Do gasto lançado ao CPA e ao ROAS',
  titulo: 'Como os gastos viram Investimento',
  cenas: [
    {
      titulo: 'Os gastos chegam de dois jeitos',
      texto:
        'O Meta Ads é lido sozinho, de hora em hora. Os outros canais (Google, TikTok, afiliados, e-mail) você lança à mão nesta aba.',
      visual: (
        <Converge
          origens={[
            <No key="m" icone="canal-meta" titulo="Meta Ads" sub="Sincroniza sozinho" />,
            <No
              key="l"
              d={150}
              icone="gestao-custos"
              titulo="Lançamento manual"
              sub="Você digita aqui"
            />,
          ]}
          destino={
            <No d={1100} icone="investimento" titulo="Gastos" sub="Um por dia e canal" destaque />
          }
        />
      ),
    },
    {
      titulo: 'Lance dia, canal e valor',
      texto:
        'Escolha o dia em que o dinheiro foi gasto, o canal com o mesmo nome que aparece no painel e o valor. Campanha e observação são opcionais.',
      visual: (
        <Coluna>
          <Janela titulo="Lançar gasto">
            <Fila gap="0.75em">
              <Campo d={150} rotulo="Data" valor="16/10/2026" />
              <Campo d={450} rotulo="Canal" valor="Google Ads" />
              <Campo d={750} rotulo="Valor" valor="R$ 1.200,00" />
              <Botao d={900} clique={1400} primario>
                Lançar gasto
              </Botao>
            </Fila>
          </Janela>
          <Linha d={2500}>
            <span>16/10</span>
            <span>Google Ads</span>
            <strong>R$ 1.200,00</strong>
            <Selo d={2700} tom="info">
              Manual
            </Selo>
          </Linha>
        </Coluna>
      ),
    },
    {
      titulo: 'A soma vira o Investimento',
      texto:
        'O painel soma os gastos do período e dos filtros escolhidos. Esse total é o card Investimento e a coluna Investimento da tabela por canal.',
      visual: (
        <Fila gap="0.5em">
          <Coluna gap="0.4em">
            <Linha>
              <span>Meta Ads</span>
              <strong>R$ 3.400</strong>
            </Linha>
            <Linha d={120}>
              <span>TikTok</span>
              <strong>R$ 800</strong>
            </Linha>
            <Linha d={900} tom="ok">
              <span>Google Ads</span>
              <strong>+ R$ 1.200</strong>
            </Linha>
          </Coluna>
          <Conector d={1300} pacotes={[1600]} largura="3em" />
          <Kpi d={400} icone="investimento" rotulo="Investimento">
            <Conta d={2000} de={4200} para={5400} prefixo="R$ " />
          </Kpi>
        </Fila>
      ),
    },
    {
      titulo: 'CPA e ROAS saem dele',
      texto:
        'CPA é o Investimento dividido pelos FTDs; ROAS é Depósitos dividido pelo Investimento. Gasto esquecido deixa o CPA baixo demais e o ROAS alto demais.',
      visual: (
        <Coluna gap="1em">
          <Fila gap="0.6em">
            <Kpi icone="investimento" rotulo="Investimento">
              R$ 5.400
            </Kpi>
            <Simbolo d={300}>÷</Simbolo>
            <Kpi d={450} icone="ftds" rotulo="FTDs">
              45
            </Kpi>
            <Simbolo d={750}>=</Simbolo>
            <Kpi d={900} icone="cpa" rotulo="CPA">
              <Conta d={1000} de={0} para={120} prefixo="R$ " />
            </Kpi>
          </Fila>
          <Fila gap="0.6em">
            <Kpi d={1500} icone="depositos" rotulo="Depósitos">
              R$ 16.200
            </Kpi>
            <Simbolo d={1800}>÷</Simbolo>
            <Kpi d={1950} icone="investimento" rotulo="Investimento">
              R$ 5.400
            </Kpi>
            <Simbolo d={2250}>=</Simbolo>
            <Kpi d={2400} icone="roas" rotulo="ROAS">
              <Conta d={2500} de={0} para={3} casas={2} sufixo="x" />
            </Kpi>
          </Fila>
        </Coluna>
      ),
    },
    {
      titulo: 'Errou? Corrija aqui mesmo',
      texto:
        'Lançamento manual tem o botão Remover e o painel muda na hora. Gasto do Meta não se apaga aqui: corrija no Meta e ele chega certo na próxima sincronização.',
      visual: (
        <Fila gap="0.5em">
          <Coluna gap="0.4em">
            <Linha>
              <span>Meta Ads</span>
              <strong>R$ 3.400</strong>
              <Selo tom="info">Sincronizado</Selo>
            </Linha>
            <Linha d={120} sai={2000}>
              <span>Google Ads</span>
              <strong>R$ 1.200</strong>
              <Botao d={300} clique={900}>
                Remover
              </Botao>
            </Linha>
          </Coluna>
          <Conector d={2300} largura="2.5em" />
          <Kpi d={250} icone="investimento" rotulo="Investimento">
            <Conta d={2500} de={5400} para={4200} prefixo="R$ " />
          </Kpi>
        </Fila>
      ),
    },
  ],
};

const INSTALACAO: RoteiroTutorial = {
  botao: 'Ver como os dados chegam ao painel',
  resumo: 'Tag, webhooks e Meta Ads, do clique ao painel',
  titulo: 'Como os dados chegam ao painel',
  cenas: [
    {
      titulo: 'Três ligações alimentam o painel',
      texto:
        'O site conta de onde cada pessoa veio, a plataforma avisa o que ela fez e o Meta Ads informa quanto custou. O painel cruza os três.',
      visual: (
        <Converge
          origens={[
            <No key="s" icone="link" titulo="Site" sub="Tag do GTM: origem" />,
            <No key="p" d={120} icone="webhook" titulo="Plataforma" sub="Webhook: eventos" />,
            <No key="m" d={240} icone="canal-meta" titulo="Meta Ads" sub="Gastos" />,
          ]}
          destino={
            <No d={1100} icone="visao-geral" titulo="Painel" sub="Funil, KPIs e canais" destaque />
          }
        />
      ),
    },
    {
      titulo: 'A tag guarda a origem',
      texto:
        'Quando a pessoa chega por um anúncio, a tag lê as UTMs e, depois do login ou do cadastro, liga essa origem ao user_id dela.',
      visual: (
        <Fila gap="0.6em">
          <Janela titulo="suaempresa.com.br/?utm_source=facebook" largura="19em">
            <Coluna gap="0.45em">
              <Chip d={600}>utm_source: facebook</Chip>
              <Chip d={750}>utm_campaign: outubro</Chip>
              <Chip d={1500}>user_id: u-4815</Chip>
            </Coluna>
          </Janela>
          <Conector d={2000} pacotes={[2300]} largura="2.5em" />
          <Selo d={2700}>Coleta: 204</Selo>
        </Fila>
      ),
    },
    {
      titulo: 'A plataforma avisa cada evento',
      texto:
        'A cada cadastro, primeiro depósito (FTD) e depósito, a plataforma manda um POST assinado para o endereço da fonte, com o mesmo user_id.',
      visual: (
        <Fila gap="0.5em">
          <No icone="webhook" titulo="Plataforma" sub="POST assinado" />
          <Conector d={300} pacotes={[600, 1200, 1800]} largura="3.5em" />
          <Coluna gap="0.4em">
            <Linha d={900}>
              <span>cadastro</span>
              <span>u-4815</span>
              <Selo d={1000}>202</Selo>
            </Linha>
            <Linha d={1500}>
              <span>FTD</span>
              <strong>R$ 150,00</strong>
              <Selo d={1600}>202</Selo>
            </Linha>
            <Linha d={2100}>
              <span>depósito</span>
              <strong>R$ 300,00</strong>
              <Selo d={2200}>202</Selo>
            </Linha>
          </Coluna>
        </Fila>
      ),
    },
    {
      titulo: 'O painel junta tudo pelo user_id',
      texto:
        'Origem e eventos com o mesmo user_id viram uma pessoa no funil, atribuída ao canal e à campanha certos.',
      visual: (
        <Fila gap="0.75em">
          <Coluna gap="0.4em">
            <Chip>u-4815</Chip>
            <Chip d={150}>facebook · outubro</Chip>
            <Chip d={300}>cadastro · FTD · depósito</Chip>
          </Coluna>
          <Conector d={600} pacotes={[900]} largura="2.5em" />
          <Janela d={500} titulo="Funil · Meta Ads" largura="17em">
            <Coluna gap="0.5em">
              <Barra d={900} f={0.92} rotulo="Cadastros" valor={312} />
              <Barra d={1100} f={0.5} rotulo="FTDs" valor={89} />
              <Barra d={1300} f={0.34} rotulo="Depósitos" valor={141} />
            </Coluna>
          </Janela>
        </Fila>
      ),
    },
    {
      titulo: 'Sete passos e pronto',
      texto:
        'Esta aba confere sozinha cada passo que depende de dados. Siga na ordem; os concluídos ficam marcados e recolhidos.',
      visual: (
        <Janela titulo="Instalação" largura="31em">
          <Grade>
            {[
              'Endereço público',
              'Apresentação',
              'Fonte de webhook',
              'Tag do GTM',
              'Envio da plataforma',
              'Regras da fonte',
              'Equipe',
            ].map((p, i) => (
              <Linha key={p} d={i * 90}>
                <span>
                  {i + 1}. {p}
                </span>
                <Selo d={900 + i * 260}>Concluído</Selo>
              </Linha>
            ))}
          </Grade>
        </Janela>
      ),
    },
  ],
};

const TAG: RoteiroTutorial = {
  botao: 'Ver a instalação da tag',
  resumo: 'Do GTM ao teste com resposta 204',
  titulo: 'Instalando a tag no Google Tag Manager',
  cenas: [
    {
      titulo: 'Crie uma tag nova no GTM',
      texto: 'No contêiner do site, abra Tags, clique em Nova e escolha o tipo HTML personalizado.',
      visual: (
        <Janela titulo="Google Tag Manager · Tags" largura="26em">
          <Coluna gap="0.5em">
            <Fila gap="0.5em">
              <Linha>
                <span>GA4 · Configuração</span>
              </Linha>
              <Botao d={200} clique={600} primario>
                Nova
              </Botao>
            </Fila>
            <Fila gap="0.5em">
              <Chip d={1600}>Google Analytics</Chip>
              <Chip d={1700}>Imagem personalizada</Chip>
              <Selo d={1800} tom="info">
                HTML personalizado
              </Selo>
            </Fila>
          </Coluna>
        </Janela>
      ),
    },
    {
      titulo: 'Cole o código desta aba',
      texto:
        'Use o botão Copiar código aqui embaixo e cole no campo HTML da tag. O código já vem com o endereço de coleta da sua empresa.',
      visual: (
        <Fila gap="0.6em">
          <Coluna gap="0.5em">
            <Botao clique={300}>Copiar código</Botao>
            <Selo d={1100}>Copiado</Selo>
          </Coluna>
          <Conector d={1300} pacotes={[1500]} largura="2.5em" />
          <Janela d={200} titulo="HTML personalizado" largura="18em">
            <Codigo
              d={1800}
              linhas={[
                '<script>',
                '  (function () {',
                "    var api = 'https://…/coleta';",
                '    // guarda UTMs e user_id',
                '  })();',
                '</script>',
              ]}
            />
          </Janela>
        </Fila>
      ),
    },
    {
      titulo: 'Acionador: All Pages',
      texto:
        'Em Acionamento, escolha All Pages. Assim a tag roda em todas as páginas e guarda as UTMs logo na chegada.',
      visual: (
        <Janela titulo="Acionamento" largura="24em">
          <Coluna gap="0.45em">
            <Linha d={200}>
              <span>Clique · Todos os elementos</span>
            </Linha>
            <Fila gap="0.5em">
              <Linha d={300}>
                <span>All Pages · Visualização de página</span>
              </Linha>
              <Botao d={400} clique={900} primario>
                Escolher
              </Botao>
            </Fila>
            <Selo d={2000}>Acionador: All Pages</Selo>
          </Coluna>
        </Janela>
      ),
    },
    {
      titulo: 'O site manda o user_id',
      texto:
        'Depois do login ou do cadastro, o site coloca o user_id no dataLayer. É esse id que liga a visita aos eventos da plataforma.',
      visual: (
        <Fila gap="0.6em">
          <Janela titulo="Site · depois do login" largura="18em">
            <Codigo
              d={300}
              realce={2}
              linhas={['dataLayer.push({', "  event: 'login',", "  user_id: 'u-4815'", '});']}
            />
          </Janela>
          <Conector d={1300} pacotes={[1600]} largura="2.5em" />
          <Coluna gap="0.4em">
            <Chip d={1900}>u-4815</Chip>
            <Selo d={2300} tom="info">
              Mesmo id da plataforma
            </Selo>
          </Coluna>
        </Fila>
      ),
    },
    {
      titulo: 'Teste e publique',
      texto:
        'Abra o site com ?utm_source=teste, procure na aba Rede (F12) uma chamada de coleta com resposta 204 e publique o contêiner.',
      visual: (
        <Fila gap="0.75em">
          <Janela titulo="F12 · Rede" largura="19em">
            <Coluna gap="0.4em">
              <Linha d={300}>
                <span>gtm.js</span>
                <span>200</span>
              </Linha>
              <Linha d={700} tom="ok">
                <span>coleta?empresa=pasio</span>
                <strong>204</strong>
              </Linha>
            </Coluna>
          </Janela>
          <Coluna gap="0.5em">
            <Botao d={1200} clique={1500} primario>
              Enviar
            </Botao>
            <Selo d={2500}>Publicado</Selo>
          </Coluna>
        </Fila>
      ),
    },
  ],
};

const WEBHOOKS: RoteiroTutorial = {
  botao: 'Ver como ligar um webhook',
  resumo: 'Criar a fonte, assinar e receber eventos',
  titulo: 'Ligando a plataforma por webhook',
  cenas: [
    {
      titulo: 'Crie uma fonte',
      texto:
        'Cada sistema que manda eventos é uma fonte. Dê um nome e crie: a fonte ganha um endereço e um segredo próprios.',
      visual: (
        <Coluna>
          <Janela titulo="Nova fonte" largura="24em">
            <Fila gap="0.75em">
              <Campo d={150} rotulo="Nome" valor="Plataforma da casa" />
              <Botao d={500} clique={1000} primario>
                Criar fonte
              </Botao>
            </Fila>
          </Janela>
          <Linha d={2100}>
            <span>Plataforma da casa</span>
            <Selo d={2300}>Ativa</Selo>
          </Linha>
        </Coluna>
      ),
    },
    {
      titulo: 'Copie o endereço e o segredo',
      texto:
        'Copie os dois na hora e guarde o segredo num cofre: ele só aparece uma vez. Se perder, gere outro em Rotacionar segredo.',
      visual: (
        <Coluna gap="0.6em">
          <Fila gap="0.5em">
            <Linha>
              <span>Endereço</span>
              <span>https://api…/webhooks/plataforma</span>
            </Linha>
            <Botao clique={400}>Copiar</Botao>
            <Selo d={1200}>Copiado</Selo>
          </Fila>
          <Fila gap="0.5em">
            <Linha d={100}>
              <span>Segredo</span>
              <span>whsec_••••••••••••</span>
            </Linha>
            <Botao d={100} clique={1500}>
              Copiar
            </Botao>
            <Selo d={2300}>Copiado</Selo>
          </Fila>
          <Selo d={2700} tom="aviso">
            O segredo só aparece uma vez
          </Selo>
        </Coluna>
      ),
    },
    {
      titulo: 'Configure na plataforma',
      texto:
        'No painel da plataforma, cadastre o endereço e o segredo e marque os eventos de cadastro, FTD e depósito.',
      visual: (
        <Janela titulo="Plataforma · Webhooks" largura="27em">
          <Coluna gap="0.6em">
            <Fila gap="0.6em">
              <Campo d={200} rotulo="URL" valor="https://api…/plataforma" />
              <Campo d={500} rotulo="Segredo" valor="whsec_••••••" />
            </Fila>
            <Fila gap="0.4em">
              <Selo d={1200}>cadastro</Selo>
              <Selo d={1400}>FTD</Selo>
              <Selo d={1600}>depósito</Selo>
              <Botao d={1700} clique={2000} primario>
                Salvar
              </Botao>
            </Fila>
          </Coluna>
        </Janela>
      ),
    },
    {
      titulo: 'Cada envio vai assinado',
      texto:
        'A plataforma assina cada POST com o segredo (HMAC-SHA256). O painel confere a assinatura e o horário; repetir o X-Event-Id não conta duas vezes.',
      visual: (
        <Coluna gap="0.7em">
          <Fila gap="0.4em">
            <Chip d={200}>X-Timestamp</Chip>
            <Chip d={350}>X-Signature</Chip>
            <Chip d={500}>X-Event-Id</Chip>
          </Fila>
          <Fila gap="0.5em">
            <No icone="webhook" titulo="Plataforma" sub="POST + assinatura" />
            <Conector d={800} pacotes={[1100]} largura="4em" />
            <No d={900} icone="visao-geral" titulo="API do painel" sub="Confere e grava" destaque />
            <Selo d={2000}>202 Recebido</Selo>
          </Fila>
        </Coluna>
      ),
    },
    {
      titulo: 'Acompanhe as entregas',
      texto:
        'A Instalação mostra as últimas entregas de cada fonte: no painel, aguardando ou não entrou, com o motivo para corrigir.',
      visual: (
        <Coluna gap="0.45em">
          <Linha>
            <span>cadastro</span>
            <Troca d={1300} de={<Selo tom="info">Aguardando</Selo>} para={<Selo>No painel</Selo>} />
          </Linha>
          <Linha d={150}>
            <span>FTD</span>
            <Selo d={300}>No painel</Selo>
          </Linha>
          <Linha d={300} tom="erro">
            <span>depósito</span>
            <Selo d={450} tom="erro">
              Não entrou
            </Selo>
            <Chip d={2100}>regra sem o campo do valor</Chip>
          </Linha>
        </Coluna>
      ),
    },
  ],
};

const META: RoteiroTutorial = {
  botao: 'Ver como conectar o Meta Ads',
  resumo: 'Token, ID da conta e sincronização',
  titulo: 'Conectando o Meta Ads',
  cenas: [
    {
      titulo: 'Crie um usuário do sistema',
      texto:
        'Nas Configurações do negócio, crie um usuário do sistema (função Funcionário) e dê a ele acesso Ver desempenho na conta de anúncios.',
      visual: (
        <Janela titulo="Configurações do negócio · Usuários do sistema" largura="27em">
          <Coluna gap="0.5em">
            <Botao d={200} clique={500} primario>
              Adicionar
            </Botao>
            <Linha d={1500}>
              <span>painel-pasio</span>
              <span>Funcionário</span>
            </Linha>
            <Selo d={2300}>Conta de anúncios · Ver desempenho</Selo>
          </Coluna>
        </Janela>
      ),
    },
    {
      titulo: 'Gere o token',
      texto:
        'Gere um token sem validade com a permissão ads_read e copie. Ele só serve para ler gastos.',
      visual: (
        <Janela titulo="Gerar token" largura="26em">
          <Coluna gap="0.55em">
            <Botao clique={300} primario>
              Gerar novo token
            </Botao>
            <Fila gap="0.6em">
              <Campo d={1200} rotulo="Validade" valor="Nunca" />
              <Campo d={1400} rotulo="Permissão" valor="ads_read" />
            </Fila>
            <Linha d={2100}>
              <span>EAAG••••••••••••</span>
              <Selo d={2400}>Copiado</Selo>
            </Linha>
          </Coluna>
        </Janela>
      ),
    },
    {
      titulo: 'Conecte aqui',
      texto:
        'Cole o ID da conta (com ou sem act_) e o token em Conectar conta. O painel lê os últimos 30 dias na hora; o token fica guardado cifrado.',
      visual: (
        <Coluna>
          <Janela titulo="Conectar conta" largura="27em">
            <Fila gap="0.6em">
              <Campo d={200} rotulo="ID da conta" valor="act_1234567890" />
              <Campo d={500} rotulo="Token" valor="••••••••" />
              <Botao d={700} clique={1100} primario>
                Conectar
              </Botao>
            </Fila>
          </Janela>
          <Selo d={2200}>Conectada · 30 dias lidos</Selo>
        </Coluna>
      ),
    },
    {
      titulo: 'Depois, sincroniza sozinho',
      texto:
        'De hora em hora o painel busca os gastos de novo e atualiza o que mudou. Nada do Meta precisa ser lançado à mão.',
      visual: (
        <Coluna gap="0.45em">
          <Linha>
            <span>Última sincronização</span>
            <Troca d={1800} de="16/10 13:00" para="16/10 14:00" />
          </Linha>
          <Linha d={500}>
            <span>Campanha outubro</span>
            <strong>R$ 1.150</strong>
            <Selo d={700} tom="info">
              Meta Ads
            </Selo>
          </Linha>
          <Linha d={2100} tom="ok">
            <span>Remarketing</span>
            <strong>R$ 640</strong>
            <Selo d={2300} tom="info">
              Meta Ads
            </Selo>
          </Linha>
        </Coluna>
      ),
    },
    {
      titulo: 'Entra no Investimento',
      texto:
        'Os gastos do Meta aparecem em Gestão de custos com a origem Meta Ads e somam no Investimento, no CPA e no ROAS do painel.',
      visual: (
        <Fila gap="0.5em">
          <Linha>
            <span>Meta Ads</span>
            <strong>R$ 3.400</strong>
            <Selo tom="info">Sincronizado</Selo>
          </Linha>
          <Conector d={600} pacotes={[900]} largura="3em" />
          <Kpi d={300} icone="investimento" rotulo="Investimento">
            <Conta d={1400} de={2000} para={5400} prefixo="R$ " />
          </Kpi>
        </Fila>
      ),
    },
  ],
};

export const TUTORIAIS = {
  gastos: GASTOS,
  instalacao: INSTALACAO,
  tag: TAG,
  webhooks: WEBHOOKS,
  meta: META,
} satisfies Record<string, RoteiroTutorial>;

export type IdTutorial = keyof typeof TUTORIAIS;
