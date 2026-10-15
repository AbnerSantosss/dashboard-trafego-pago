# Testes transversais

Fase 6: e2e com duas empresas (Playwright) e regressão visual (pixelmatch). Testes unitários ficam em cada pacote.

- `visual/` — pacote `@trafego/qa-visual`: compara a tela com `visual/ref-1.png` (limite 2%).
  Rodar com `pnpm qa:visual` na raiz; detalhes em `visual/README.md`.
