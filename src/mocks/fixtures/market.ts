/** 마켓 상품 12개 (리뷰·버전 포함) */
import type { DbMarketVersion, DbProduct, DbReview } from '../db';
import { DAY, ago, fid } from '../lib/util';
import { SEED_WORKFLOWS } from './workflows';

interface SeedProduct {
  title: string;
  summary: string;
  category: string;
  kind: 'agent' | 'workflow';
  icon: string;
  seller: string;
  license_types: ('clone' | 'api_sub')[];
  clone?: number | null;
  api?: number | null;
  rating: number;
  installs: number;
  tags: string[];
  versions: string[];
  mine?: boolean;
  status?: DbProduct['status'];
  reject_reason?: string;
}

const P: SeedProduct[] = [
  { title: '경쟁사 분석 에이전트', summary: '회사 이름만 말하면 보도자료 · 블로그 · 채용 공고를 비교 분석해 Slack에 리포트를 올립니다', category: 'research', kind: 'agent', icon: '🔭', seller: '인사이트랩', license_types: ['api_sub', 'clone'], clone: 290000, api: 49000, rating: 4.6, installs: 312, tags: ['경쟁사', '리포트', 'Slack'], versions: ['1.0.0', '1.2.0', '1.4.0'] },
  { title: '쇼핑몰 리뷰 분석 리포트', summary: '상품 리뷰를 모아 감성·불만 항목을 주간 리포트로 정리합니다', category: 'marketing', kind: 'workflow', icon: '🛍️', seller: '커머스AI', license_types: ['clone'], clone: 99000, rating: 4.3, installs: 188, tags: ['리뷰', '감성 분석'], versions: ['1.0.0', '1.1.0'] },
  { title: '법률 문서 조항 검토 에이전트', summary: '계약서 조항의 위험 요소를 표시하고 수정안을 제안합니다', category: 'docs', kind: 'agent', icon: '⚖️', seller: '리걸테크원', license_types: ['api_sub'], api: 79000, rating: 4.8, installs: 97, tags: ['계약서', '법률'], versions: ['0.9.0', '1.0.0'] },
  { title: '가구 스케치 3D 프리셋 팩', summary: '의자·테이블·수납장 스케치를 3D로 바꾸는 프리셋 12종', category: 'design', kind: 'workflow', icon: '🪑', seller: '폼앤폼', license_types: ['clone'], clone: 0, rating: 4.1, installs: 540, tags: ['3D', '가구', '무료'], versions: ['1.0.0'] },
  { title: '면접 질문 생성 에이전트', summary: '직무 설명서를 읽고 역량별 면접 질문과 평가 기준을 만듭니다', category: 'hr', kind: 'agent', icon: '🧑‍💼', seller: 'HR메이트', license_types: ['clone'], clone: 0, rating: 4.0, installs: 421, tags: ['채용', 'HR', '무료'], versions: ['1.0.0', '1.0.1'] },
  { title: 'GitHub 이슈 자동 분류', summary: '새 이슈에 라벨·담당자·중복 여부를 제안합니다', category: 'dev', kind: 'workflow', icon: '🏷️', seller: '데브플로', license_types: ['clone'], clone: 39000, rating: 4.5, installs: 233, tags: ['GitHub', '개발'], versions: ['1.0.0', '1.3.0'] },
  { title: '고객 문의 응대 에이전트', summary: '메일 문의를 분류하고 승인 후 답장하는 고객지원 에이전트', category: 'support', kind: 'agent', icon: '💬', seller: 'MOA 팀', license_types: ['clone', 'api_sub'], clone: 149000, api: 29000, rating: 4.4, installs: 76, tags: ['고객지원', '메일'], versions: ['1.0.0', '1.1.0'], mine: true },
  { title: '논문 요약 · 인용 정리', summary: '논문 PDF를 요약하고 APA·IEEE 인용을 맞춰 줍니다', category: 'research', kind: 'workflow', icon: '📄', seller: '아카데믹스', license_types: ['clone'], clone: 19000, rating: 4.7, installs: 610, tags: ['논문', '요약'], versions: ['2.0.0', '2.1.0'] },
  { title: 'SNS 콘텐츠 캘린더', summary: '한 달치 SNS 게시 일정과 문구를 한 번에 만듭니다', category: 'marketing', kind: 'agent', icon: '📅', seller: '그로스킷', license_types: ['api_sub', 'clone'], clone: 120000, api: 19000, rating: 3.9, installs: 145, tags: ['SNS', '마케팅'], versions: ['1.0.0'] },
  { title: '채용 공고 분석기', summary: '경쟁사 채용 공고에서 기술 스택과 조직 변화를 읽어 냅니다', category: 'hr', kind: 'workflow', icon: '📌', seller: '인사이트랩', license_types: ['clone'], clone: 59000, rating: 4.2, installs: 64, tags: ['채용', '리서치'], versions: ['1.0.0'] },
  { title: '사내 규정 Q&A 키트', summary: '규정 문서를 올리면 바로 쓰는 Q&A 챗봇과 출처 표시', category: 'docs', kind: 'agent', icon: '📚', seller: '워크스마트', license_types: ['clone'], clone: 89000, rating: 4.5, installs: 202, tags: ['RAG', '사내 문서'], versions: ['1.0.0', '1.2.0'] },
  { title: '브랜드 무드보드 생성', summary: '키워드로 색·글꼴·이미지 방향을 담은 무드보드를 만듭니다', category: 'design', kind: 'workflow', icon: '🎨', seller: '폼앤폼', license_types: ['clone'], clone: 49000, rating: 4.0, installs: 88, tags: ['디자인', '브랜딩'], versions: ['1.0.0'] },
];

const README = (p: SeedProduct) => `## ${p.title}

${p.summary}

### 이런 분께 좋아요
- 반복 작업을 자동화하고 싶은 팀
- 결과 형식이 정해져 있어 매번 같은 품질이 필요한 경우

### 구성
| 항목 | 내용 |
|---|---|
| 종류 | ${p.kind === 'agent' ? '에이전트' : '워크플로'} |
| 태그 | ${p.tags.join(', ')} |

### 사용 방법
1. **구매하고 스튜디오에 추가**를 누릅니다.
2. 필요한 연동(자격증명·MCP)을 연결합니다.
3. 테스트 실행으로 결과를 확인한 뒤 배포합니다.

> 실행 토큰 비용은 구매한 워크스페이스에 청구됩니다.
`;

const REVIEW_TEXT = [
  '세 곳만 말했는데 바로 리포트가 나왔어요',
  '형식을 바꾸고 싶어서 복제 라이선스로 다시 샀습니다',
  '설정이 간단하고 결과가 안정적이에요',
  '가끔 출처가 빠지는데 업데이트로 나아졌어요',
  '팀 전체가 매일 쓰고 있습니다',
  '가격 대비 만족합니다',
  '초기 설정 안내가 조금 더 있으면 좋겠어요',
];
const REVIEWERS = ['정다은', '오세훈', '한지수', '윤태호', '서민아', '강도윤', '임하린'];

export function seedMarket(now: number, myWs: string, otherWsIds: Record<string, string>) {
  const products: DbProduct[] = [];
  const versions: DbMarketVersion[] = [];
  const reviews: DbReview[] = [];
  P.forEach((p, i) => {
    const id = fid('p', i + 1);
    const created = ago((60 - i * 3) * DAY, now);
    const wf = SEED_WORKFLOWS[i % SEED_WORKFLOWS.length]!;
    products.push({
      id,
      seller_ws: p.mine ? myWs : (otherWsIds[p.seller] ?? fid('w', 90 + i)),
      agent_id: null,
      endpoint_id: p.license_types.includes('api_sub') ? fid('e', 90 + i) : null,
      title: p.title,
      summary: p.summary,
      category: p.category,
      tags: p.tags,
      readme_md: README(p),
      license_types: p.license_types,
      price_clone_krw: p.clone ?? null,
      price_api_month_krw: p.api ?? null,
      status: p.status ?? 'published',
      rating_avg: p.rating,
      rating_count: 0,
      install_count: p.installs,
      created_at: created,
      updated_at: ago((10 - (i % 10)) * DAY, now),
      kind: p.kind,
      icon: p.icon,
      seller_name: p.seller,
      screenshots: [],
    });
    p.versions.forEach((semver, vi) => {
      versions.push({
        id: fid('pv', (i + 1) * 10 + vi),
        product_id: id,
        semver,
        bundle: {
          agent:
            p.kind === 'agent'
              ? { name: p.title, model: 'claude-sonnet-4', system_prompt: `너는 ${p.title}다. ${p.summary}`, skills: ['web_search'] }
              : {},
          workflows: [{ name: p.kind === 'agent' ? `${p.title} 워크플로` : p.title, definition: wf.definition }],
          requirements: p.tags.includes('Slack') ? [{ kind: 'mcp', provider: 'Slack', label: 'Slack (MCP)' }] : [],
        },
        scan_report: { findings: [{ path: '$.workflows[0].nodes[2].config.credential_id', rule: 'credential_ref', severity: 'info', excerpt: '' }] },
        workflow_version_id: null,
        changelog: vi === 0 ? '첫 공개' : ['출처 표시 개선', '응답 속도 향상', '프롬프트 다듬기'][vi % 3]!,
        created_at: ago((50 - i * 3 - vi * 8) * DAY, now),
      });
    });
    const count = 3 + (i % 4);
    for (let r = 0; r < count; r++) {
      const rating = Math.max(1, Math.min(5, Math.round(p.rating + (r % 3 === 2 ? -1 : r % 3 === 1 ? 0.4 : 0))));
      reviews.push({
        id: fid('rv', i * 10 + r),
        product_id: id,
        license_id: null,
        author: fid('u', 50 + r),
        author_name: REVIEWERS[(i + r) % REVIEWERS.length]!,
        rating,
        body: REVIEW_TEXT[(i + r) % REVIEW_TEXT.length]!,
        created_at: ago((r * 4 + 1) * DAY + i * 3600_000, now),
      });
    }
  });
  // 내 판매(Figma 16): 검수 중·반려 상품
  products.push({
    ...products[6]!,
    id: fid('p', 13),
    title: 'AI 뉴스 요약 발송',
    summary: '매일 뉴스를 모아 요약해 메일로 보내는 워크플로',
    kind: 'workflow',
    icon: '🗞️',
    category: 'marketing',
    license_types: ['clone'],
    price_clone_krw: 0,
    price_api_month_krw: null,
    status: 'in_review',
    rating_avg: 0,
    install_count: 0,
    endpoint_id: null,
  });
  products.push({
    ...products[6]!,
    id: fid('p', 14),
    title: '회의록 → Notion 등록',
    summary: '회의록을 요약해 Notion에 등록하는 워크플로',
    kind: 'workflow',
    icon: '📝',
    category: 'docs',
    license_types: ['clone'],
    price_clone_krw: 29000,
    price_api_month_krw: null,
    status: 'suspended',
    reject_reason: '워크플로 노드 설정에 실제 Notion 토큰으로 보이는 값이 남아 있습니다(nodes[2].config.token). 값을 지우고 다시 제출해 주세요.',
    rating_avg: 0,
    install_count: 0,
    endpoint_id: null,
  });
  for (const pr of products) {
    if (pr.id === fid('p', 13) || pr.id === fid('p', 14)) {
      versions.push({ ...versions.find((v) => v.product_id === fid('p', 7))!, id: `${pr.id}-v1`, product_id: pr.id, semver: '1.0.0' });
    }
    const mine = reviews.filter((r) => r.product_id === pr.id);
    pr.rating_count = mine.length;
  }
  return { products, versions, reviews };
}
