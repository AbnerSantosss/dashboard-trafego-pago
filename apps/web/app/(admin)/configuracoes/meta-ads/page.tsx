import { api } from '@/lib/api';
import { mensagemErroApi } from '../validacao';
import { Guia } from '../Guia';
import { Tutorial } from '../Tutorial';
import { GUIA_META } from '../guias';
import { PainelMeta } from './PainelMeta';

export const dynamic = 'force-dynamic';

const TITULO = <h2 className="cfg-subtitulo cfg-sem-margem">Contas do Meta Ads</h2>;

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});

export default async function MetaAds() {
  const r = await api().metaContas();
  if (!r.ok) {
    return (
      <>
        {TITULO}
        <p className="cfg-faixa-erro" role="alert">
          Não foi possível carregar as contas do Meta agora. {mensagemErroApi(r)}
        </p>
      </>
    );
  }
  // Data formatada no servidor: o navegador pode estar em outro fuso e quebrar a hidratação.
  const contas = r.dados.contas.map((c) => ({
    ...c,
    ultimaSyncTexto: c.ultimaSync ? DATA_HORA.format(new Date(c.ultimaSync)) : null,
  }));
  return (
    <>
      {TITULO}
      <div className="cfg-tutorial">
        <Tutorial id="meta" />
      </div>
      <Guia titulo="Passo a passo" passos={GUIA_META} />
      <PainelMeta contas={contas} moedaEmpresa={r.dados.moedaEmpresa} />
    </>
  );
}
