import { api } from '@/lib/api';
import { mensagemErroApi, urlWebhook } from '../validacao';
import { Guia } from '../Guia';
import { Tutorial } from '../Tutorial';
import { GUIA_WEBHOOKS } from '../guias';
import { PainelWebhooks } from './PainelWebhooks';

export const dynamic = 'force-dynamic';

const TITULO = <h2 className="cfg-subtitulo cfg-sem-margem">Fontes de webhook</h2>;

export default async function Webhooks() {
  const r = await api().fontes();
  if (!r.ok) {
    return (
      <>
        {TITULO}
        <p className="cfg-faixa-erro" role="alert">
          Não foi possível carregar as fontes de webhook agora.{' '}
          {r.status === 403 || r.codigo === 'acesso_negado' ? mensagemErroApi(r) : r.mensagem}
        </p>
      </>
    );
  }
  const origem = process.env.WEBHOOK_URL_PUBLICA;
  const fontes = r.dados.fontes.map((f) => ({ ...f, url: urlWebhook(f.caminho, origem) }));
  return (
    <>
      {TITULO}
      <div className="cfg-tutorial">
        <Tutorial id="webhooks" />
      </div>
      <Guia titulo="Passo a passo" passos={GUIA_WEBHOOKS} />
      <PainelWebhooks fontes={fontes} />
    </>
  );
}
