'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>앱을 불러오지 못했습니다</h1>
          <p style={{ color: '#6B6F78' }}>새로고침하거나 잠시 후 다시 시도해 주세요.</p>
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: '8px 16px' }}>
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
