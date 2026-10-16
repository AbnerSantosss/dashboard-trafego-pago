import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
};

export default nextConfig;
