# @trafego/design

Tokens de design do Dashboard de Tráfego Pago, extraídos da imagem de referência
`tests/visual/ref-1.png` (1315×710) na tarefa P1.1. Documentação viva em
`wiki/design-system/tokens.md`.

| Arquivo        | Conteúdo                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| `tokens.css`   | Bloco `:root` com 95 variáveis CSS, agrupadas e comentadas               |
| `tokens.json`  | Os mesmos 95 tokens com `nome`, `valor`, `categoria`, `origem` e `uso`   |
| `brand/`       | Logo padrão da PASIO (`pasio-logo.png`)                                  |

`tokens.css` e `tokens.json` têm sempre os mesmos nomes e valores. Ao mudar um token, mude os dois
e a wiki.

## Como consumir

**Next.js (`apps/web`)**: o pacote já está no `package.json` como `@trafego/design: workspace:*`.
Importe uma vez no CSS global, depois do Tailwind:

```css
/* apps/web/app/globals.css */
@import 'tailwindcss';
@import '@trafego/design/tokens.css';
```

Nos componentes, use as variáveis direto (`style={{ background: 'var(--bg-card)' }}`) ou em
classes arbitrárias do Tailwind (`bg-[var(--bg-card)]`, `text-[length:var(--fs-kpi-value)]`).

**Protótipo estático (`prototype/index.html`)**: link relativo, sem build:

```html
<link rel="stylesheet" href="../packages/design/tokens.css" />
```

**TypeScript / testes**: `import tokens from '@trafego/design/tokens.json'` dá a lista para
gerar temas, checar contraste ou validar que nenhum valor fixo escapou do sistema.

## Tabela resumida

| Grupo             | Tokens principais                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Fundos            | `--bg-app` #03111e, `--bg-sidebar` #051424, `--bg-card` #061b28, `--bg-filter`, `--bg-nav-active`     |
| Bordas            | `--border-card` #0c2030, `--border-sidebar`, `--border-table-row`                                     |
| Texto             | `--text-primary` #fff, `--text-secondary` #d1e3f4, `--text-muted` #d6e6f5, `--text-dim` #c5d3ea       |
| Acentos e tiles   | `--accent-blue`, `--accent-red`, `--accent-teal`, `--tile-blue-bg`, `--tile-red-bg`, `--tile-teal-bg` |
| Funil             | `--funnel-1` #0070fd → `--funnel-5` #00c97f, `--funnel-connector`                                     |
| Estados           | `--positive` #06f6c7, `--negative` #ff5c7a (inferido), `--roas-text`                                  |
| Tipografia        | `--font-sans`, `--fs-*` e `--fw-*` por papel (título 28/600, valor KPI 21/600, tabela 12/400)         |
| Layout            | `--sidebar-width` 180px, `--gap` 12px, `--card-padding-x/y` 12/13px, `--col-funnel/table` 40,5/59,5%  |
| Componentes       | `--card-kpi-height` 115px, `--filter-height` 56px, `--tile-size` 44px, `--table-row-height` 48px      |
| Forma             | `--radius` 8px, `--shadow-card` none                                                                  |

## Método de extração

1. **Cores (`amostrado`)**: leitura de pixels com Python + PIL. Para áreas chapadas, cor mais
   frequente (moda) da região; para texto, pixel mais claro do glifo (o antialiasing escurece o
   resto). Ex.: `--text-muted` vem do texto "vs. período anterior" dos cinco cards de KPI.
2. **Dimensões (`medido`)**: varredura de linhas e colunas procurando a transição entre o fundo
   `--bg-app` e as bordas dos cards; alturas de linha pelo passo entre separadores da tabela;
   funil pelas faixas de cor saturada.
3. **Tamanhos de fonte (`medido`)**: altura da maiúscula medida a 50% de contraste, dividida pela
   razão de altura de maiúscula da Inter (0,727) e arredondada.
4. **`inferido`**: o que a imagem não mostra (família da fonte, pesos, `--negative`, sombra).

A imagem é um mock com pequenas irregularidades (cards de KPI com larguras de 198 a 227 px,
padding do primeiro card menor). Os tokens usam o valor típico; o layout deve distribuir os cinco
KPIs em colunas iguais.
