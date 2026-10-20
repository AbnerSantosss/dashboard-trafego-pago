import Link from 'next/link';
import type { PassoGuia } from './Guia';

/** Passo a passo da Tag do GTM. O código e o endereço de coleta aparecem logo abaixo do guia. */
export const GUIA_TAG: PassoGuia[] = [
  {
    titulo: 'Abra o Google Tag Manager',
    texto: (
      <p>
        Em <code>tagmanager.google.com</code>, entre no contêiner instalado no site.
      </p>
    ),
  },
  {
    titulo: 'Crie uma tag HTML personalizado',
    texto: (
      <p>
        Vá em <strong>Tags → Nova → Configuração da tag → HTML personalizado</strong> e dê um nome
        fácil de achar, como &quot;Painel · coleta&quot;.
      </p>
    ),
  },
  {
    titulo: 'Cole o código',
    texto: (
      <p>
        Clique em <strong>Copiar código</strong>, aqui embaixo, e cole no campo HTML da tag.
      </p>
    ),
  },
  {
    titulo: 'Escolha o acionador',
    texto: (
      <p>
        Use <strong>All Pages</strong>. Se o login do site não recarrega a página, acrescente um
        acionador de <strong>Evento personalizado</strong> com o nome do evento em que o{' '}
        <code>user_id</code> entra no dataLayer.
      </p>
    ),
  },
  {
    titulo: 'Peça ao site para enviar o user_id',
    texto: (
      <>
        <p>
          Depois do login ou do cadastro, o site coloca o id do usuário no dataLayer. Precisa ser o
          mesmo id que a plataforma manda nos webhooks.
        </p>
        <code className="cfg-guia-codigo">{"dataLayer.push({ user_id: 'ID-DO-USUARIO' });"}</code>
      </>
    ),
  },
  {
    titulo: 'Teste no modo Visualizar',
    texto: (
      <p>
        No GTM, clique em <strong>Visualizar</strong> e abra o site com{' '}
        <code>?utm_source=teste</code>. Nas ferramentas do navegador (F12), aba Rede, deve aparecer
        uma chamada para o endereço de coleta com resposta <strong>204</strong>.
      </p>
    ),
  },
  {
    titulo: 'Publique',
    texto: (
      <p>
        Clique em <strong>Enviar → Publicar</strong>. A partir daí, as visitas aparecem no painel.
      </p>
    ),
  },
];

/** Passo a passo dos webhooks. A lista de fontes e o botão Nova fonte aparecem logo abaixo. */
export const GUIA_WEBHOOKS: PassoGuia[] = [
  {
    titulo: 'Crie uma fonte',
    texto: (
      <p>
        Clique em <strong>Nova fonte</strong>, aqui embaixo. Crie uma por sistema que manda eventos
        (a plataforma da casa, um parceiro).
      </p>
    ),
  },
  {
    titulo: 'Copie o segredo na hora',
    texto: (
      <p>
        O segredo aparece <strong>uma vez só</strong>. Guarde em lugar seguro. Se perder, use{' '}
        <strong>Gerar novo segredo</strong> na linha da fonte; o antigo para de valer.
      </p>
    ),
  },
  {
    titulo: 'Entregue à equipe da plataforma',
    texto: (
      <p>
        Passe o <strong>endereço de recebimento</strong> da fonte (coluna da tabela) e o segredo.
        Por mensagem privada, nunca em grupo.
      </p>
    ),
  },
  {
    titulo: 'Configure os envios',
    texto: (
      <p>
        A cada <strong>cadastro</strong>, <strong>FTD</strong> e <strong>depósito</strong>, a
        plataforma manda um POST em JSON assinado com os cabeçalhos <code>X-Timestamp</code>,{' '}
        <code>X-Signature</code> e <code>X-Event-Id</code>. O exemplo pronto está em{' '}
        <Link className="inst-link" href="/configuracoes/instalacao">
          Visão geral
        </Link>
        , no passo da plataforma. Se a plataforma só aceitar credencial <strong>Basic</strong> (ex.:
        GTech), use usuário = slug da fonte e senha = segredo.
      </p>
    ),
  },
  {
    titulo: 'Mande um exemplo de cada evento',
    texto: (
      <p>
        Envie à equipe técnica um JSON real de cadastro, de FTD e de depósito. Com eles, ela
        cadastra as regras que dizem onde estão o valor, a data, o <code>user_id</code> e as UTMs.
      </p>
    ),
  },
  {
    titulo: 'Confira a chegada',
    texto: (
      <p>
        Resposta <strong>202</strong> é recebido; <strong>401</strong> é assinatura, horário ou
        senha Basic errados; <strong>404</strong> é fonte desativada ou endereço errado. Os últimos
        envios aparecem em Visão geral.
      </p>
    ),
  },
];

/** Passo a passo do Meta Ads. O formulário Conectar conta aparece logo abaixo. */
export const GUIA_META: PassoGuia[] = [
  {
    titulo: 'Abra as configurações do negócio',
    texto: (
      <p>
        Em <code>business.facebook.com</code>, entre no negócio dono da conta de anúncios e abra{' '}
        <strong>Configurações do negócio</strong>.
      </p>
    ),
  },
  {
    titulo: 'Crie um usuário do sistema',
    texto: (
      <p>
        Em <strong>Usuários → Usuários do sistema → Adicionar</strong>, crie um usuário com a função{' '}
        <strong>Funcionário</strong>. Ele não depende de nenhuma pessoa da equipe.
      </p>
    ),
  },
  {
    titulo: 'Dê acesso à conta de anúncios',
    texto: (
      <p>
        No usuário criado, clique em <strong>Atribuir ativos → Contas de anúncios</strong>, marque a
        conta e ligue a permissão <strong>Ver desempenho</strong>.
      </p>
    ),
  },
  {
    titulo: 'Gere o token',
    texto: (
      <p>
        Clique em <strong>Gerar novo token</strong>, escolha o app do negócio, validade{' '}
        <strong>Nunca</strong> e a permissão <code>ads_read</code>. Copie o token. Se não houver
        app, crie um do tipo Empresa em <code>developers.facebook.com</code>.
      </p>
    ),
  },
  {
    titulo: 'Copie o ID da conta',
    texto: (
      <p>
        No Gerenciador de Anúncios, o número da conta aparece no seletor de contas, no alto. Pode
        colar com ou sem o <code>act_</code>.
      </p>
    ),
  },
  {
    titulo: 'Conecte aqui',
    texto: (
      <p>
        Cole o ID e o token em <strong>Conectar conta</strong>, aqui embaixo. O painel lê os últimos
        30 dias na hora e depois atualiza sozinho de hora em hora. O token fica guardado cifrado e
        não aparece de novo.
      </p>
    ),
  },
  {
    titulo: 'Confira',
    texto: (
      <p>
        Na tabela, a conta mostra a hora da <strong>Última leitura</strong> e &quot;Atualizando
        sozinha&quot;. Se aparecer erro de token, use <strong>Trocar token</strong>.
      </p>
    ),
  },
];
