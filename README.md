<div align="center">

# MOA Web

에이전트 빌더 · 워크플로 편집기 · 마켓을 제공하는 MOA의 프론트엔드

![Next.js](https://img.shields.io/badge/Next.js_15-000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React Flow](https://img.shields.io/badge/React_Flow-FF0072?logo=react&logoColor=white)
![MSW](https://img.shields.io/badge/MSW-FF6A33?logo=mockserviceworker&logoColor=white)

[데모](#) · [화면 설계(Figma)](https://www.figma.com/design/sHEl9gtq0HliOBer1vLYsR) · [설계서](https://github.com/moa-team/moa-docs/tree/main/03-design) · [백엔드](https://github.com/moa-team/moa-backend)

</div>

<img src="./docs/images/editor.png" width="100%" alt="워크플로 편집기 화면" />

## 주요 화면

| 스튜디오 | 에이전트 빌더 |
|---|---|
| <img src="./docs/images/studio.png" alt="스튜디오"> | <img src="./docs/images/agent-builder.png" alt="에이전트 빌더"> |
| 내가 만든 에이전트·워크플로를 탭으로 관리 | 모델 선택 → 스킬(MCP 도구) 부착 → 워크플로 연결 |
| **실행 상세** | **API 배포** |
| <img src="./docs/images/run.png" alt="실행 상세"> | <img src="./docs/images/deploy.png" alt="API 배포"> |
| 노드별 진행·토큰·비용을 SSE로 실시간 표시 | 엔드포인트·API 키 발급·호출 예시 자동 생성 |

## 주요 기능
- **워크플로 편집기**: React Flow 캔버스, 노드 인스펙터, 1.5초 자동 저장 + 낙관적 잠금(충돌 다이얼로그), 실행 취소/다시 실행
- **실행 모니터링**: SSE로 노드 상태·토큰 스트리밍. 재연결 시 `Last-Event-ID`부터 이어 받음
- **컨텍스트 패널**: 블록별 고정·끄기, 토큰 사용량 게이지, 압축 이력
- **템플릿 24종 · 마켓**: 템플릿으로 시작, 복제 라이선스/API 구독 구매
- **목 API 모드**: 백엔드 없이 모든 화면이 동작(MSW + 메모리 DB, 새로고침하면 시드 데이터로 초기화)

## 시작하기

**요구 사항**: Node 20 이상, pnpm 9 이상 (`corepack enable`)

```bash
git clone https://github.com/moa-team/moa-web.git
cd moa-web
cp .env.example .env.local
pnpm install
pnpm dev            # http://localhost:3000 (기본: 목 API 모드)
```

### 환경 변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_API_MOCKING` | `enabled` | `enabled`면 MSW 목 API 사용, 비우면 실제 백엔드 호출 |
| `NEXT_PUBLIC_API_BASE_URL` | `/api/v1` | 실제 백엔드 주소 |

### 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 |
| `pnpm build && pnpm start` | 프로덕션 빌드 실행 |
| `pnpm typecheck` | 타입 검사 |
| `pnpm lint` | ESLint(의존 방향 규칙 포함) |
| `pnpm test` | 단위 테스트(Vitest) |
| `pnpm test:e2e` | E2E 테스트(Playwright, 목 API 모드) |

> 목 데이터는 메모리에만 있습니다. 화면 이동 중에는 만든 데이터가 유지되고, 새로고침하면 시드 데이터로 돌아갑니다.

## 구조

```
src/
├─ app/          # 라우트 (App Router)
├─ features/     # 화면 단위 기능 (editor, agent-builder, market, deploy, auth)
├─ entities/     # 도메인 타입 + TanStack Query 훅 (agent, workflow, run, context …)
├─ shared/       # 공통 UI(shadcn), api-client, sse, hooks
└─ mocks/        # MSW 핸들러 · 픽스처 · 메모리 DB
```

의존 방향은 `app → features → entities → shared` 한 방향만 허용하며, ESLint 규칙으로 강제합니다.

| 상태 종류 | 도구 |
|---|---|
| 서버 상태 | TanStack Query |
| 편집기 로컬 상태 | Zustand (+ immer, zundo) |
| URL 상태(탭·필터) | searchParams |
| 실시간 | SSE → Query 캐시 패치 |

설계 근거는 [소프트웨어 설계서 3.4절](https://github.com/moa-team/moa-docs/tree/main/03-design)에 있습니다.

## 기술적 도전과 해결

> 작성 규칙: 문제 → 원인 → 해결 → 결과(가능하면 수치) 순서로 쓰고, 관련 PR을 링크합니다. 아래는 작성 예시이며 실제 겪은 내용으로 바꿉니다.

<details>
<summary><b>자동 저장 중 두 탭에서 같은 워크플로를 편집하면 한쪽 변경이 사라짐</b></summary>

- **원인**: 저장 요청이 마지막에 도착한 쪽으로 덮어써짐
- **해결**: 초안에 `draft_version`을 두고 `If-Match` 헤더로 낙관적 잠금 적용, 409 응답 시 서버본과 비교하는 다이얼로그 제공
- **결과**: 충돌 재현 E2E 테스트 추가, 유실 0건 · PR #00
</details>

<details>
<summary><b>실행 중 네트워크가 끊기면 진행 상황이 처음부터 다시 그려짐</b></summary>

- **원인**: …
- **해결**: …
- **결과**: …
</details>

## 기여

| 이름 | 담당 |
|---|---|
| 문창일 | 담당 화면 입력 |
| 최민혁 | 담당 화면 입력 |
| 송혜원 | 담당 화면 입력 |

브랜치·커밋·PR 규칙은 [CONTRIBUTING](https://github.com/moa-team/.github/blob/main/CONTRIBUTING.md)을 따릅니다. 이 저장소는 Claude Code를 보조 도구로 사용하며, 작업 규칙은 [CLAUDE.md](./CLAUDE.md)에 있습니다.

## 라이선스

[MIT](./LICENSE)
