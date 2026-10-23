import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typedRoutes: false,
  async redirects() {
    return [
      { source: '/', destination: '/home', permanent: false },
      { source: '/settings/credentials', destination: '/integrations?tab=credentials', permanent: false },
      { source: '/settings/mcp', destination: '/integrations?tab=mcp', permanent: false },
      { source: '/settings/members', destination: '/settings?tab=team', permanent: false },
      { source: '/settings/budget', destination: '/settings?tab=budget', permanent: false },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
