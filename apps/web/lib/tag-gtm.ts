/**
 * Gera a Tag HTML personalizada do GTM que manda os dados de atribuição para
 * `POST <api>/t/<empresa>/clk` (rota em `apps/api/src/atribuicao/rotas.ts`).
 *
 * Comportamento da tag (ES5, roda em qualquer navegador e no editor do GTM):
 * - click ids (gclid, gbraid, wbraid, fbclid, ttclid, clickid do Kwai, tblci do Taboola) e utms
 *   ficam guardados no localStorage com prefixo `gbk_` ("sticky"): o valor da URL atual vence;
 * - fbclid também sai do cookie `_fbc`; `_fbp` e `_ttp` vão como estão;
 * - user_id é o último encontrado no dataLayer (raiz ou `custom_parameters`), o mesmo id que a
 *   plataforma manda no webhook de cadastro/FTD/depósito; é isso que cruza os dois lados;
 * - valores `{{...}}` não resolvidos pelo GTM são ignorados;
 * - envia uma vez por sessão e por identidade; a primeira página da sessão leva `cv: 1` (conta
 *   como visita); quando o user_id aparece depois do login, envia de novo para ligar o lead;
 * - sendBeacon com text/plain (sem preflight de CORS) e, se falhar, fetch keepalive.
 */
export const CHAVES_USUARIO = [
  'user_id',
  'userId',
  'user_id_cp',
  'player_id',
  'playerId',
  'jogador_codigo',
  'jogador_id',
  'codigo',
  'id',
  'customer_id',
] as const;

/** Endereço de coleta: origem pública da API (sem barra final) + `/t/<empresa>/clk`. */
export function urlColeta(origemApi: string, empresa: string): string {
  return `${origemApi.trim().replace(/\/+$/, '')}/t/${encodeURIComponent(empresa)}/clk`;
}

export function gerarTagGtm(endpoint: string): string {
  const js = (v: unknown) => JSON.stringify(v);
  return `<script>
(function () {
  var ENDPOINT = ${js(endpoint)};
  var P = 'gbk_';
  var CLIQUES = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'clickid', 'tblci'];
  var UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var CHAVES_USUARIO = ${js(CHAVES_USUARIO)};

  function valido(v) {
    if (v === null || v === undefined) return null;
    v = String(v);
    return v && v.indexOf('{{') === -1 ? v.slice(0, 500) : null;
  }
  function ler(k) { try { return localStorage.getItem(P + k); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(P + k, v); } catch (e) {} }
  function cookie(n) {
    var partes = document.cookie ? document.cookie.split('; ') : [];
    for (var i = 0; i < partes.length; i++) {
      var j = partes[i].indexOf('=');
      if (partes[i].slice(0, j) === n) return decodeURIComponent(partes[i].slice(j + 1));
    }
    return null;
  }
  function daUrl(k) {
    var m = location.search.match(new RegExp('[?&]' + k + '=([^&#]*)'));
    try { return m ? decodeURIComponent(m[1].replace(/[+]/g, ' ')) : null; } catch (e) { return null; }
  }

  var d = {};
  var chaves = CLIQUES.concat(UTMS);
  for (var i = 0; i < chaves.length; i++) {
    var novo = valido(daUrl(chaves[i]));
    if (novo) gravar(chaves[i], novo);
    d[chaves[i]] = valido(ler(chaves[i]));
  }
  if (!d.fbclid) {
    var fbc = valido(cookie('_fbc'));
    var pedacos = fbc ? fbc.split('.') : [];
    if (pedacos.length >= 4) { d.fbclid = pedacos.slice(3).join('.'); gravar('fbclid', d.fbclid); }
  }
  d.fbp = valido(cookie('_fbp'));
  d.ttp = valido(cookie('_ttp'));

  var visitante = ler('visitor_id');
  if (!visitante) {
    visitante = new Date().getTime().toString(36) + Math.random().toString(36).slice(2, 10);
    gravar('visitor_id', visitante);
  }
  d.visitor_id = visitante;

  var dl = window.dataLayer || [];
  for (var e = dl.length - 1; e >= 0 && !d.user_id; e--) {
    var item = dl[e];
    if (!item || typeof item !== 'object') continue;
    var lugares = [item, item.custom_parameters || {}];
    for (var l = 0; l < lugares.length && !d.user_id; l++) {
      for (var c = 0; c < CHAVES_USUARIO.length; c++) {
        var uid = valido(lugares[l][CHAVES_USUARIO[c]]);
        if (uid) { d.user_id = uid; break; }
      }
    }
  }
  if (d.user_id) gravar('user_id', d.user_id); else d.user_id = valido(ler('user_id'));

  var primeira = false;
  try {
    var marca = P + 'sent_' + (d.user_id || visitante);
    primeira = !sessionStorage.getItem(P + 'sessao');
    if (!primeira && sessionStorage.getItem(marca)) return;
    sessionStorage.setItem(P + 'sessao', '1');
    sessionStorage.setItem(marca, '1');
  } catch (e) {}

  d.tipo = 'page_view';
  if (primeira) d.cv = 1;
  d.url = location.href.slice(0, 500);
  d.referrer = document.referrer ? document.referrer.slice(0, 500) : null;
  for (var k in d) if (d.hasOwnProperty(k) && (d[k] === null || d[k] === undefined)) delete d[k];

  var corpo = JSON.stringify(d);
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([corpo], { type: 'text/plain' }))) return;
  } catch (e) {}
  try { fetch(ENDPOINT, { method: 'POST', body: corpo, keepalive: true, mode: 'no-cors' }); } catch (e) {}
})();
</script>`;
}
