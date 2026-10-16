import { api } from '@/lib/api';
import { mensagemErroApi, urlWebhook } from '../validacao';
import { PainelWebhooks } from './PainelWebhooks';

export const dynamic = 'force-dynamic';

export default async function Webhooks() {
  const r = await api().fontes();
  if (!r.ok) {
    return (
      <p className="cfg-faixa-erro" role="alert">
        Não foi possível carregar as fontes de webhook agora.{' '}
        {r.status === 403 || r.codigo === 'acesso_negado' ? mensagemErroApi(r) : r.mensagem}
      </p>
    );
  }
  const origem = process.env.WEBHOOK_URL_PUBLICA;
  const fontes = r.dados.fontes.map((f) => ({ ...f, url: urlWebhook(f.caminho, origem) }));
  return <PainelWebhooks fontes={fontes} />;
}
