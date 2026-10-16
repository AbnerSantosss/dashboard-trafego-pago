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
  const email: EnviadorEmail = {
    configurado: true,
    enviar: async (m) => {
      caixa.push(m);
      return true;
    },
  };
  const db = criarDb(URL_APP, { max: 1 });
  let convidado = '';

  const tokenDoUltimo = () => {
    const m = /token=([^\s"&]+)/.exec(caixa.at(-1)!.texto);
    return decodeURIComponent(m![1]!);
  };

  beforeAll(async () => {
    cen = await criarCenario(['leitor', 'admin']);
    convidado = `convidado-${cen.sufixo}@teste.local`;
    app = await buildApp({
      env: carregarEnv({ NODE_ENV: 'test', DATABASE_URL: URL_APP }),
      logger: false,
      email,
    });
  });

  afterAll(async () => {
    await app?.close();
    await db.delete(users).where(eq(users.email, convidado));
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
      .select({ h: sql<string>`left(${users.senhaHash}, 3)` })
      .from(users)
      .where(eq(users.id, idBruno));
    expect(hash!.h).toBe('s1$');
  });
});
