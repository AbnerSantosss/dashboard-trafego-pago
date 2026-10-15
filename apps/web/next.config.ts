import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@trafego/design', '@trafego/fixtures'],
};

export default nextConfig;
