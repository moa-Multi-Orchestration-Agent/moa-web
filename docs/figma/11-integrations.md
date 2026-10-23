# 11 연동 (6:851) — `11-integrations.png`
라우트: `/integrations` (Figma 사이드바 "연동")

## 구성
- 헤더 "연동" / "MCP 서버를 연결하면 도구가 스킬과 노드로 바로 추가됩니다. 자격증명 · 지식베이스 · 모델 키도 여기서 관리합니다."
- 탭: MCP 서버 · 자격증명 · 지식베이스 (RAG) · 모델 키
- **MCP 서버 카드(2열)**: 아이콘, 이름(GitHub, Slack, Notion, Google Drive, Filesystem), 상태 배지 "연결됨", "도구 12개 → 스킬 · 노드로 추가됨"; 점선 카드 `+ MCP 서버 추가`
- **자격증명** 표 + `+ 추가`: 자격증명명 · 종류(SMTP/모델 키/API Key) · 사용 중 · 상태(암호화 저장 / 만료 7일 전 주황)
- 오른쪽 **MCP 서버 추가** 패널: 서버 URL, 전송 방식 "Streamable HTTP ▾", 인증 "OAuth 로그인 ▾", **가져올 도구** 체크 목록("search_pages → “Notion 페이지 검색”"), 안내 문구, `연결하고 추가`
