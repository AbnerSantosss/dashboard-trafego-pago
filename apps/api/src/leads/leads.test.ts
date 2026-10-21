/**
 * Lista por etapa do funil e ficha do lead contra a amostra `demo-*` do seed da PASIO.
 * Pula com aviso se o Postgres não responder.
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { appComBanco, bancoDisponivel, URL_APP } from '../auth/banco-teste.js';
import { emitirToken } from '../auth/plugin.js';
import { comTenant, criarDb, memberships, users } from '../db/client.js';
import { executarSeed } from '../db/seed.js';
import { mascararPayload } from './rotas.js';

const disponivel = await bancoDisponivel('leads/leads.test');

describe('mascararPayload', () => {
  it('mascara senha, token e cartão em qualquer nível e preserva o resto', () => {
    const saida = mascararPayload({
      user_id: 'u-1',
      password: 'x',
      dados: { api_token: 'y', cartao: { numero: '4111' }, valor: 10 },
      lista: [{ secret: 'z', ok: true }],
    });
    expect(saida).toEqual({
      user_id: 'u-1',
      password: '••••',
      dados: { api_token: '••••', cartao: '••••', valor: 10 },
      lista: [{ secret: '••••', ok: true }],
    });
  });

  it('mascara documento e credencial e deixa só parte do contato', () => {
    const saida = mascararPayload({
      cpf: '123.456.789-00',
      user_rg: '12345',
      pix_key: 'chave',
      Authorization: 'Basic abc',
      pin: '1234',
      shipping: 'mantém',
      author: 'mantém',
      email: 'jogador@exemplo.com',
      telefone: '+55 (11) 98765-4321',
      phone: '123',
      emailEnviado: true,
    });
    expect(saida).toEqual({
      cpf: '••••',
      user_rg: '••••',
      pix_key: '••••',
      Authorization: '••••',
      pin: '••••',
      shipping: 'mantém',
      author: 'mantém',
      email: 'j•••@exemplo.com',
      telefone: '••••4321',
      phone: '••••',
      emailEnviado: true,
    });
  });
});

describe.skipIf(!disponivel)('GET /empresas/atual/eventos e /leads/:leadKey', () => {
  const db = criarDb(URL_APP, { max: 2 });
  let app: App;
  let tokenAdmin = '';
  let tokenLeitor = '';
  let leitor = '';

  beforeAll(async () => {
    const seed = await executarSeed(db);
    const [u] = await db.select().from(users).where(eq(users.id, seed.userId));
    app = await appComBanco();
    await app.ready();
    tokenAdmin = emitirToken(app, { sub: seed.userId, email: u!.email, tenant: seed.tenantId });

    const email = `leads-leitor-${randomUUID().slice(0, 8)}@teste.local`;
    const [ul] = await db.insert(users).values({ email, nome: 'Leitor' }).returning();
    leitor = ul!.id;
    await comTenant(db, seed.tenantId, (tx) =>
      tx.insert(memberships).values({ tenantId: seed.tenantId, userId: leitor, role: 'leitor' }),
    );
    tokenLeitor = emitirToken(app, { sub: leitor, email, tenant: seed.tenantId });
  });

  afterAll(async () => {
    await app?.close();
    if (leitor) await db.delete(users).where(eq(users.id, leitor));
    await db.$client.end({ timeout: 5 });
  });

  const get = (url: string, token = tokenAdmin) =>
    app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

  it('FTDs do período: total, valor, ordem e total por canal', async () => {
    const res = await get('/empresas/atual/eventos?etapa=ftd&de=2024-05-01&ate=2024-05-24');
    expect(res.statusCode).toBe(200);
    const c = res.json();
    expect(c.total).toBe(18);
    expect(c.fuso).toBe('America/Sao_Paulo');
    expect(c.valorTotal).toBe(2270);
    expect(c.eventos).toHaveLength(18);
    expect(c.eventos.every((e: { tipo: string }) => e.tipo === 'ftd')).toBe(true);
    const datas = c.eventos.map((e: { ocorridoEm: string }) => e.ocorridoEm);
    expect([...datas].sort().reverse()).toEqual(datas);
    expect(c.eventos[0].leadKey).toBe('demo-1036');
    const somaCanais = c.porCanal.reduce((s: number, x: { total: number }) => s + x.total, 0);
    expect(somaCanais).toBe(18);
    const totais = c.porCanal.map((x: { total: number }) => x.total);
    expect([...totais].sort((a, b) => b - a)).toEqual(totais);
  });

  it('filtro de canal, limite e etapas sem registro por pessoa', async () => {
    const afiliados = await get(
      '/empresas/atual/eventos?etapa=ftd&de=2024-05-01&ate=2024-05-24&canal=Afiliados&limite=2',
    );
    const c = afiliados.json();
    expect(c.eventos).toHaveLength(2);
    expect(c.total).toBeGreaterThan(2);
    expect(c.eventos.every((e: { canal: string }) => e.canal === 'Afiliados')).toBe(true);

    const cadastros = await get(
      '/empresas/atual/eventos?etapa=cadastro&de=2024-05-01&ate=2024-05-24',
    );
    expect(cadastros.json().total).toBe(36);
    expect(cadastros.json().valorTotal).toBeNull();

    const base = await get('/empresas/atual/eventos?etapa=base&de=2024-05-01&ate=2024-05-24');
    expect(base.statusCode).toBe(200);
    expect(base.json().eventos).toEqual([]);

    expect((await get('/empresas/atual/eventos?etapa=xyz')).statusCode).toBe(400);
  });

  it('depósitos, busca, ordem, paginação e opções de filtro (tela expandida)', async () => {
    const P = 'de=2024-05-01&ate=2024-05-24';
    const dep = (await get(`/empresas/atual/eventos?etapa=depositos&${P}`)).json();
    expect(dep.total).toBeGreaterThan(18);
    expect(dep.valorTotal).toBeGreaterThan(2270);
    const tipos = new Set(dep.eventos.map((e: { tipo: string }) => e.tipo));
    expect([...tipos].sort()).toEqual(['deposito', 'ftd']);

    const porValor = (await get(`/empresas/atual/eventos?etapa=ftd&${P}&ordem=valor`)).json();
    const valores = porValor.eventos.map((e: { valor: number }) => e.valor);
    expect([...valores].sort((a, b) => b - a)).toEqual(valores);
    const antigos = (await get(`/empresas/atual/eventos?etapa=ftd&${P}&ordem=antigos`)).json();
    const datas = antigos.eventos.map((e: { ocorridoEm: string }) => e.ocorridoEm);
    expect([...datas].sort()).toEqual(datas);

    const tudo = (await get(`/empresas/atual/eventos?etapa=ftd&${P}`)).json();
    const pagina = (await get(`/empresas/atual/eventos?etapa=ftd&${P}&offset=2&limite=3`)).json();
    expect(pagina.total).toBe(18);
    expect(pagina.eventos.map((e: { id: string }) => e.id)).toEqual(
      tudo.eventos.slice(2, 5).map((e: { id: string }) => e.id),
    );

    const busca = (await get(`/empresas/atual/eventos?etapa=ftd&${P}&busca=DEMO-1036`)).json();
    expect(busca.total).toBe(1);
    expect(busca.eventos[0].leadKey).toBe('demo-1036');
    // `%` e `_` são texto, não curinga.
    expect((await get(`/empresas/atual/eventos?etapa=ftd&${P}&busca=%25`)).json().total).toBe(0);

    const so = (await get(`/empresas/atual/eventos?etapa=ftd&${P}&canal=Afiliados`)).json();
    expect(so.porCanal.map((x: { canal: string }) => x.canal)).toEqual(['Afiliados']);
    expect(so.opcoes.canais).toEqual(expect.arrayContaining(['Afiliados', 'Meta']));
    expect(so.opcoes.canais.some((c: string) => c.startsWith('__'))).toBe(false);
    expect(so.opcoes.campanhas).toContain('parceiro-tipster');
  });

  it('ficha: origem, resumo, toques com click ids e webhooks', async () => {
    const res = await get('/empresas/atual/leads/demo-1036');
    expect(res.statusCode).toBe(200);
    const f = res.json();
    expect(f.leadKey).toBe('demo-1036');
    expect(f.canalOrigem).toBe('Afiliados');
    expect(f.ftd.valor).toBe(50);
    expect(f.cadastroEm).not.toBeNull();
    expect(f.eventos.map((e: { tipo: string }) => e.tipo)).toEqual(['ftd', 'cadastro', 'visita']);
    expect(f.toques[0].utmSource).toBe('tipster');
    expect(f.webhooks).toHaveLength(2);
    expect(f.webhooks[1].payload.user_id).toBe('demo-1036');

    // Meta: a primeira pessoa da amostra vem com fbclid e fbp.
    const meta = (await get('/empresas/atual/leads/demo-1001')).json();
    expect(meta.canalOrigem).toBe('Meta');
    expect(Object.keys(meta.toques[0].clickIds).sort()).toEqual(['fbclid', 'fbp']);
  });

  it('404 sem registros, 403 para leitor', async () => {
    const nada = await get('/empresas/atual/leads/nao-existe-123');
    expect(nada.statusCode).toBe(404);
    expect(nada.json().erro.codigo).toBe('lead_nao_encontrado');

    expect((await get('/empresas/atual/leads/demo-1036', tokenLeitor)).statusCode).toBe(403);
    expect((await get('/empresas/atual/eventos?etapa=ftd', tokenLeitor)).statusCode).toBe(403);
  });
});
