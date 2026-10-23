# MOA 프론트엔드 구현 계획

작성: 2026-10-23 · 기준: Figma 저장본(`docs/figma/INDEX.md`), `docs/design.md`(3.4, 2.6, 1.5.2, 3.3, 1.4.3, 2.5), `docs/prompts.md`

## 1. 화면 → 라우트 → API → 공통 컴포넌트

API 경로는 모두 `/api/v1` 기준. ★ 표시는 설계서 2.6.2 목록에 없어 목 API에 추가하는 엔드포인트다(9절 참고).

| 화면 (Figma) | 라우트 | 사용하는 API | 공통 컴포넌트 |
|---|---|---|---|
| 로그인·회원가입 (없음) | `/login`, `/signup` | `POST /auth/login`, ★`POST /auth/signup`, `GET /auth/oauth/{provider}/callback`, ★`GET /auth/me`, ★`POST /auth/logout` | Card, Form, Input, Button |
| 01 홈 | `/home` | `GET /agents`, `GET /workflows`, ★`GET /runs`, ★`GET /approvals?status=pending`, `POST /approvals/{id}/decision`, `GET /usage`, `GET /budgets`, `GET /templates`, `POST /agents`, `POST /workflows` | StatCard, StatusBadge, KindBadge, Gauge, EmptyState, ErrorState |
| 02·03 스튜디오 | `/studio?tab=agents\|workflows` | `GET /agents`, `GET /workflows`(커서), `POST /agents`, `POST /workflows`, `PATCH /agents/{id}`, ★`PATCH /workflows/{id}`, `DELETE /agents/{id}`, ★`DELETE /workflows/{id}`, ★`POST /agents/{id}/duplicate`, ★`POST /workflows/{id}/duplicate` | FilterChips, ViewToggle, ConfirmDialog, InfiniteList, MiniChain |
| 04 새로 만들기 | `/studio/new?type=agent\|workflow` | `POST /agents`, `POST /workflows` | RadioCard |
| 12 템플릿 | `/templates`, 상세 시트 | `GET /templates`, ★`GET /templates/{id}`, `POST /templates/{id}/instantiate`, ★`GET /credentials`, `GET /mcp/servers` | Sheet, FlowPreview(읽기 전용 React Flow), Checklist |
| 05·06·07 에이전트 빌더 | `/agents/new`, `/agents/[id]?tab=config\|test\|deploy\|logs` | `GET/PATCH /agents/{id}`, `POST /agents/{id}/skills`, ★`DELETE /agents/{id}/skills/{skillId}`, ★`PUT /agents/{id}/workflows`, `GET /mcp/servers`, ★`GET /mcp/tools`, `POST /runs`, `GET /runs/{id}/events`(SSE), `GET /context/sessions/{id}/blocks`, `PATCH /context/blocks/{id}`, 스냅샷 | EditorShell, ChatPanel, ToolCallCard, ContextPanel, SkillPicker |
| 08 워크플로 편집기 | `/workflows/[id]/edit` | ★`GET /workflows/{id}`, `PUT /workflows/{id}/draft`, `POST /workflows/{id}/validate`, `POST/★GET /workflows/{id}/versions`, ★`GET /node-catalog`, `POST /runs`, SSE, `POST /runs/{id}/cancel`, `POST /approvals/{id}/decision`, 컨텍스트 API | Canvas, NodePalette, Inspector, RunConsole, ContextPanel, ConflictDialog, VersionSheet |
| 10 실행 로그 | `/runs`, `/runs/[id]` | ★`GET /runs`(필터·커서), `GET /runs/{id}`, SSE, `POST /runs`(재실행), `POST /runs/{id}/cancel`, `POST /approvals/{id}/decision` | DataTable, Gantt, JsonViewer, ThreeViewer(지연 로드), ApprovalCard |
| 09 배포 · API | `/deploy`, `/deploy/[endpointId]?tab=…` | ★`GET /endpoints`, `POST /endpoints`, ★`GET/PATCH /endpoints/{id}`, ★`GET /endpoints/check-slug`, ★`GET /endpoints/{id}/stats`, ★`GET /endpoints/{id}/webhook-deliveries`, ★`POST …/redeliver`, `GET /a/{ws}/{slug}/openapi.json`, `POST /a/{ws}/{slug}`, ★`GET /api-keys`, `POST /api-keys`, `DELETE /api-keys/{id}` | CodeTabs, CopyButton, BarChart(SVG), ApiKeyTable, IssueKeyDialog |
| 11 연동 | `/integrations?tab=mcp\|credentials\|kb\|model-keys` | `GET/POST /mcp/servers`, `POST /mcp/servers/{id}/sync`, ★`GET /mcp/tools`, ★`GET /credentials`, `POST /credentials`, ★`DELETE /credentials/{id}`, ★`GET /knowledge-bases` | DataTable, StatusBadge |
| 13 마켓 | `/market` | `GET /market/products?q&category&sort` | ProductCard, FilterChips |
| 14 상품 상세 | `/market/[id]` | ★`GET /market/products/{id}`, ★`GET /market/products/{id}/reviews`, `POST /market/products/{id}/purchase` | Markdown, RatingBars, RadioCard, PaymentDialog |
| 15 판매 등록 | `/market/sell` | `GET /agents`, ★`POST /market/scan`, `POST /market/products` | Stepper, ScanFindingList |
| 16 내 판매 | `/market/sales` | ★`GET /market/my-products`, ★`GET /market/sales-stats` | StatCard, BarChart |
| (없음) 구매 내역 | `/market/purchases` | ★`GET /licenses`, ★`POST /licenses/{id}/review` | DataTable, ReviewDialog |
| 17 설정 | `/settings?tab=team\|budget\|api-keys\|billing\|general` | `GET /workspaces/{id}/members`, `POST /workspaces/{id}/invites`, ★`PATCH/DELETE /workspaces/{id}/members/{userId}`, ★`PATCH /workspaces/{id}`, `GET/PUT /budgets`, `GET /usage`, API 키 | PermissionGuard(툴팁), DataTable, BarChart |
| 공통 셸 | `(app)/layout.tsx` | ★`GET /workspaces`, ★`GET /auth/me`, ★`GET /approvals?status=pending` | Sidebar, Topbar, WorkspaceSwitcher, CommandPalette(⌘K), ShortcutHelp(?) |

## 2. Figma에 없지만 필요한 화면·상태

| 종류 | 항목 |
|---|---|
| 화면 | 로그인, 회원가입, 실행 상세 전체 화면(`/runs/[id]`), 엔드포인트 상세 탭(OpenAPI·플레이그라운드·웹훅), 구매 내역(`/market/purchases`), 결제 완료 화면, 404, 전역 오류(`error.tsx`, `global-error.tsx`) |
| 다이얼로그·시트 | 삭제 확인, 이름 변경, 가져오기(JSON), 템플릿 상세 시트, 워크플로 연결, 테스트 실행 입력 폼, 충돌(409) 다이얼로그, 버전 저장·버전 목록 시트, 새 배포, API 키 발급(평문 1회), 모의 결제, 리뷰 작성, 멤버 초대, 자격증명 등록, 단축키 도움말, 커맨드 팔레트 |
| 상태 | 모든 목록·상세의 로딩 skeleton, 빈 상태(첫 사용 안내 + 주 행동 버튼), 오류 상태(Problem Details 문구 + 재시도), 저장 상태(저장 중/저장됨/오류), SSE 연결 끊김 배너·폴링 전환, 권한 없음(viewer 비활성 + 이유 툴팁), 예산 초과(402) 안내, 검증 오류 노드 표시 |

## 3. 이슈 목록 (3단계 순서)

GitHub 이슈는 아직 만들지 않았다(이슈 번호 없음 → 브랜치 `feat/frontend-mvp` 하나 사용).

| # | 제목 | 수락 조건 |
|---|---|---|
| S0 | 프로젝트 뼈대 | ① Next 15 + 스택 설치, 토큰 라이트/다크 ② 사이드바·상단 바·라우트 빈 페이지 ③ api-client·sse·copy ④ MSW 토글 ⑤ boundaries·commitlint·Vitest·Playwright 동작 |
| S1 | 타입·목 API | ① entities zod 스키마+훅 ② 메모리 DB, 지연·`?mock_error` ③ 2.6.2 전 엔드포인트 핸들러 ④ 실행 시뮬레이터(SSE) ⑤ 시드 데이터 수량 충족 + 핸들러 테스트 |
| 3-1 | 로그인·회원가입 | ① zod 검증 오류 문구 ② 소셜 버튼 목 로그인 ③ `redirect` 복귀 ④ 비로그인 접근 시 `/login` |
| 3-2 | 홈 대시보드 | ① 빠른 시작 3종 동작 ② 최근 작업·실행·승인 대기(바로 승인/거부) ③ 사용량 게이지 ④ 추천 템플릿 3개 ⑤ 로딩·빈·오류 |
| 3-3 | 스튜디오 | ① `?tab=` 탭 ② 검색·정렬·필터·보기 전환 ③ 카드 메뉴(열기·복제·이름 변경·삭제 확인, viewer 비활성) ④ 무한 스크롤 ⑤ 새로 만들기 |
| 3-4 | 템플릿 갤러리 | ① 8개 카테고리·검색 ② 상세 시트(읽기 전용 미리보기, 연결 체크리스트) ③ 사용하기 → 복제 후 빌더 이동 ④ 빠진 연결 안내 배너 |
| 3-5 | 에이전트 빌더 | ① 기본 정보·모델·폴백·온도·프롬프트(토큰 추정) ② 스킬 추가 다이얼로그·승인 스위치 ③ 워크플로 연결·별칭 ④ 저장 버튼 + 이탈 경고 ⑤ 테스트 채팅 SSE 스트리밍 |
| 3-6① | 편집기 캔버스·팔레트 | ① 8그룹 47블록 검색·드래그 ② 포트 타입 검사 ③ 다중 선택·복사·붙여넣기·삭제 ④ undo/redo ⑤ 미니맵·줌·자동 정렬 |
| 3-6② | 노드 인스펙터 | ① 타입별 폼 10종 ② `{{노드.output.필드}}` 자동완성 ③ MCP 입력 스키마 폼 자동 생성 ④ 검증 오류 빨간 테두리·목록·이동 |
| 3-6③ | 자동 저장·충돌 | ① 1.5초 디바운스 PUT + If-Match ② 저장 상태·재시도 ③ 이탈 경고 ④ 409 다이얼로그(덮어쓰기/불러오기) ⑤ 버전 저장·목록 |
| 3-6④ | 실행 콘솔·SSE | ① 입력 폼 → 실행 ② 노드 상태 실시간 ③ 로그(가상 스크롤)·입출력·비용 탭 ④ 승인·취소 ⑤ 재연결 배너 |
| 3-6⑤ | 컨텍스트 패널 | ① 블록 목록 ② 고정·끄기·우선순위 PATCH + If-Match ③ 토큰 게이지 70% 표시 ④ 압축 요약·원문 펼치기 ⑤ 스냅샷 저장·복원 |
| 3-7 | 실행 목록·상세 | ① 필터·기간·표·커서 ② 간트 타임라인·시도/폴백 배지 ③ JSON 뷰어·오류 코드 ④ 3D 뷰어 지연 로드 ⑤ SSE 갱신·승인 카드·재실행 |
| 3-8 | 배포·API 키 | ① 엔드포인트 목록·상태 스위치 ② 새 배포(slug 실시간 검사) ③ 상세 5탭 ④ API 키 평문 1회·폐기 |
| 3-9 | 마켓 | ① 목록 검색·카테고리·정렬 ② 상세(README·리뷰 분포·버전) ③ 구매 → 결제 → 완료 ④ 판매 등록 보안 검사 ⑤ 구매 내역·리뷰·내 판매 |
| 3-10 | 설정·연동 | ① 워크스페이스·압축 임계치 ② 멤버 초대·역할·owner 1명 ③ 자격증명·MCP(연동 화면) ④ 예산·사용량 차트 ⑤ viewer 비활성 + 툴팁 |
| 3-11 | 공통 마무리 | ① ⌘K 팔레트 ② 단축키 도움말 ③ 상태·토스트 통일 ④ 1280/1440·다크 점검 ⑤ 번들 크기 확인 |
| 4 | 통합 E2E | prompts.md 4단계 7개 흐름 통과 |

## 4. 결정 필요 (Figma ↔ 설계서·prompts.md 차이와 고른 기본안)

우선순위 규칙(CLAUDE.md): **Figma(배치·흐름) > design.md > docs/figma**. prompts.md는 작업 지시서라 Figma와 충돌하면 Figma 배치를 따르되, prompts.md가 요구한 기능은 빠뜨리지 않고 Figma 배치 안에 넣는다.

| # | 차이 | 고른 기본안 | 이유 |
|---|---|---|---|
| D1 | 사이드바 메뉴: Figma는 만들기(홈·스튜디오)/운영(배포·API·실행 로그·연동)/탐색(템플릿·마켓·내 판매)/설정, prompts.md는 홈·스튜디오·템플릿·실행·배포·마켓·설정 | **Figma 구성** 사용 | 배치·흐름은 Figma가 기준. prompts의 항목은 모두 포함됨 |
| D2 | 자격증명·MCP 위치: Figma는 별도 **연동** 화면, design.md 3.4.1·prompts 3-10은 `settings/credentials\|mcp` | `/integrations` 화면(탭: MCP 서버·자격증명·지식베이스·모델 키)으로 구현, `/settings/credentials`·`/settings/mcp`는 `/integrations`로 리다이렉트 | Figma 우선 + 설계서 경로도 살림 |
| D3 | 설정 탭: Figma(팀·권한/예산·사용량/결제·정산/일반) vs prompts(워크스페이스/멤버/자격증명/MCP/API 키/예산/개인) | **팀·권한 · 예산·사용량 · API 키 · 결제·정산 · 일반**(일반 = 워크스페이스 이름·slug·압축 임계치 + 개인 테마·언어) | Figma 탭 유지 + prompts가 요구한 API 키·워크스페이스·개인 설정 포함 |
| D4 | 홈 "설명으로 초안 만들기": 설계서에 자연어 → 초안 생성 API 없음 | 목에서는 **키워드로 가장 가까운 템플릿을 고르고 `POST /templates/{id}/instantiate`**(이름·설명은 입력 문장으로), 맞는 템플릿이 없으면 빈 에이전트/워크플로 생성 | 새 API를 지어내지 않고 기존 API로 같은 흐름 재현 |
| D5 | 에이전트 빌더 배치: Figma는 상단 탭(구성/테스트·컨텍스트/배포/로그) + 구성 탭 3열, prompts는 좌 설정·우 테스트 채팅 | **Figma 탭 구조**. 구성 탭 3열의 오른쪽이 테스트 채팅(prompts 요구 충족), 테스트·컨텍스트 탭은 채팅 + 컨텍스트 패널 | Figma 우선, 기능 동일 |
| D6 | 컨텍스트 패널 위치: Figma는 에이전트 테스트 탭, prompts 3-6⑤는 워크플로 편집기 오른쪽 탭 | **두 곳 모두**. 패널은 `features/editor/context-panel` 하나로 만들고 앱 계층에서 조합 | 두 문서 요구를 모두 충족, 코드는 하나 |
| D7 | 메모리 설정: Figma는 단기/장기/에피소딕 체크박스 + 임계치·초과 시 동작, DDL `agents`는 `memory_enabled` 하나 | `memory_enabled` 스위치를 기본으로 두고, 세부 체크박스는 목 응답의 **제안 필드 `memory_scopes: string[]`** 에 저장. 임계치는 워크스페이스 `settings.compress_threshold` 사용 | DDL 필드는 그대로, 부족한 부분만 확장 필드로 표시 |
| D8 | 배포 화면: Figma는 대상 드롭다운 + 한 화면(엔드포인트·키·예제·다른 경로), prompts는 목록 `/deploy` + 상세 `/deploy/[endpointId]` 5탭 + 키는 설정 | `/deploy` = 엔드포인트 목록(Figma 헤더·탭 유지), `/deploy/[endpointId]` 개요 탭 = Figma 한 화면 배치, 나머지 탭(호출 예시·OpenAPI·플레이그라운드·웹훅) 추가. API 키 표는 **배포 개요와 설정 > API 키에서 같은 컴포넌트** 사용 | 두 문서 요구 충족 |
| D9 | API 키 접두어: Figma `moa_sk_…`, 설계서 `moa_live_{prefix}_{secret}` | **설계서 형식** | 보안 설계(2.3.3)가 정본 |
| D10 | 엔드포인트 URL: Figma `https://api.moa.dev/a/{slug}`, 설계서 `/a/{workspace}/{slug}` | **`https://api.moa.dev/a/{ws}/{slug}`** | 설계서 라우팅(2.3.2) |
| D11 | 호출 방식: Figma 대화형/단발, 설계서 `mode = sync/async` | **sync/async**(라벨 "동기 · 결과 바로 반환" / "비동기 · job + 웹훅") | DDL enum |
| D12 | 워크플로 단독 배포: Figma 탭 "워크플로 4", DDL `endpoints.agent_id NOT NULL` | 워크플로 탭은 워크플로별로 **연결된 에이전트의 엔드포인트**를 보여 주고, 연결 에이전트가 없으면 "에이전트에 연결해야 배포할 수 있습니다" 안내 | DDL 제약 유지 |
| D13 | 실행 트리거 값: Figma 예약/채팅/에이전트/API/메일, DDL `editor/api/schedule/slash/market` | **DDL enum**, 라벨 편집기/API/예약/슬래시/마켓 | DDL 정본 |
| D14 | 실행 로그 배치: Figma는 표 + 오른쪽 상세 카드, prompts는 표 + 별도 상세 페이지 | `/runs` = 표 + 오른쪽 요약 패널(Figma), "상세 보기"로 `/runs/[id]` 전체 화면(prompts) | 둘 다 충족 |
| D15 | 승인 "수정 후 승인": 설계서 decision은 approve/reject + comment만 | 수정한 내용을 `comment`에 담아 approve | API 추가 없이 재현 |
| D16 | 역할별 권한: Figma 표는 제작자에게 "실행 승인 ●", "배포·API 키 발급 —"; 설계서 3.1.1은 maker 배포 ✓·API 키 —, 승인은 승인자/admin | **설계서 3.1.1** 기준으로 권한 체크·표 표시 | 보안 설계가 정본(UI 표기만의 문제) |
| D17 | 비용 단위: Figma 홈·설정은 ₩, DDL·설계서는 USD(`cost_usd`, `monthly_limit_usd`), 마켓 가격만 KRW | 실행 비용·예산은 **USD 표시**, 마켓 가격은 **KRW** | 환율 변환을 지어내지 않음 |
| D18 | 마켓 "무료 공유": DDL `license_types`는 clone/api_sub만 | 무료 = **clone + `price_clone_krw = 0`** | DDL 유지 |
| D19 | 내 판매(Figma) vs 구매 내역(prompts) | **둘 다** 구현: `/market/sales`, `/market/purchases` | 둘 다 요구됨 |
| D20 | 판매 등록: Figma 5단계 마법사, prompts는 한 흐름 | **Figma 5단계**(게시할 항목 → 소개 정보 → 보안 점검 → 가격·라이선스 → 미리보기·제출) | Figma 우선 |
| D21 | 템플릿 카테고리: Figma 칩(업무 자동화·문서 Q&A·리서치·디자인·고객 응대·개발), prompts 8개(콘텐츠·리서치·고객지원·데이터·개발·마케팅·3D·디자인·업무자동화) | **prompts의 8개** + Figma의 종류 탭(전체/에이전트/워크플로) | 24개/8개 데이터 요구가 명시적, Figma 칩은 일부 예시 |
| D22 | 마켓 카테고리: Figma 리서치·마케팅·문서·디자인·고객 응대·개발·HR | **Figma 7개** | 마켓은 다른 지시 없음 |
| D23 | 노드 팔레트: Figma 5그룹(입력·트리거/AI/도구/흐름 제어/MCP), prompts 8그룹 47블록 | **8그룹 47블록**(입력·출력, LLM, 도구·MCP, 로직, 데이터, 지식, 3D, 사람·승인), 시각 스타일은 Figma | 데이터 요구 명시, 설계서 HANDLERS 10종과 대응 |
| D24 | 에이전트 버전: Figma "버전 v3 ▾"가 에이전트에도 있음, DDL은 워크플로만 버전 | 에이전트 빌더는 **연결된 주 워크플로의 버전**을 보여 줌, 워크플로 편집기는 자체 버전 목록 | DDL 유지 |
| D25 | 새로 만들기: Figma는 전용 화면, prompts는 스튜디오 "새로 만들기" 드롭다운 | 둘 다: 드롭다운 항목이 `/studio/new?type=…`로 이동 | Figma 흐름 + prompts 요구 |
| D26 | 상단 "/ 명령으로 실행하거나 검색" 입력 | 클릭·⌘K로 **커맨드 팔레트** 열기. `/슬러그 내용` 입력 시 SlashCommandRouter(2.3.5) 흉내로 해당 엔드포인트 실행 | Figma + prompts 3-11 |
| D27 | 색: Figma 와이어프레임은 따뜻한 회색 배경 | CLAUDE.md **디자인 토큰** 사용 | CLAUDE.md 규정 |
| D28 | 스튜디오 카드 상태(배포됨·마켓 판매 중·구매함 등): DDL에 없는 파생값 | 목 목록 응답에 **집계 필드**(`endpoint_count`, `run_count`, `last_run_at`, `skill_count`, `workflow_count`, `listed`, `purchased`) 추가 | 백엔드 조회 쿼리로 만들 수 있는 값, 표시용 |
| D29 | 로그인 화면 없음 | shadcn 카드 기반으로 직접 설계 | — |

## 5. 목 API 추가 엔드포인트(설계서 2.6.2에 없음 → 백엔드와 합의 필요)

`GET /auth/me`, `POST /auth/logout`, `POST /auth/signup`, `GET /workspaces`, `PATCH /workspaces/{id}`, `PATCH|DELETE /workspaces/{id}/members/{userId}`, `GET /workflows/{id}`, `PATCH|DELETE /workflows/{id}`, `GET /workflows/{id}/versions(/{v})`, `POST /agents|workflows/{id}/duplicate`, `DELETE /agents/{id}/skills/{skillId}`, `PUT /agents/{id}/workflows`, `GET /node-catalog`, `GET /runs`, `GET /approvals`, `GET /context/sessions/{id}`, `GET /context/sessions/{id}/snapshots`, `GET /mcp/tools`, `GET|DELETE /credentials`, `GET /knowledge-bases`, `GET /endpoints`, `GET|PATCH /endpoints/{id}`, `GET /endpoints/check-slug`, `GET /endpoints/{id}/stats`, `GET /endpoints/{id}/webhook-deliveries`, `POST /endpoints/{id}/webhook-deliveries/{d}/redeliver`, `GET /api-keys`, `GET /templates/{id}`, `GET /market/products/{id}`, `GET /market/products/{id}/reviews`, `POST /market/scan`, `GET /market/my-products`, `GET /market/sales-stats`, `GET /licenses`, `POST /licenses/{id}/review`

1차 범위 밖 기능을 목으로 돌리려고 더한 확장 엔드포인트(`src/mocks/handlers/extras.ts`, 설계서 미결 3·7 관련):
`GET /context/sessions?agent_id`, `GET /market/sellers/{name}`, `POST|DELETE /market/sellers/{name}/follow`, `GET|POST /market/products/{id}/trial`(3회, 초과 시 429 `MOA-RATE-001`), `POST /market/reviews/{id}/reply`, `GET|PUT /billing`(소유자, 끝 4자리만 저장·응답), `GET|POST /knowledge-bases/{id}/documents`(사전 서명 URL 흉내, 대기→색인 중→준비됨/실패), `DELETE /knowledge-bases/{id}/documents/{docId}`, `GET|POST /presets/3d`(같은 이름이면 덮어씀), `GET|PUT|DELETE /endpoints/{id}/slack`. 기존 엔드포인트 확장: `POST /mcp/servers`의 `auth`(`none`·`token`·`oauth`)와 `oauth_code`, `POST /runs`의 `definition`·`label`(워크플로 없는 체험 실행).

## 6. 진행 순서

0단계(이 문서) → 1단계 뼈대 → 2단계 타입·목 API → 3-1 ~ 3-11 → 4단계 E2E. 진행 결과는 `docs/frontend-report.md`.
