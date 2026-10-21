import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cookies da requisição em memória: o que a action lê e apaga.
const cookies = new Map<string, string>();
const sairApi = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (nome: string) => (cookies.has(nome) ? { value: cookies.get(nome) } : undefined),
    set: (nome: string, valor: string) => cookies.set(nome, valor),
    delete: (nome: string) => cookies.delete(nome),
  }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: () => ({ sair: sairApi }) }));

const { redirect } = await import('next/navigation');
const { sair } = await import('@/app/(conta)/acoes');

describe('action sair()', () => {
  beforeEach(() => {
    cookies.clear();
    cookies.set('sessao', 'tok-atual');
    cookies.set('empresa', 'pasio');
    cookies.set('ja_entrou', '1');
    sairApi.mockReset();
    vi.mocked(redirect).mockClear();
  });

  it('invalida o token na API antes de apagar os cookies', async () => {
    sairApi.mockImplementation(async () => {
      // na hora da chamada o cookie ainda existe
      expect(cookies.get('sessao')).toBe('tok-atual');
      return { ok: true, dados: null };
    });
    await sair();
    expect(sairApi).toHaveBeenCalledWith('tok-atual');
    expect(cookies.has('sessao')).toBe(false);
    expect(cookies.has('empresa')).toBe(false);
    expect(cookies.get('ja_entrou')).toBe('1');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('com a API fora ou recusando, apaga os cookies e sai do mesmo jeito', async () => {
    sairApi.mockResolvedValueOnce({ ok: false, mensagem: 'API indisponível: fetch failed' });
    await sair();
    expect(cookies.has('sessao')).toBe(false);
    expect(redirect).toHaveBeenCalledWith('/login');

    cookies.set('sessao', 'tok-atual');
    sairApi.mockRejectedValueOnce(new Error('imprevisto'));
    await sair();
    expect(cookies.has('sessao')).toBe(false);
    expect(redirect).toHaveBeenCalledTimes(2);
  });

  it('sem cookie de sessão não chama a API', async () => {
    cookies.delete('sessao');
    await sair();
    expect(sairApi).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
