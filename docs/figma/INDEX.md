# Figma 저장본 색인

원본: https://www.figma.com/design/sHEl9gtq0HliOBer1vLYsR (fileKey `sHEl9gtq0HliOBer1vLYsR`, Page 1 `0:1`)
추출일: 2026-10-23. 프레임은 모두 1440×900.

| # | 화면 이름 | 프레임 node-id | 스크린샷 | 노트 | 구현 라우트 |
|---|---|---|---|---|---|
| — | 컴포넌트(Button·Badge·Nav Item·Field) | `2:40` | [00-components.png](00-components.png) | [00-common.md](00-common.md) | — |
| 01 | 홈 | `3:134` | [01-home.png](01-home.png) | [01-home.md](01-home.md) | `/home` |
| 02 | 스튜디오 — 에이전트 | `3:327` | [02-studio-agents.png](02-studio-agents.png) | [02-studio-agents.md](02-studio-agents.md) | `/studio?tab=agents` |
| 03 | 스튜디오 — 워크플로 | `4:240` | [03-studio-workflows.png](03-studio-workflows.png) | [03-studio-workflows.md](03-studio-workflows.md) | `/studio?tab=workflows` |
| 04 | 새로 만들기 | `4:384` | [04-new.png](04-new.png) | [04-new.md](04-new.md) | `/studio/new` |
| 05 | 에이전트 편집기 — 구성 | `4:656` | [05-agent-config.png](05-agent-config.png) | [05-agent-config.md](05-agent-config.md) | `/agents/[id]` |
| 06 | 에이전트 편집기 — 스킬 추가 | `5:351` | [06-agent-skills.png](06-agent-skills.png) | [06-agent-skills.md](06-agent-skills.md) | `/agents/[id]` 다이얼로그 |
| 07 | 에이전트 편집기 — 테스트 · 컨텍스트 | `5:592` | [07-agent-test-context.png](07-agent-test-context.png) | [07-agent-test-context.md](07-agent-test-context.md) | `/agents/[id]?tab=test` |
| 08 | 워크플로 편집기 | `5:859` | [08-workflow-editor.png](08-workflow-editor.png) | [08-workflow-editor.md](08-workflow-editor.md) | `/workflows/[id]/edit` |
| 09 | 배포 · API | `6:398` | [09-deploy.png](09-deploy.png) | [09-deploy.md](09-deploy.md) | `/deploy`, `/deploy/[endpointId]` |
| 10 | 실행 로그 | `6:665` | [10-runs.png](10-runs.png) | [10-runs.md](10-runs.md) | `/runs`, `/runs/[id]` |
| 11 | 연동 | `6:851` | [11-integrations.png](11-integrations.png) | [11-integrations.md](11-integrations.md) | `/integrations` |
| 12 | 템플릿 | `6:1144` | [12-templates.png](12-templates.png) | [12-templates.md](12-templates.md) | `/templates` |
| 13 | 마켓 | `7:604` | [13-market.png](13-market.png) | [13-market.md](13-market.md) | `/market` |
| 14 | 마켓 상품 상세 | `7:750` | [14-market-detail.png](14-market-detail.png) | [14-market-detail.md](14-market-detail.md) | `/market/[id]` |
| 15 | 마켓 판매 등록 | `7:888` | [15-market-sell.png](15-market-sell.png) | [15-market-sell.md](15-market-sell.md) | `/market/sell` |
| 16 | 내 판매 | `7:1063` | [16-my-sales.png](16-my-sales.png) | [16-my-sales.md](16-my-sales.md) | `/market/sales` |
| 17 | 설정 | `7:1308` | [17-settings.png](17-settings.png) | [17-settings.md](17-settings.md) | `/settings` |

## 추출 메모
- 1차(2026-10-23 오전): `get_metadata` 1회 + `get_screenshot` 15회 후 Starter 플랜 호출 한도에 걸림. 13·15는 메타데이터 배치도로 임시 대체.
- 2차(2026-10-23 오후, 한도 갱신 후): 남은 `7:604`, `7:888`, `2:40` 스크린샷을 받아 저장본을 모두 채웠다. 13·15 노트도 스크린샷 기준으로 고쳤다.
- 화면 수는 17개로 설계서 0.1의 "와이어프레임 17개 화면"과 일치한다. 로그인·회원가입·실행 상세 단독 화면·오류/빈 상태는 Figma에 없다.
