/**
 * Envio de e-mail por SMTP (convites e redefinição de senha).
 * Configuração só por variáveis de ambiente (SMTP_HOST, SMTP_PORT, SMTP_USUARIO, SMTP_SENHA,
 * EMAIL_REMETENTE). Sem SMTP configurado, nada é enviado: a função devolve `false` e quem chamou
 * decide o que fazer (o convite devolve o link para o admin copiar).
 */
import nodemailer from 'nodemailer';

export interface Mensagem {
  para: string;
  assunto: string;
  texto: string;
  html?: string;
}

export interface EnviadorEmail {
  configurado: boolean;
  enviar(m: Mensagem): Promise<boolean>;
}

export function criarEnviadorEmail(
  fonte: Record<string, string | undefined> = process.env,
  log?: { warn(o: object, msg: string): void },
): EnviadorEmail {
  const host = fonte.SMTP_HOST?.trim();
  const usuario = fonte.SMTP_USUARIO?.trim();
  const senha = fonte.SMTP_SENHA;
  if (!host || !usuario || !senha) {
    return { configurado: false, enviar: async () => false };
  }
  const porta = Number(fonte.SMTP_PORT ?? 465);
  const transporte = nodemailer.createTransport({
    host,
    port: porta,
    secure: porta === 465,
    auth: { user: usuario, pass: senha },
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
        return true;
      } catch (erro) {
        log?.warn({ codigo: (erro as { code?: string }).code }, 'falha ao enviar e-mail');
        return false;
      }
    },
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
