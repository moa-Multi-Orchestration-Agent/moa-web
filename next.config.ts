import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

// 목 API를 끄면 /api/*·/a/* 를 백엔드로 프록시한다(같은 출처라 HttpOnly 세션 쿠키가 그대로 오간다).
const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const BACKEND = (process.env.MOA_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 개발 서버와 빌드(E2E·번들 점검)가 같은 폴더를 쓰지 않게
  distDir: process.env.NEXT_DIST_DIR || '.next',
  devIndicators: false,
  typedRoutes: false,
  // radix-ui 묶음 패키지는 기본 최적화 대상이 아니라 전부 번들되던 것을 막는다
  experimental: { optimizePackageImports: ['radix-ui', 'lucide-react', '@tanstack/react-query'] },
  async rewrites() {
    if (MOCKING) return [];
    return [
      { source: '/api/:path*', destination: `${BACKEND}/api/:path*` },
      { source: '/a/:path*', destination: `${BACKEND}/a/:path*` },
    ];
  },
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
