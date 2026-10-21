/**
 * Envio de e-mail por SMTP (convites e redefinição de senha).
 * Configuração só por variáveis de ambiente (SMTP_HOST, SMTP_PORT, SMTP_USUARIO, SMTP_SENHA,
 * EMAIL_REMETENTE). Sem SMTP configurado, nada é enviado: o resultado diz o que falta e quem chamou
 * decide o que fazer (o convite devolve o link para o admin copiar).
 *
 * Toda falha volta com `motivo` em português, dizendo exatamente o que aconteceu (servidor que não
 * responde, senha recusada, destinatário recusado...), e vai para o log com o código do nodemailer.
 * Nunca entram no motivo nem no log o usuário ou a senha do SMTP.
 */
import nodemailer from 'nodemailer';

export interface Mensagem {
  para: string;
  assunto: string;
  texto: string;
  html?: string;
}

export type ResultadoEnvio = { enviado: true } | { enviado: false; motivo: string };

export interface EnviadorEmail {
  configurado: boolean;
  /** Quanto a rota espera o envio antes de responder (padrão `PRAZO_RESPOSTA_EMAIL_MS`). */
  prazoMs?: number;
  enviar(m: Mensagem): Promise<ResultadoEnvio>;
}

interface Log {
  info?(o: object, msg: string): void;
  warn(o: object, msg: string): void;
}

/**
 * Tempo máximo de cada etapa da conversa com o servidor SMTP. Sem isto o nodemailer espera até
 * 2 min pela conexão e 30 s pela saudação, e quem chamou fica pendurado (o web desiste em 4 s).
 */
export const TEMPO_LIMITE_SMTP_MS = 8_000;

/**
 * Quanto a rota de convite espera o e-mail antes de responder. O web aborta a chamada em 4 s, então
 * a resposta precisa sair antes; o envio continua em segundo plano e o resultado vai para o log.
 */
export const PRAZO_RESPOSTA_EMAIL_MS = 2_500;

const segundos = (ms: number) => `${(ms / 1000).toLocaleString('pt-BR')} s`;

/** Erro do nodemailer: `code` (ETIMEDOUT, EAUTH...), `responseCode` e `response` do servidor. */
interface ErroSmtp {
  code?: string;
  responseCode?: number;
  response?: string;
  command?: string;
  message?: string;
}

/** Traduz a falha do nodemailer numa frase que diz o que aconteceu e onde olhar. */
export function motivoFalhaEmail(
  erro: unknown,
  servidor: { host: string; porta: number; tempoLimiteMs?: number },
): string {
  const e = (erro ?? {}) as ErroSmtp;
  const onde = `${servidor.host}:${servidor.porta}`;
  const resposta = e.response ? ` Resposta do servidor: "${e.response.trim().slice(0, 200)}".` : '';
  switch (e.code) {
    case 'ETIMEDOUT':
      return (
        `O servidor de e-mail ${onde} não respondeu em ${segundos(servidor.tempoLimiteMs ?? TEMPO_LIMITE_SMTP_MS)}` +
        ' (a porta pode estar bloqueada pela hospedagem ou o SMTP_HOST/SMTP_PORT estão errados).'
      );
    case 'EDNS':
      return `O endereço do servidor de e-mail "${servidor.host}" não foi encontrado (confira SMTP_HOST).`;
    case 'ECONNECTION':
    case 'ESOCKET':
      return `Não foi possível conectar ao servidor de e-mail ${onde} (${e.message ?? e.code}).`;
    case 'ETLS':
      return (
        `Falha na conexão segura (TLS) com ${onde}: confira SMTP_PORT ` +
        '(465 usa TLS direto; 587 usa STARTTLS).'
      );
    case 'EAUTH':
      return (
        `O servidor de e-mail ${onde} recusou o login: confira SMTP_USUARIO e SMTP_SENHA ` +
        '(no Gmail, a senha de app de 16 letras, com a verificação em duas etapas ligada).' +
        resposta
      );
    case 'EENVELOPE':
      return `O servidor de e-mail recusou o remetente ou o destinatário.${resposta}`;
  }
  return `O servidor de e-mail ${onde} recusou o envio (${e.code ?? e.message ?? 'erro desconhecido'}).${resposta}`;
}

export function criarEnviadorEmail(
  fonte: Record<string, string | undefined> = process.env,
  log?: Log,
  opcoes: { tempoLimiteMs?: number } = {},
): EnviadorEmail {
  const host = fonte.SMTP_HOST?.trim();
  const usuario = fonte.SMTP_USUARIO?.trim();
  const senha = fonte.SMTP_SENHA;
  if (!host || !usuario || !senha) {
    const faltam = [
      !host && 'SMTP_HOST',
      !usuario && 'SMTP_USUARIO',
      !senha && 'SMTP_SENHA',
    ].filter(Boolean);
    const motivo = `O envio de e-mail não está configurado na API (falta ${faltam.join(', ')}).`;
    return { configurado: false, enviar: async () => ({ enviado: false, motivo }) };
  }
  const porta = Number(fonte.SMTP_PORT?.trim() || 465);
  const tempoLimiteMs = opcoes.tempoLimiteMs ?? TEMPO_LIMITE_SMTP_MS;
  const transporte = nodemailer.createTransport({
    host,
    port: porta,
    secure: porta === 465,
    auth: { user: usuario, pass: senha },
    connectionTimeout: tempoLimiteMs,
    greetingTimeout: tempoLimiteMs,
    socketTimeout: tempoLimiteMs,
    dnsTimeout: tempoLimiteMs,
  });
  const remetente = fonte.EMAIL_REMETENTE?.trim() || usuario;
  return {
    configurado: true,
    async enviar(m) {
      try {
        await transporte.sendMail({
          from: remetente,
          to: m.para,
          subject: m.assunto,
          text: m.texto,
          ...(m.html ? { html: m.html } : {}),
        });
        return { enviado: true };
      } catch (erro) {
        const e = erro as ErroSmtp;
        const motivo = motivoFalhaEmail(erro, { host, porta, tempoLimiteMs });
        log?.warn(
          { codigo: e.code, respostaSmtp: e.responseCode, comando: e.command, motivo },
          'falha ao enviar e-mail',
        );
        return { enviado: false, motivo };
      }
    },
  };
}

/**
 * Envia sem segurar a resposta além de `prazoMs`: se o servidor demorar, devolve na hora um
 * resultado "não enviado" que explica a demora, e o envio segue em segundo plano com o desfecho
 * registrado no log. Nunca rejeita.
 */
export async function enviarComPrazo(
  enviador: EnviadorEmail,
  m: Mensagem,
  log?: Log,
): Promise<ResultadoEnvio> {
  const prazoMs = enviador.prazoMs ?? PRAZO_RESPOSTA_EMAIL_MS;
  const envio = enviador.enviar(m).catch((erro: unknown): ResultadoEnvio => ({
    enviado: false,
    motivo: `Erro inesperado ao enviar o e-mail: ${(erro as Error)?.message ?? String(erro)}.`,
  }));
  let relogio: NodeJS.Timeout | undefined;
  const esgotou = new Promise<'esgotou'>((resolver) => {
    relogio = setTimeout(() => resolver('esgotou'), prazoMs);
  });
  const primeiro = await Promise.race([envio, esgotou]);
  clearTimeout(relogio);
  if (primeiro !== 'esgotou') return primeiro;
  void envio.then((r) => {
    if (r.enviado)
      log?.info?.({ assunto: m.assunto }, 'e-mail enviado depois do prazo de resposta');
    else log?.warn({ assunto: m.assunto, motivo: r.motivo }, 'e-mail não enviado (segundo plano)');
  });
  return {
    enviado: false,
    motivo:
      `O servidor de e-mail não respondeu em ${segundos(prazoMs)}. O envio continua em segundo ` +
      'plano e pode chegar depois; se falhar, o motivo fica no log da API.',
  };
}

/** E-mail simples com um botão; o texto puro leva o mesmo link. */
export function htmlComBotao(titulo: string, paragrafo: string, rotulo: string, link: string) {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1b2430">
<h2 style="font-size:18px">${esc(titulo)}</h2><p style="font-size:14px;line-height:1.5">${esc(paragrafo)}</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#0068FD;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px">${esc(rotulo)}</a></p>
<p style="font-size:12px;color:#6b7785">Se o botão não abrir, copie: ${esc(link)}</p></div>`;
}
