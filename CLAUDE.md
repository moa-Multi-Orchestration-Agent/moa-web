# MOA 프론트엔드 — Claude Code 작업 규칙

MOA는 MCP 기반 에이전트 빌더 플랫폼이다. 지금 단계는 **백엔드 없이 MSW 목 API로 프론트 UI를 완성**하는 것이다.

## 기준 문서 (충돌 시 위가 우선)
1. Figma `MOA 와이어프레임` — https://www.figma.com/design/sHEl9gtq0HliOBer1vLYsR (fileKey `sHEl9gtq0HliOBer1vLYsR`, 화면 배치·흐름의 기준). 프레임 목록과 화면별 저장본 색인은 `docs/figma/INDEX.md`
2. `docs/design.md` — 소프트웨어 설계서. 프론트 작업 시 반드시 볼 절:
   - 3.4 프론트엔드 구조 설계 (디렉터리, 상태 관리, 편집기 스토어, 목 API 전략)
   - 2.6 API 상세 (엔드포인트 목록·요청/응답 예시 → MSW 핸들러와 타입의 기준)
   - 1.5.2 SSE 이벤트 형식 (실행 화면 실시간 표시)
   - 3.3.1 오류 응답 형식 (Problem Details) · 3.3.2 오류 코드
   - 1.4.3 레코드 레이아웃 / 2.5 DDL (엔터티 필드명의 기준)
3. `docs/figma/` — Figma에서 한 번 추출해 둔 화면별 스크린샷·노트 (MCP 호출 한도 절약용)

Figma 와이어프레임은 레이아웃·흐름 기준이고, 색·타이포는 아래 디자인 토큰을 따른다. 와이어프레임에 없는 상태(로딩/빈 상태/오류)는 직접 설계해서 넣는다.

이 저장소(`moa-web`)는 프론트 전용이다. 백엔드는 `moa-backend`, 문서는 `moa-docs` 저장소에 있다. 설계서는 `moa-docs`에서 `docs/design.md`로 복사해 두고 쓴다(원본 수정은 moa-docs에서).
브랜치·커밋·PR 규칙은 아래 "Git 규칙" 절을 따른다(조직 `.github` 저장소 CONTRIBUTING.md의 요약. 이 저장소에서는 그 파일을 읽을 수 없으므로 여기 적힌 것이 기준).

## 디자인 토큰 (Tailwind theme + shadcn CSS 변수로 정의)
| 토큰 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--primary` | #2A56C6 | #6B8EF0 | 주요 버튼, 선택 상태, 링크 |
| `--background` | #FFFFFF | #0F1115 | 페이지 |
| `--surface` | #F6F7F9 | #171A20 | 카드, 패널, 캔버스 배경 |
| `--border` | #E3E5EA | #2A2F38 | 구분선 |
| `--foreground` | #1C1C1A | #ECEDEF | 본문 |
| `--muted` | #6B6F78 | #9A9FA8 | 보조 텍스트 |
| `--success` / `--warning` / `--danger` | #1F9D55 / #C98A00 / #D64545 | 밝기 +15% | 실행 상태(성공·승인 대기·실패) |
- 글꼴: Pretendard(본문), JetBrains Mono(코드·키). 기본 14px, 제목 20/16px.
- 간격은 4px 단위로 맞추고, radius는 8px(카드)·6px(입력)으로 한다.
- 노드 타입 색은 `shared/ui/node-colors.ts` 한 곳에서만 정의한다.

## 기술 스택 (변경 금지, 추가 시 이유를 커밋 메시지에)
- Next.js 15 App Router · TypeScript strict · pnpm
- Tailwind CSS · shadcn/ui · lucide-react
- @xyflow/react (React Flow) · Zustand(+immer, zundo) · TanStack Query v5
- MSW v2 (브라우저 + Node) · zod (폼/응답 검증)
- three · @react-three/fiber (3D 미리보기, `next/dynamic` ssr:false)
- 테스트: Vitest + Testing Library, Playwright(E2E, MSW 모드)

## 디렉터리 (design.md 3.4.1 그대로)
```
src/app/(auth)/…  src/app/(app)/{home,studio,agents,workflows,runs,templates,market,deploy,settings}
src/features/{editor,agent-builder,market,deploy,auth}
src/entities/{agent,workflow,run,context,endpoint,product}   # 타입 + query 훅
src/shared/{ui,lib,hooks}
src/mocks/{handlers,fixtures,browser.ts,server.ts}
```
의존 방향은 `app → features → entities → shared`만 허용한다. eslint-plugin-boundaries로 강제한다.

## 규칙
- 서버 상태는 TanStack Query로 관리한다. 편집기 로컬 상태만 Zustand에 둔다. URL로 표현 가능한 상태(탭, 필터)는 searchParams에 둔다.
- API 호출은 `src/shared/lib/api-client.ts` 하나만 거친다. 다음을 처리한다:
  - baseURL `/api/v1`
  - `X-Workspace-Id` 헤더
  - `If-Match` 헤더
  - Problem Details 오류를 `ApiError(code, status, detail)`로 변환
- 목 데이터 필드명은 design.md의 DDL·API 예시와 똑같이 snake_case로 맞춘다. UI 계층 변환은 entities에서 한다.
- `NEXT_PUBLIC_API_MOCKING=enabled`일 때만 MSW를 켠다. 끄면 실제 백엔드로 바로 붙어야 한다.
- SSE는 `shared/lib/sse.ts`의 EventSource 래퍼를 쓴다. MSW에서는 ReadableStream으로 `step.*` 이벤트를 시간차를 두고 흘린다.
- 모든 화면에 로딩(skeleton)·빈 상태·오류 상태를 넣는다.
- 아이콘 버튼에는 `aria-label`을 단다. 상태를 색만으로 표시하지 않는다.
- 텍스트는 한국어 UI다. 하드코딩하되 `shared/lib/copy.ts`에 모아 둔다.
- 컴포넌트 하나가 250줄을 넘으면 분리한다.

## Figma MCP 사용 규칙 (Starter 플랜이라 호출 한도가 작다)
- 화면 하나를 구현할 때 `get_design_context`/`get_screenshot`은 그 화면 프레임에만 1회 호출한다.
- 결과 요약과 스크린샷은 `docs/figma/<화면>.md|png`에 저장하고, 이후에는 저장본을 본다.
- 한도에 걸리면 멈추지 말고 `docs/figma/` 저장본과 design.md를 기준으로 계속 진행한다. 어디를 추정했는지는 보고한다.

## 완료 기준 (각 작업 끝에 직접 확인)
- `pnpm typecheck && pnpm lint && pnpm test` 통과
- `pnpm dev`로 띄워 해당 화면을 Playwright 스크린샷으로 찍고, Figma 저장본과 나란히 비교한다. 차이 목록을 보고한다.
- 작업 단위마다 "Git 규칙"에 맞춰 커밋한다.

## Git 규칙
**브랜치**
- `main`: 배포용. `develop`에서 검증이 끝난 것만 릴리스 PR(`develop → main`)로 합친다.
- `develop`: 통합용. 모든 작업 브랜치는 여기서 파고, PR도 여기로 보낸다.
- `main`·`develop`에 직접 커밋·push하지 않는다. 작업마다 `develop`에서 새 브랜치를 판다.
- 이름은 `<type>/<이슈번호>-<짧은-영문-설명>`이다. 예: `feat/12-editor-autosave`, `fix/31-sse-reconnect`, `chore/5-project-setup`
- 이슈 번호가 없으면 `<type>/<설명>`으로 만들고, 보고할 때 "이슈 없음"이라고 알린다.
- force push, `git reset --hard`, 히스토리 재작성은 하지 않는다.

**커밋 메시지** (commitlint가 검사하고, 통과하지 못하면 커밋이 거부된다)
```
<type>(<scope>): <제목 50자 이내, 마침표 없음, 명령형>

<본문: 무엇을, 왜. 설계서 절 번호가 있으면 적기>

Refs: #<이슈번호>
```
- type: `feat` `fix` `refactor` `style` `test` `docs` `chore` `perf`
- scope는 이 목록에서만 고른다: `auth` `home` `studio` `agent` `editor` `run` `template` `market` `deploy` `settings` `ui` `api-client` `mocks` `entities` `deps`
  - 여러 영역에 걸치면 가장 주된 것 하나를 고른다. 설정·도구 변경은 scope 없이 `chore: …`로 쓴다.
- 제목은 한국어로 쓴다. 예: `feat(editor): 자동 저장 충돌 다이얼로그 추가`
- 커밋 하나에는 논리적 변경 하나만 담는다. 화면 하나를 구현했다면 "타입·훅 → 컴포넌트 → 테스트"처럼 2~4개로 나눠도 된다.
- 커밋 전에 `pnpm typecheck && pnpm lint && pnpm test`를 통과시킨다.
- `.env*`, 비밀값, 큰 바이너리(10MB 이상)는 커밋하지 않는다. `docs/figma/*.png`는 예외로 허용한다.

**PR** (사용자가 요청할 때만 `gh pr create`로 만든다)
- 작업 PR의 base는 `develop`이다. 제목은 커밋 메시지 형식과 같고, Squash 머지되어 `develop`의 커밋 제목이 된다.
- 릴리스 PR(`develop → main`)은 Merge commit으로 합친다(Squash하면 두 브랜치 히스토리가 어긋난다).
- 본문 섹션은 다음 순서로 쓴다.
  1. 무엇을 바꿨나
  2. 왜(`Closes #번호`)
  3. 스크린샷: 피그마 저장본과 구현 화면을 나란히
  4. 확인 방법
  5. 체크리스트: 로딩·빈·오류 상태, typecheck·lint·test, 설계서와 다른 점, AI 사용(예)
- 400줄을 넘으면(lockfile·생성 파일 제외) 나눠서 올리자고 먼저 제안한다.
- 머지는 하지 않는다. 리뷰와 머지는 사람이 한다.
