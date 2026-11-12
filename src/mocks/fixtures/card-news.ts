export const MOCK_NEWS_ARTICLES = Array.from({ length: 4 }, (_, i) => ({
  article_id: i, title: `[샘플] 국내 주식 뉴스 ${i + 1}`, summary: '워크플로 연결과 카드 배치를 확인하기 위한 예시입니다. 실제 뉴스가 아닙니다.',
  snippet: '워크플로 연결과 카드 배치를 확인하기 위한 예시입니다. 실제 뉴스가 아닙니다.',
  source: '목 API 샘플', url: `https://example.com/mock-news/${i + 1}`,
}));
