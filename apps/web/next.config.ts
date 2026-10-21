import type { NextConfig } from 'next';

/**
 * CSP do painel. Os scripts inline que o App Router injeta (hidratação, RSC) impedem tirar
 * `'unsafe-inline'` de `script-src` sem um nonce gerado no middleware (passo futuro). Fora de
 * produção o dev do Next precisa de `'unsafe-eval'` e do `ws:` do HMR.
 */
function politicaDeConteudo(producao: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${producao ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    // O logo da empresa vem da API como data: URI; o export em PNG usa blob:.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' data: blob:${producao ? '' : ' ws:'}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Não anuncia o framework no `X-Powered-By`.
  poweredByHeader: false,
  // O indicador de dev do Next fica sobre a sidebar e suja o diff visual.
  devIndicators: false,
  transpilePackages: [
    '@trafego/design',
    '@trafego/fixtures',
    '@trafego/contratos',
    '@trafego/graficos',
  ],
  // Os pacotes internos importam com sufixo .js (NodeNext); o webpack precisa resolver para .ts.
  webpack: (config) => {
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    return config;
  },
  async headers() {
    // Lido aqui (e não no topo) para o teste conseguir trocar o NODE_ENV.
    const producao = process.env.NODE_ENV === 'production';
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          // Cabeçalho obsoleto: 0 desliga o filtro antigo dos navegadores, que criava falhas.
          { key: 'X-XSS-Protection', value: '0' },
          // Só em produção (atrás de HTTPS); sem includeSubDomains para não prender outros hosts.
          ...(producao ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
          { key: 'Content-Security-Policy', value: politicaDeConteudo(producao) },
        ],
      },
      // Convite e redefinição levam o token na query: nada de Referer para fora. Quando duas
      // regras definem o mesmo cabeçalho, o Next fica com a última; por isso estas vêm depois.
      {
        source: '/convite/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
      {
        source: '/redefinir/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ];
  },
};

export default nextConfig;
