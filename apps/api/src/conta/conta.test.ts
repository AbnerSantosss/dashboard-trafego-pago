/**
 * Conta e usuários com o Postgres local: definir senha por e-mail, login, perfil, convite
 * (admin convida, convidado aceita) e permissões. E-mail falso que guarda as mensagens.
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../app.js';
import { bancoDisponivel, criarCenario, URL_APP, type Cenario } from '../auth/banco-teste.js';
import { criarDb, users } from '../db/client.js';
import { carregarEnv } from '../env.js';
import type { EnviadorEmail } from './email.js';
import { criarTentativas } from './tentativas.js';
import { codigoTotp, passoAtual } from './totp.js';

const disponivel = await bancoDisponivel('conta/conta.test');

interface Mensagem {
  para: string;
  assunto: string;
  texto: string;
}

describe.skipIf(!disponivel)('conta e convites', () => {
  let app: App;
  let cen: Cenario;
  const caixa: Mensagem[] = [];
  const enviarNormal: EnviadorEmail['enviar'] = async (m) => {
    caixa.push(m);
    return { enviado: true };
  };
  const email: EnviadorEmail = { configurado: true, enviar: enviarNormal };
  const db = criarDb(URL_APP, { max: 1 });
  let convidado = '';
  let semSenha = '';

  const tokenDoUltimo = () => {
    const m = /token=([^\s"&]+)/.exec(caixa.at(-1)!.texto);
    return decodeURIComponent(m![1]!);
  };

  beforeAll(async () => {
    cen = await criarCenario(['leitor', 'admin']);
    convidado = `convidado-${cen.sufixo}@teste.local`;
    semSenha = `sem-senha-${cen.sufixo}@teste.local`;
    app = await buildApp({
      env: carregarEnv({ NODE_ENV: 'test', DATABASE_URL: URL_APP }),
      logger: false,
      email,
      tentativas: criarTentativas({ maxFalhas: 3 }),
    });
  });

  afterAll(async () => {
    await app?.close();
    await db.delete(users).where(eq(users.email, convidado));
    await db.delete(users).where(eq(users.email, semSenha));
    await db.$client.end({ timeout: 5 });
    await cen?.limpar();
  });

  let token = '';

  it('define a senha pelo link do e-mail e faz login', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/auth/recuperar',
      payload: { email: cen.usuario.email.toUpperCase() },
    });
    expect(r.statusCode).toBe(204);
    expect(caixa.at(-1)!.para).toBe(cen.usuario.email);

    const linkToken = tokenDoUltimo();
    const def = await app.inject({
      method: 'POST',
      url: '/auth/redefinir',
      payload: { token: linkToken, senha: 'senha-forte-123' },
    });
    expect(def.statusCode).toBe(200);

    // Link de uso único: a versão da senha mudou.
    const de2 = await app.inject({
      method: 'POST',
      url: '/auth/redefinir',
      payload: { token: linkToken, senha: 'outra-senha-456' },
    });
    expect(de2.statusCode).toBe(401);

    const errada = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: cen.usuario.email, senha: 'errada-errada' },
    });
    expect(errada.statusCode).toBe(401);

    const ok = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: cen.usuario.email, senha: 'senha-forte-123' },
    });
    expect(ok.statusCode).toBe(200);
    token = ok.json().token;
    expect(ok.json().empresas).toHaveLength(2);
  });

  it('e-mail desconhecido também responde 204 e não envia nada', async () => {
    const antes = caixa.length;
    const r = await app.inject({
      method: 'POST',
      url: '/auth/recuperar',
      payload: { email: `ninguem-${cen.sufixo}@teste.local` },
    });
    expect(r.statusCode).toBe(204);
    expect(caixa.length).toBe(antes);
  });

  it('atualiza nome e sobrenome; trocar senha exige a atual', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const p = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: auth,
      payload: { nome: 'Ana', sobrenome: 'Souza' },
    });
    expect(p.statusCode).toBe(200);
    expect(p.json().usuario).toMatchObject({ nome: 'Ana', sobrenome: 'Souza' });

    const me = await app.inject({ method: 'GET', url: '/me', headers: auth });
    expect(me.json().usuario.sobrenome).toBe('Souza');

    const sem = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: auth,
      payload: { senhaAtual: 'errada-errada', novaSenha: 'nova-senha-789' },
    });
    expect(sem.statusCode).toBe(403);
  });

  it('lembrar de mim dá 30 dias; trocar a senha derruba as outras sessões', async () => {
    const vence = (t: string) =>
      JSON.parse(Buffer.from(t.split('.')[1]!, 'base64url').toString()).exp -
      Math.floor(Date.now() / 1000);
    const login = (lembrar?: boolean) =>
      app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: cen.usuario.email, senha: 'senha-forte-123', lembrar },
      });
    const curto = (await login()).json().token as string;
    const longo = (await login(true)).json().token as string;
    expect(vence(curto)).toBeLessThanOrEqual(12 * 3600);
    expect(vence(longo)).toBeGreaterThan(29 * 24 * 3600);

    // Trocar empresa mantém o prazo do token de "lembrar de mim".
    const troca = await app.inject({
      method: 'POST',
      url: '/me/empresa',
      headers: { authorization: `Bearer ${longo}` },
      payload: { empresa: cen.t2.slug },
    });
    expect(troca.statusCode).toBe(200);
    expect(vence(troca.json().token)).toBeGreaterThan(29 * 24 * 3600);

    const trocou = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { authorization: `Bearer ${longo}` },
      payload: { senhaAtual: 'senha-forte-123', novaSenha: 'senha-nova-456' },
    });
    expect(trocou.statusCode).toBe(200);
    const novo = trocou.json().token as string;
    expect(vence(novo)).toBeGreaterThan(29 * 24 * 3600);

    const velho = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${curto}` },
    });
    expect(velho.statusCode).toBe(401);
    expect(velho.json().erro.mensagem).toMatch(/senha foi trocada/);
    const atual = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${novo}` },
    });
    expect(atual.statusCode).toBe(200);
    token = novo;
  });

  it('só admin convida; o convidado aceita e passa a ver a empresa', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const leitor = await app.inject({
      method: 'POST',
      url: '/empresas/atual/convites',
      headers: { ...auth, 'x-tenant': cen.t1.id },
      payload: { email: convidado },
    });
    expect(leitor.statusCode).toBe(403);

    const c = await app.inject({
      method: 'POST',
      url: '/empresas/atual/convites',
      headers: { ...auth, 'x-tenant': cen.t2.id },
      payload: { email: convidado.toUpperCase(), papel: 'leitor' },
    });
    expect(c.statusCode).toBe(201);
    expect(c.json()).toMatchObject({ emailEnviado: true, convite: { email: convidado } });
    const conviteToken = tokenDoUltimo();
    expect(c.json().link).toContain(encodeURIComponent(conviteToken));

    const lista = await app.inject({
      method: 'GET',
      url: '/empresas/atual/usuarios',
      headers: { ...auth, 'x-tenant': cen.t2.id },
    });
    expect(lista.json().convites).toHaveLength(1);
    expect(lista.json().membros).toHaveLength(1);

    const info = await app.inject({ method: 'GET', url: `/convites/${conviteToken}` });
    expect(info.statusCode).toBe(200);
    expect(info.json()).toMatchObject({ email: convidado, jaTemSenha: false });

    const aceite = await app.inject({
      method: 'POST',
      url: `/convites/${conviteToken}/aceitar`,
      payload: { nome: 'Bruno', sobrenome: 'Lima', senha: 'senha-do-bruno' },
    });
    expect(aceite.statusCode).toBe(200);
    expect(aceite.json().empresas.map((e: { id: string }) => e.id)).toEqual([cen.t2.id]);

    // Convite usado não abre de novo.
    const de2 = await app.inject({ method: 'GET', url: `/convites/${conviteToken}` });
    expect(de2.statusCode).toBe(404);

    const depois = await app.inject({
      method: 'GET',
      url: '/empresas/atual/usuarios',
      headers: { ...auth, 'x-tenant': cen.t2.id },
    });
    expect(depois.json().convites).toHaveLength(0);
    expect(depois.json().membros).toHaveLength(2);

    // Convidar quem já é membro dá conflito.
    const dup = await app.inject({
      method: 'POST',
      url: '/empresas/atual/convites',
      headers: { ...auth, 'x-tenant': cen.t2.id },
      payload: { email: convidado },
    });
    expect(dup.statusCode).toBe(409);

    // Admin não remove a si mesmo; remove o convidado.
    const eu = await app.inject({
      method: 'DELETE',
      url: `/empresas/atual/usuarios/${cen.usuario.id}`,
      headers: { ...auth, 'x-tenant': cen.t2.id },
    });
    expect(eu.statusCode).toBe(403);
    const idBruno = aceite.json().usuario.id;
    const rm = await app.inject({
      method: 'DELETE',
      url: `/empresas/atual/usuarios/${idBruno}`,
      headers: { ...auth, 'x-tenant': cen.t2.id },
    });
    expect(rm.statusCode).toBe(204);

    const [hash] = await db
      .select({ h: sql<string>`left(${users.senhaHash}, 10)` })
      .from(users)
      .where(eq(users.id, idBruno));
    expect(hash!.h).toBe('$argon2id$');
  });

  it('SMTP pendurado não segura convite nem "esqueci a senha"; o convite diz o motivo', async () => {
    const pendurado = `pendurado-${cen.sufixo}@teste.local`;
    // Servidor de e-mail que nunca responde (como a porta bloqueada em produção).
    email.enviar = () => new Promise(() => {});
    email.prazoMs = 50;
    try {
      const inicio = Date.now();
      const c = await app.inject({
        method: 'POST',
        url: '/empresas/atual/convites',
        headers: { authorization: `Bearer ${token}`, 'x-tenant': cen.t2.id },
        payload: { email: pendurado, papel: 'leitor' },
      });
      expect(c.statusCode).toBe(201);
      expect(c.json()).toMatchObject({
        emailEnviado: false,
        motivoEmail: expect.stringContaining('O servidor de e-mail não respondeu'),
        convite: { email: pendurado },
      });
      expect(c.json().link).toContain('/convite?token=');

      const rec = await app.inject({
        method: 'POST',
        url: '/auth/recuperar',
        payload: { email: cen.usuario.email },
      });
      expect(rec.statusCode).toBe(204);
      // Os 4 s em que o web desiste ficam longe.
      expect(Date.now() - inicio).toBeLessThan(2_000);

      const lista = await app.inject({
        method: 'GET',
        url: '/empresas/atual/usuarios',
        headers: { authorization: `Bearer ${token}`, 'x-tenant': cen.t2.id },
      });
      expect(lista.json().convites.map((x: { email: string }) => x.email)).toContain(pendurado);
    } finally {
      email.enviar = enviarNormal;
      delete email.prazoMs;
    }
  });

  it('convite para conta que existe sem senha é recusado e não define a senha dela', async () => {
    await db.insert(users).values({ email: semSenha, nome: 'Sem Senha' });
    const c = await app.inject({
      method: 'POST',
      url: '/empresas/atual/convites',
      headers: { authorization: `Bearer ${token}`, 'x-tenant': cen.t2.id },
      payload: { email: semSenha, papel: 'leitor' },
    });
    expect(c.statusCode).toBe(201);
    const conviteToken = tokenDoUltimo();
    const aceite = await app.inject({
      method: 'POST',
      url: `/convites/${conviteToken}/aceitar`,
      payload: { nome: 'Intruso', senha: 'senha-do-intruso' },
    });
    expect(aceite.statusCode).toBe(409);
    expect(aceite.json().erro.mensagem).toMatch(/Esqueci minha senha/);
    const [u] = await db
      .select({ senhaHash: users.senhaHash, nome: users.nome })
      .from(users)
      .where(eq(users.email, semSenha));
    expect(u).toEqual({ senhaHash: null, nome: 'Sem Senha' });
    // O convite continua aberto para o dono usar depois de criar a senha.
    const info = await app.inject({ method: 'GET', url: `/convites/${conviteToken}` });
    expect(info.statusCode).toBe(200);
  });

  it('bloqueia o e-mail depois de 3 senhas erradas, exista ou não a conta', async () => {
    const alvo = `alvo-${cen.sufixo}@teste.local`;
    const tentar = () =>
      app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: alvo, senha: 'chute-chute' },
      });
    for (let i = 0; i < 3; i++) expect((await tentar()).statusCode).toBe(401);
    const travado = await tentar();
    expect(travado.statusCode).toBe(429);
    expect(travado.json().erro.mensagem).toMatch(/Muitas tentativas com este e-mail/);
  });

  it('sair encerra as sessões abertas; um login novo volta a valer', async () => {
    const auth = { authorization: `Bearer ${token}` };
    const sair = await app.inject({ method: 'POST', url: '/auth/sair', headers: auth });
    expect(sair.statusCode).toBe(204);
    const me = await app.inject({ method: 'GET', url: '/me', headers: auth });
    expect(me.statusCode).toBe(401);
    expect(me.json().erro.mensagem).toMatch(/você saiu da conta/);

    // O iat é em segundos: o login novo precisa cair no segundo seguinte ao sair.
    await new Promise((r) => setTimeout(r, 1100));
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: cen.usuario.email, senha: 'senha-nova-456' },
    });
    expect(login.statusCode).toBe(200);
    const novo = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${login.json().token}` },
    });
    expect(novo.statusCode).toBe(200);
  });

  it('duas etapas: opcional, ligada no perfil; o login pede o código e não aceita repetido', async () => {
    const senha = 'senha-nova-456';
    // Outro IP: o arquivo já gastou o limite de 10 logins por minuto do 127.0.0.1.
    const ip = { remoteAddress: '198.51.100.20' };
    const entrar = () =>
      app.inject({
        ...ip,
        method: 'POST',
        url: '/auth/login',
        payload: { email: cen.usuario.email, senha },
      });
    const auth = { authorization: `Bearer ${(await entrar()).json().token}` };
    const me = () =>
      app.inject({
        ...ip,
        method: 'GET',
        url: '/me',
        headers: auth,
      });
    expect((await me()).json().duasEtapas).toBe(false);

    const iniciar = (senhaAtual: string) =>
      app.inject({
        ...ip,
        method: 'POST',
        url: '/me/duas-etapas/iniciar',
        headers: auth,
        payload: { senhaAtual },
      });
    expect((await iniciar('errada-errada')).statusCode).toBe(403);
    const ini = await iniciar(senha);
    expect(ini.statusCode).toBe(200);
    const { segredo, uri } = ini.json();
    expect(uri).toContain(encodeURIComponent(cen.usuario.email));
    // Pendente: o login segue sem código até confirmar.
    const pendente = await entrar();
    expect(pendente.json(), pendente.body).toHaveProperty('token');

    // Três passos seguidos dentro da janela (anterior, atual, seguinte); evita a virada dos 30 s.
    if (Date.now() % 30_000 > 25_000) await new Promise((r) => setTimeout(r, 5_500));
    const p = passoAtual();
    const valido = new Set([p - 1, p, p + 1].map((x) => codigoTotp(segredo, x)));
    let errado = '000000';
    while (valido.has(errado)) errado = String(Number(errado) + 1).padStart(6, '0');

    const ativar = (codigo: string) =>
      app.inject({
        ...ip,
        method: 'POST',
        url: '/me/duas-etapas/ativar',
        headers: auth,
        payload: { codigo },
      });
    expect((await ativar(errado)).statusCode).toBe(403);
    expect((await ativar(codigoTotp(segredo, p - 1))).statusCode).toBe(204);
    expect((await me()).json().duasEtapas).toBe(true);

    const login = await entrar();
    expect(login.statusCode).toBe(200);
    expect(login.json().token).toBeUndefined();
    const { desafio, segundoFator } = login.json();
    expect(segundoFator).toBe(true);
    // O desafio não serve como token de acesso.
    const comDesafio = await app.inject({
      ...ip,
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${desafio}` },
    });
    expect(comDesafio.statusCode).toBe(401);

    const confirmar = (d: string, codigo: string) =>
      app.inject({
        ...ip,
        method: 'POST',
        url: '/auth/duas-etapas',
        payload: { desafio: d, codigo },
      });
    // Código já usado na ativação não vale de novo.
    expect((await confirmar(desafio, codigoTotp(segredo, p - 1))).statusCode).toBe(401);
    const adulterado = await confirmar(`${desafio.slice(0, -2)}xx`, codigoTotp(segredo, p));
    expect(adulterado.json().erro.codigo).toBe('token_invalido');
    const ok = await confirmar(desafio, codigoTotp(segredo, p));
    expect(ok.statusCode).toBe(200);
    expect(ok.json().token).toBeTruthy();

    const desativar = (senhaAtual: string, codigo: string) =>
      app.inject({
        ...ip,
        method: 'POST',
        url: '/me/duas-etapas/desativar',
        headers: auth,
        payload: { senhaAtual, codigo },
      });
    expect((await desativar(senha, codigoTotp(segredo, p))).statusCode).toBe(403);
    expect((await desativar(senha, codigoTotp(segredo, p + 1))).statusCode).toBe(204);
    expect((await me()).json().duasEtapas).toBe(false);
    expect((await entrar()).json().token).toBeTruthy();
  }, 20_000);
});
