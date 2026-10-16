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
};

export default nextConfig;
