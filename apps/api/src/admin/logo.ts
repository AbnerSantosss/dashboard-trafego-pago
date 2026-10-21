/**
 * Validação do logo enviado em `PATCH /empresas/atual/apresentacao` (PNG ou SVG em base64).
 * Confere o tipo real pelo conteúdo e recusa SVG com conteúdo ativo.
 */
import { LOGO_TAMANHO_MAXIMO, type LogoTipo } from '@trafego/contratos';
import { ErroApi } from '../erros.js';

const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// O logo só aparece em <img> (onde o SVG não roda script), mas a lista vale se um dia for inline:
// eventos colados em aspas ou barra, entidades que escondem "javascript:", animação que troca
// href, ENTITY e referência externa (só #id e data:image passam).
const PROIBIDOS_SVG = [
  /<script/i,
  /[\s/"']on[a-z]+\s*=/i,
  /javascript:/i,
  /<foreignObject/i,
  /&#/,
  /<!ENTITY/i,
  /<(animate|set)\b[^>]*attributeName\s*=\s*["']?(xlink:)?href/i,
  /href\s*=\s*(?!["']?\s*(#|data:image\/))/i,
];

const invalido = (mensagem: string) => ErroApi.de('logo_invalido', mensagem);

/** Valida e devolve a URL `data:<tipo>;base64,...` a gravar em `presentation.logo_url`. */
export function validarLogo(tipo: LogoTipo, base64: string): string {
  const limpo = base64.replace(/\s+/g, '');
  if (!limpo || limpo.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(limpo)) {
    throw invalido('O logo não é um base64 válido.');
  }
  const bytes = Buffer.from(limpo, 'base64');
  if (bytes.length > LOGO_TAMANHO_MAXIMO) {
    throw ErroApi.de('logo_grande', `O logo passa de ${LOGO_TAMANHO_MAXIMO / 1024} KB.`, {
      limiteBytes: LOGO_TAMANHO_MAXIMO,
    });
  }
  if (tipo === 'image/png') {
    if (bytes.length < 8 || !bytes.subarray(0, 8).equals(ASSINATURA_PNG)) {
      throw invalido('O arquivo não é um PNG.');
    }
  } else {
    let texto: string;
    try {
      texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw invalido('O SVG não está em UTF-8.');
    }
    // Raiz <svg>, permitindo BOM (coberto por \s), declaração XML, comentários e doctype antes.
    const semPrologo = texto.replace(
      /^\s*(<\?xml[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|\s)*/i,
      '',
    );
    if (!/^<svg[\s>]/i.test(semPrologo)) throw invalido('O arquivo não tem raiz <svg>.');
    if (PROIBIDOS_SVG.some((r) => r.test(texto))) {
      throw invalido(
        'O SVG contém script, eventos, javascript:, foreignObject, entidades ou link externo.',
      );
    }
  }
  return `data:${tipo};base64,${bytes.toString('base64')}`;
}
