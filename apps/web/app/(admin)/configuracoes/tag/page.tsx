import { lerConfig } from '@/lib/api';
import { lerSessaoDoCookie } from '@/lib/sessao';
import { gerarTagGtm, urlColeta } from '@/lib/tag-gtm';
import { PainelTag } from './PainelTag';

export const dynamic = 'force-dynamic';

export default async function Tag() {
  const config = lerConfig();
  const empresa = (await lerSessaoDoCookie()).empresa ?? config.empresa;
  // Origem pública da API (a mesma dos webhooks); sem ela, usa API_URL (só serve em teste local).
  const origem = process.env.WEBHOOK_URL_PUBLICA || config.apiUrl;
  const endpoint = urlColeta(origem, empresa);
  return (
    <PainelTag
      codigo={gerarTagGtm(endpoint)}
      endpoint={endpoint}
      semOrigemPublica={!process.env.WEBHOOK_URL_PUBLICA}
    />
  );
}
