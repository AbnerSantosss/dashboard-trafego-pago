import { api } from '@/lib/api';
import { sair } from '../../../(conta)/acoes';
import { DuasEtapas } from './DuasEtapas';
import { FormPerfil } from './FormPerfil';

export const dynamic = 'force-dynamic';

const PAPEL = { admin: 'Administrador', analista: 'Analista', leitor: 'Leitor' } as const;

export default async function Perfil() {
  const r = await api().me();
  if (!r.ok) {
    return (
      <>
        <h2 className="cfg-subtitulo cfg-sem-margem">Dados pessoais</h2>
        <p className="cfg-faixa-erro" role="alert">
          Não foi possível carregar o perfil agora. {r.mensagem}
        </p>
      </>
    );
  }
  const { usuario, empresas } = r.dados;
  return (
    <div className="cfg-perfil">
      <div className="cfg-bloco">
        <h2 className="cfg-subtitulo">Dados pessoais</h2>
        <FormPerfil usuario={usuario} />
      </div>
      {/* Duas etapas e Acesso empilhados numa coluna, para caberem ao lado dos dados em 1366 px. */}
      <div className="cfg-perfil-lateral">
        <div className="cfg-bloco">
          <h2 className="cfg-subtitulo">Verificação em duas etapas</h2>
          <DuasEtapas ativa={r.dados.duasEtapas === true} />
        </div>
        <div className="cfg-bloco">
          <h2 className="cfg-subtitulo">Acesso</h2>
          <ul className="cfg-lista">
            {empresas.map((e) => (
              <li key={e.id}>
                {e.nome} — {PAPEL[e.papel]}
              </li>
            ))}
          </ul>
          <form action={sair}>
            <button type="submit" className="cfg-botao">
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
