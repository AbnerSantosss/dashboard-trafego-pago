/**
 * Envio de e-mail sem banco: servidores SMTP falsos em 127.0.0.1 (um mudo, um que recusa a senha)
 * provam que o envio desiste no tempo-limite e devolve o motivo em português, e `enviarComPrazo`
 * responde antes do prazo mesmo com o SMTP pendurado.
 */
import { createServer, type Server, type Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  criarEnviadorEmail,
  enviarComPrazo,
  motivoFalhaEmail,
  type EnviadorEmail,
  type ResultadoEnvio,
} from './email.js';

const MSG = { para: 'pessoa@teste.local', assunto: 'Convite', texto: 'link' };
const servidores: Server[] = [];
const conexoes: Socket[] = [];

/** Sobe um servidor TCP local; `aoConectar` decide o que ele responde. */
async function servidor(aoConectar: (s: Socket) => void): Promise<number> {
  const srv = createServer((s) => {
    conexoes.push(s);
    s.on('error', () => {});
    aoConectar(s);
  });
  servidores.push(srv);
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
  return (srv.address() as { port: number }).port;
}

const fonte = (porta: number) => ({
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: String(porta),
  SMTP_USUARIO: 'usuario@teste.local',
  SMTP_SENHA: 'senha-de-teste',
});

afterEach(async () => {
  for (const s of conexoes.splice(0)) s.destroy();
  await Promise.all(servidores.splice(0).map((s) => new Promise((ok) => s.close(ok))));
});

describe('criarEnviadorEmail', () => {
  it('sem SMTP, diz exatamente quais variáveis faltam', async () => {
    const e = criarEnviadorEmail({ SMTP_HOST: 'smtp.exemplo.com' });
    expect(e.configurado).toBe(false);
    expect(await e.enviar(MSG)).toEqual({
      enviado: false,
      motivo: 'O envio de e-mail não está configurado na API (falta SMTP_USUARIO, SMTP_SENHA).',
    });
  });

  it('servidor que aceita a conexão e não fala nada: desiste no tempo-limite, com o motivo', async () => {
    const porta = await servidor(() => {}); // nunca manda a saudação 220
    const log = { warn: vi.fn() };
    const e = criarEnviadorEmail(fonte(porta), log, { tempoLimiteMs: 300 });
    const inicio = Date.now();
    const r = await e.enviar(MSG);
    // Bem abaixo dos 4 s em que o web desiste (antes, o nodemailer esperava 30 s pela saudação).
    expect(Date.now() - inicio).toBeLessThan(2_000);
    expect(r).toEqual({
      enviado: false,
      motivo: expect.stringContaining(
        `O servidor de e-mail 127.0.0.1:${porta} não respondeu em 0,3 s`,
      ),
    });
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ codigo: 'ETIMEDOUT' }),
      'falha ao enviar e-mail',
    );
    // Nem usuário nem senha do SMTP vão para o log.
    expect(JSON.stringify(log.warn.mock.calls)).not.toMatch(/usuario@teste|senha-de-teste/);
  });

  it('senha recusada pelo servidor vira motivo que aponta SMTP_USUARIO/SMTP_SENHA', async () => {
    const porta = await servidor((s) => {
      s.write('220 smtp.teste ESMTP\r\n');
      s.on('data', (d) => {
        const linha = d.toString();
        if (/^EHLO/i.test(linha)) s.write('250-smtp.teste\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (/^AUTH/i.test(linha)) s.write('535 5.7.8 Username and Password not accepted\r\n');
        else if (/^QUIT/i.test(linha)) s.end('221 tchau\r\n');
      });
    });
    const r = await criarEnviadorEmail(fonte(porta), undefined, { tempoLimiteMs: 2_000 }).enviar(
      MSG,
    );
    expect(r.enviado).toBe(false);
    const { motivo } = r as Extract<ResultadoEnvio, { enviado: false }>;
    expect(motivo).toContain('recusou o login: confira SMTP_USUARIO e SMTP_SENHA');
    expect(motivo).toContain('Username and Password not accepted');
  });
});

describe('motivoFalhaEmail', () => {
  const srv = { host: 'smtp.gmail.com', porta: 465 };
  it.each([
    ['EDNS', 'O endereço do servidor de e-mail "smtp.gmail.com" não foi encontrado'],
    ['ECONNECTION', 'Não foi possível conectar ao servidor de e-mail smtp.gmail.com:465'],
    ['ETLS', 'Falha na conexão segura (TLS) com smtp.gmail.com:465'],
    ['EENVELOPE', 'recusou o remetente ou o destinatário'],
    ['EQUALQUER', 'smtp.gmail.com:465 recusou o envio (EQUALQUER)'],
  ])('%s', (code, trecho) => {
    expect(motivoFalhaEmail({ code, message: 'x' }, srv)).toContain(trecho);
  });
});

describe('enviarComPrazo', () => {
  it('SMTP lento: responde no prazo dizendo que não confirmou, e loga o desfecho depois', async () => {
    let terminar: (r: ResultadoEnvio) => void = () => {};
    const lento: EnviadorEmail = {
      configurado: true,
      prazoMs: 30,
      enviar: () => new Promise((ok) => (terminar = ok)),
    };
    const log = { warn: vi.fn(), info: vi.fn() };
    const r = await enviarComPrazo(lento, MSG, log);
    expect(r).toEqual({
      enviado: false,
      motivo: expect.stringContaining('O servidor de e-mail não respondeu em 0,03 s'),
    });
    terminar({ enviado: false, motivo: 'senha recusada' });
    await vi.waitFor(() =>
      expect(log.warn).toHaveBeenCalledWith(
        expect.objectContaining({ motivo: 'senha recusada' }),
        'e-mail não enviado (segundo plano)',
      ),
    );
  });

  it('dentro do prazo, devolve o resultado do envio; exceção vira motivo', async () => {
    const rapido: EnviadorEmail = { configurado: true, enviar: async () => ({ enviado: true }) };
    expect(await enviarComPrazo(rapido, MSG)).toEqual({ enviado: true });
    const quebrado: EnviadorEmail = {
      configurado: true,
      enviar: async () => {
        throw new Error('boom');
      },
    };
    expect(await enviarComPrazo(quebrado, MSG)).toEqual({
      enviado: false,
      motivo: 'Erro inesperado ao enviar o e-mail: boom.',
    });
  });
});
