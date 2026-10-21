import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { carregarEnv, chaveCifraWebhook, ErroEnv } from '../env.js';
import { ErroApi } from '../erros.js';
import { combinarSegredos, obterSegredoDoBanco } from '../webhooks/segredos.js';
import { cifrar, decifrar, derivarChaveDeAuthSecret, lerChaveCifra } from './cifra.js';
import { validarLogo } from './logo.js';

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64');
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  randomBytes(32),
]);

function codigo(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as ErroApi).codigo;
  }
  return undefined;
}

describe('cifra AES-256-GCM', () => {
  const chave = randomBytes(32);

  it('ida e volta no formato v1$iv$tag$ct', () => {
    const enc = cifrar('segredo-x', chave);
    expect(enc.split('$')).toHaveLength(4);
    expect(enc.startsWith('v1$')).toBe(true);
    expect(enc).not.toContain('segredo-x');
    expect(decifrar(enc, chave)).toBe('segredo-x');
  });

  it('chave errada, adulteração ou formato desconhecido → null', () => {
    const enc = cifrar('abc', chave);
    expect(decifrar(enc, randomBytes(32))).toBeNull();
    const p = enc.split('$');
    p[3] = Buffer.from('zzz').toString('base64url');
    expect(decifrar(p.join('$'), chave)).toBeNull();
    expect(decifrar('v2$a$b$c', chave)).toBeNull();
  });

  it('lê chave em hex e base64; recusa tamanho errado', () => {
    const k = randomBytes(32);
    expect(lerChaveCifra(k.toString('hex'))?.equals(k)).toBe(true);
    expect(lerChaveCifra(k.toString('base64'))?.equals(k)).toBe(true);
    expect(lerChaveCifra(k.toString('base64url'))?.equals(k)).toBe(true);
    expect(lerChaveCifra(randomBytes(16).toString('base64'))).toBeNull();
  });
});

describe('env WEBHOOK_CHAVE_CIFRA', () => {
  it('fora de produção deriva de AUTH_SECRET e avisa', () => {
    const env = carregarEnv({ NODE_ENV: 'test' });
    const avisos: string[] = [];
    const chave = chaveCifraWebhook(env, (m) => avisos.push(m));
    expect(chave.equals(derivarChaveDeAuthSecret(env.AUTH_SECRET))).toBe(true);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).not.toContain(env.AUTH_SECRET);
  });

  it('usa a chave informada', () => {
    const k = randomBytes(32);
    const env = carregarEnv({ NODE_ENV: 'test', WEBHOOK_CHAVE_CIFRA: k.toString('hex') });
    expect(chaveCifraWebhook(env).equals(k)).toBe(true);
  });

  it('inválida ou ausente em produção → ErroEnv sem valor', () => {
    expect(() => carregarEnv({ NODE_ENV: 'test', WEBHOOK_CHAVE_CIFRA: 'curta' })).toThrow(ErroEnv);
    const base = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://u:p@h/db',
      AUTH_SECRET: 'x'.repeat(40),
    };
    try {
      carregarEnv(base);
      expect.unreachable();
    } catch (e) {
      expect((e as ErroEnv).variaveis).toContain('WEBHOOK_CHAVE_CIFRA');
    }
    expect(() =>
      carregarEnv({ ...base, WEBHOOK_CHAVE_CIFRA: randomBytes(32).toString('base64') }),
    ).not.toThrow();
  });
});

describe('segredos do banco + fallback', () => {
  const chave = randomBytes(32);
  const fonte = (secretEnc: string | null) => ({
    tenantId: 't',
    tenantSlug: 'e',
    sourceId: 's',
    fonteSlug: 'f',
    secretHash: 'x',
    secretEnc,
  });

  it('banco primeiro, depois o próximo', async () => {
    const obter = combinarSegredos(obterSegredoDoBanco(chave), async () => 'do-mapa');
    expect(await obter(fonte(cifrar('do-banco', chave)))).toBe('do-banco');
    expect(await obter(fonte(null))).toBe('do-mapa');
    expect(await obter(fonte('lixo'))).toBe('do-mapa');
  });
});

describe('validarLogo', () => {
  it('PNG válido vira data URL', () => {
    expect(validarLogo('image/png', b64(PNG))).toBe(`data:image/png;base64,${b64(PNG)}`);
  });

  it('PNG com assinatura errada ou base64 inválido → logo_invalido', () => {
    expect(codigo(() => validarLogo('image/png', b64('não é png')))).toBe('logo_invalido');
    expect(codigo(() => validarLogo('image/png', '@@@'))).toBe('logo_invalido');
    expect(codigo(() => validarLogo('image/svg+xml', b64(PNG)))).toBe('logo_invalido');
  });

  it('acima de 512 KB → logo_grande', () => {
    const grande = Buffer.concat([PNG, Buffer.alloc(512 * 1024)]);
    expect(codigo(() => validarLogo('image/png', b64(grande)))).toBe('logo_grande');
  });

  it('SVG limpo passa, com prólogo XML', () => {
    const svg = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    expect(validarLogo('image/svg+xml', b64(svg))).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('SVG com referência interna e imagem embutida passa', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
      '<defs><path id="p"/></defs><use xlink:href="#p"/><image href="data:image/png;base64,AA=="/></svg>';
    expect(validarLogo('image/svg+xml', b64(svg))).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it.each([
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="x()"></svg>',
    '<svg/onload="x()"></svg>',
    '<svg><a href="javascript:x()"/></svg>',
    '<svg><a href="&#106;avascript:x()"/></svg>',
    '<svg><image href="https://rastreio.exemplo/x.png"/></svg>',
    '<svg><a><set attributeName="href" to="x"/></a></svg>',
    '<!DOCTYPE svg [<!ENTITY e "x">]><svg/>',
    '<svg><foreignObject/></svg>',
    '<html><svg/></html>',
  ])('SVG perigoso ou sem raiz → logo_invalido: %s', (svg) => {
    expect(codigo(() => validarLogo('image/svg+xml', b64(svg)))).toBe('logo_invalido');
  });
});
