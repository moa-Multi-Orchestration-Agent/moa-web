import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
// 편집기와 미리보기의 필수 레이아웃 CSS는 지연 로딩 청크가 아닌 공통 레이아웃에서 유지한다.
import '@xyflow/react/dist/style.css';
import './globals.css';

const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'MOA', template: '%s · MOA' },
  description: 'MCP 기반 에이전트 빌더 플랫폼',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning className={mono.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
