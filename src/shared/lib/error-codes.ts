/** 오류 코드 설명 (design.md 3.3.2) */
const CODES: Record<string, string> = {
  'MOA-AUTH-003': '권한 없음',
  'MOA-AUTH-010': 'API 키 형식 오류',
  'MOA-AUTH-011': 'API 키 만료·폐기',
  'MOA-WF-001': '워크플로 순환',
  'MOA-WF-002': '미연결 입력',
  'MOA-WF-003': '포트 타입 불일치',
  'MOA-WF-004': '시작 노드 오류',
  'MOA-WF-009': '초안 버전 충돌',
  'MOA-WF-010': '불변 버전 수정 시도',
  'MOA-RUN-001': '잘못된 상태 전이',
  'MOA-RUN-002': '예산 초과로 중단',
  'MOA-RUN-003': '실행 시간 초과',
  'MOA-RUN-004': '체크포인트 손상',
  'MOA-NODE-001': '모델 호출 실패(재시도·폴백 모두 실패)',
  'MOA-NODE-002': '도구 타임아웃',
  'MOA-NODE-003': '출력 검증 실패',
  'MOA-NODE-004': '자격증명 없음',
  'MOA-NODE-005': '도구 호출 횟수 초과',
  'MOA-CTX-001': '컨텍스트 블록 없음',
  'MOA-CTX-002': '고정 블록 보호',
  'MOA-CTX-003': '컨텍스트 버전 충돌',
  'MOA-CTX-010': '고정 블록만으로 예산 초과',
  'MOA-CTX-020': '요약 실패',
  'MOA-API-001': '슬러그 중복',
  'MOA-API-002': '엔드포인트 없음',
  'MOA-API-003': '입력 스키마 불일치',
  'MOA-API-004': '멱등 키 충돌',
  'MOA-API-005': '슬러그 형식 오류',
  'MOA-RATE-001': '호출 한도 초과',
  'MOA-BUD-001': '월 예산 초과',
  'MOA-BUD-002': '실행당 한도 초과',
  'MOA-MCP-001': 'MCP 서버 연결 실패',
  'MOA-MCP-003': 'MCP 도구 오류',
  'MOA-APR-001': '이미 처리된 승인',
  'MOA-APR-002': '승인 거부·만료',
  'MOA-MKT-001': '마켓 보안 검사 실패',
  'MOA-MKT-002': '중복 라이선스',
  'MOA-MKT-003': '라이선스 범위 밖',
  'MOA-3D-001': 'Blender 실행 실패',
};

const HINTS: Record<string, string> = {
  'MOA-NODE-001': '모델 제공자 상태를 확인하거나 대체 모델을 추가하세요. 입력에 "fail"이 들어 있으면 목 API가 일부러 실패시킵니다.',
  'MOA-NODE-002': '도구의 타임아웃을 늘리거나 MCP 서버 상태를 확인하세요.',
  'MOA-APR-002': '승인이 거부되었거나 72시간 안에 결정되지 않았습니다. 다시 실행하세요.',
  'MOA-BUD-001': '설정 > 예산·사용량에서 월 한도를 올리세요.',
  'MOA-3D-001': '입력 이미지와 파라미터를 바꿔 다시 실행하세요.',
};

export function describeError(code: string | null | undefined) {
  if (!code) return null;
  return { code, title: CODES[code] ?? '알 수 없는 오류', hint: HINTS[code] ?? null };
}
