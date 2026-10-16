// Gera os ícones da tela de referência a partir do @tabler/icons (MIT).
// Saída: icons/<nome>.svg, icons/sprite.svg, icons/index.ts e icons/previa.png.
// Rodar: pnpm --filter @trafego/design icones
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const tabler = join(raiz, 'node_modules', '@tabler', 'icons');
const destino = join(raiz, 'icons');
const STROKE = '1.75';

// nome na tela -> [estilo, nome no Tabler, uso]
export const mapa = {
  'visao-geral': ['outline', 'chart-bar', 'Menu: Visão Geral (item ativo)'],
  'gestao-custos': ['outline', 'database', 'Menu: Gestão de Custos'],
  relatorios: ['outline', 'file-text', 'Menu: Relatórios'],
  ajuda: ['outline', 'help-circle', 'Rodapé da sidebar: Ajuda'],
  configuracoes: ['outline', 'settings', 'Rodapé da sidebar: Configurações (acima da Ajuda)'],
  exportar: ['outline', 'download', 'Botão Exportar'],
  'chevron-down': ['outline', 'chevron-down', 'Botão Exportar e selects dos filtros'],
  investimento: ['outline', 'coins', 'Tile do KPI Investimento total'],
  ftds: ['outline', 'users', 'Tile do KPI FTDs'],
  cpa: ['outline', 'target-arrow', 'Tile do KPI Custo por FTD'],
  depositos: ['outline', 'wallet', 'Tile do KPI Depósitos no período'],
  roas: ['outline', 'chart-arrows-vertical', 'Tile do KPI ROAS'],
  'seta-alta': ['filled', 'triangle', 'Delta positivo dos KPIs'],
  'seta-baixa': ['filled', 'triangle-inverted', 'Delta negativo dos KPIs'],
  calendario: ['filled', 'calendar', 'Campo Período dos filtros'],
  limpar: ['outline', 'filter', 'Botão Limpar filtros'],
  'status-dot': ['filled', 'point', 'Ponto verde de "Dados atualizados em"'],
  info: ['outline', 'info-circle', 'Títulos dos painéis e colunas CPA / ROAS'],
  ordenar: ['outline', 'selector', 'Cabeçalho ordenável da tabela'],
  'canal-meta': ['outline', 'infinity', 'Tabela por canal: Meta (laço genérico, não o logotipo)'],
  'canal-email': ['filled', 'mail', 'Tabela por canal: Email'],
  'canal-sms': ['filled', 'message-circle', 'Tabela por canal: SMS'],
  'canal-afiliados': ['filled', 'affiliate', 'Tabela por canal: Afiliados'],
  'canal-outros': ['filled', 'dots', 'Tabela por canal: Outros'],
};

function limpar(svg, estilo) {
  const corpo = svg
    .replace(/<svg[^>]*>/s, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none" \/>/, '')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
  const abertura =
    estilo === 'outline'
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">`
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">';
  return { corpo, svg: `${abertura}${corpo}</svg>` };
}

mkdirSync(destino, { recursive: true });
const icones = {};
const simbolos = [];
for (const [nome, [estilo, origem]] of Object.entries(mapa)) {
  const fonte = readFileSync(join(tabler, 'icons', estilo, `${origem}.svg`), 'utf8');
  const { corpo, svg } = limpar(fonte, estilo);
  icones[nome] = svg;
  writeFileSync(join(destino, `${nome}.svg`), `${svg}\n`);
  const attrs =
    estilo === 'outline'
      ? ` fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"`
      : ' fill="currentColor"';
  simbolos.push(`  <symbol id="icone-${nome}" viewBox="0 0 24 24"${attrs}>${corpo}</symbol>`);
}

writeFileSync(
  join(destino, 'sprite.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${simbolos.join('\n')}\n</svg>\n`,
);

const linhas = Object.entries(icones).map(([nome, svg]) => {
  const chave = /^[a-z][a-z0-9]*$/.test(nome) ? nome : `'${nome}'`;
  return `  ${chave}:\n    '${svg}',`;
});
writeFileSync(
  join(destino, 'index.ts'),
  `// Gerado por scripts/gerar-icones.mjs a partir do @tabler/icons (MIT). Não editar à mão.\n` +
    `// A cor vem de \`currentColor\`; o tamanho, do CSS (width/height no elemento pai ou no <svg>).\n` +
    `export const icones = {\n${linhas.join('\n')}\n} as const;\n\nexport type NomeIcone = keyof typeof icones;\n`,
);

// Prévia em PNG (sharp já está em node_modules como dependência transitiva).
try {
  // sharp é dependência transitiva (Next); procurado no store do pnpm para não adicionar dependência.
  const { readdirSync } = await import('node:fs');
  const store = join(raiz, '..', '..', 'node_modules', '.pnpm');
  const pasta = readdirSync(store).find((d) => d.startsWith('sharp@'));
  const sharp = require(join(store, pasta, 'node_modules', 'sharp'));
  const nomes = Object.keys(icones);
  const col = 6,
    cel = 110,
    tam = 40;
  const linhasN = Math.ceil(nomes.length / col);
  const itens = nomes
    .map((nome, i) => {
      const x = (i % col) * cel + 35,
        y = Math.floor(i / col) * cel + 20;
      const inner = icones[nome].replace(
        '<svg ',
        `<svg x="${x}" y="${y}" width="${tam}" height="${tam}" `,
      );
      return `${inner}<text x="${x + tam / 2}" y="${y + tam + 22}" font-family="Segoe UI, sans-serif" font-size="11" fill="#D6E6F5" text-anchor="middle">${nome}</text>`;
    })
    .join('\n');
  const painel = `<svg xmlns="http://www.w3.org/2000/svg" width="${col * cel}" height="${linhasN * cel}" style="color:#4DA3FF"><rect width="100%" height="100%" fill="#071829"/>${itens}</svg>`;
  await sharp(Buffer.from(painel)).png().toFile(join(destino, 'previa.png'));
} catch (e) {
  console.warn('Prévia não gerada:', e.message);
}
console.log(`${Object.keys(icones).length} ícones gerados em ${destino}`);
