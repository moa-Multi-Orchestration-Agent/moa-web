/**
 * 계약서 검토(llm.risk_check) 노드의 계약서 종류별 기본값.
 * 인스펙터에서 하나를 고르면 이 값이 노드 config에 그대로 채워진다. 백엔드는 config만 보고 검사하므로
 * 프리셋은 프론트에만 둔다(근로계약서 값은 백엔드 카탈로그 기본값과 같다).
 *
 * 법 조항·기준값은 발표·배포 전에 사람이 원문으로 다시 확인해야 한다.
 */

export interface ChecklistItem {
  id: string;
  title: string;
  check?: string;
  law?: string;
  default_level?: string;
}

export interface Criterion {
  label: string;
  value: string;
}

export interface ContractPreset {
  id: string;
  /** 드롭다운에 보이는 이름 */
  label: string;
  contract_kind: string;
  reviewer_role: string;
  /** 첫 값이 기본 입장 */
  stances: string[];
  checklist: ChecklistItem[];
  criteria: Criterion[];
  guidance: string[];
  skip_labels: string[];
}

/** 프리셋 없이 사용자가 직접 채우는 경우의 id */
export const CUSTOM_PRESET = 'custom';

export const CONTRACT_PRESETS: ContractPreset[] = [
  {
    id: 'labor',
    label: '근로계약서',
    contract_kind: '근로계약서',
    reviewer_role: '노무 전문가',
    stances: ['근로자', '사용자'],
    checklist: [
      { id: 'penalty', title: '위약금·손해배상 예정', check: '중도 퇴사 시 배상액 예정, 교육비 전액 반환, 임금·퇴직금 일방 공제', law: '근로기준법 제20조, 제43조', default_level: '높음' },
      { id: 'wage', title: '임금·포괄임금', check: '최저임금 미달, 연장·야간·휴일수당을 기본급에 포함시켜 추가 지급하지 않음', law: '최저임금법, 근로기준법 제56조', default_level: '높음' },
      { id: 'hours', title: '근로시간·연장근로', check: '주 52시간 초과 가능성, 연장근로 사전 포괄 동의', law: '근로기준법 제50·53조', default_level: '높음' },
      { id: 'leave', title: '휴일·연차휴가', check: '주휴일 누락, 연차 사용 제한, 미사용 연차 수당 미지급', law: '근로기준법 제55·60조', default_level: '중간' },
      { id: 'dismissal', title: '해고·계약 해지', check: '예고 없는 즉시 해지, 30일 해고예고 누락, 정당한 이유 없는 해고', law: '근로기준법 제23·26조', default_level: '높음' },
      { id: 'probation', title: '수습·계약기간', check: '수습 3개월 초과 감액, 90% 미만 지급, 1년 미만 계약인데 수습 감액', law: '최저임금법 제5조', default_level: '중간' },
    ],
    criteria: [
      { label: '2026년 최저임금(시간급)', value: '10,320원' },
      { label: '월 환산액(주 40시간·월 209시간 기준)', value: '2,156,880원' },
    ],
    guidance: [
      '단어만 보고 판단하지 말고 조건과 금액·기간을 함께 본다.',
      '교육비를 실제 지출액·잔여기간 비례로 반환하게 하면 적법할 수 있다.',
      '고정연장수당의 시간이 명시되고 초과분을 따로 지급하면 적법한 형태다.',
      '근로자대표와 서면합의한 연차 대체(제62조)는 허용된다. 합의가 실제로 있는지 확인이 필요하다고 적는다.',
      '법 조항을 준용한다고만 쓴 조항은 위험 없음으로 본다.',
    ],
    skip_labels: ['근로계약서 아님'],
  },
  {
    id: 'lease',
    label: '주택 임대차계약서',
    contract_kind: '주택 임대차계약서',
    reviewer_role: '주택 임대차 계약 검토자',
    stances: ['임차인', '임대인'],
    checklist: [
      { id: 'deposit', title: '보증금 반환', check: '계약 종료 후 반환 시기 불명확, "새 임차인 입주 시 반환" 같은 조건부 반환, 반환 지연 책임 면제', law: '민법 제536조, 주택임대차보호법 제3조의2', default_level: '높음' },
      { id: 'priority', title: '대항력·우선변제', check: '전입신고·확정일자를 금지하거나 늦추게 함, 잔금일 당일 근저당 설정 허용, 선순위 권리·체납 세금 기재 없음', law: '주택임대차보호법 제3조, 제3조의2', default_level: '높음' },
      { id: 'term', title: '계약기간·갱신', check: '임차인에게만 불리한 2년 미만 기간 강제, 계약갱신요구권 포기, 묵시적 갱신 배제', law: '주택임대차보호법 제4조, 제6조, 제6조의3, 제10조', default_level: '높음' },
      { id: 'rent_increase', title: '차임·보증금 증액', check: '5% 상한을 넘는 증액 약정, 임대인이 일방적으로 증액할 수 있게 함, 1년 안에 다시 증액', law: '주택임대차보호법 제7조, 같은 법 시행령 제8조', default_level: '중간' },
      { id: 'repair', title: '수선 의무', check: '보일러·배관·누수 같은 주요 설비 수선 비용을 임차인에게 모두 넘김', law: '민법 제623조', default_level: '중간' },
      { id: 'restoration', title: '원상복구·위약금', check: '통상 사용에 따른 마모까지 원상복구 요구, 과도한 중도 해지 위약금', law: '민법 제615조, 제654조, 제398조', default_level: '중간' },
    ],
    criteria: [
      { label: '차임·보증금 증액 상한', value: '약정 금액의 5%' },
      { label: '최소 계약기간', value: '2년(임차인은 더 짧은 기간을 주장할 수 있음)' },
      { label: '계약갱신요구권', value: '1회, 갱신 기간 2년' },
    ],
    guidance: [
      '주택임대차보호법에 어긋나고 임차인에게 불리한 약정은 효력이 없다(제10조). 이런 조항은 높음으로 본다.',
      '형광등·소모품 교체 같은 작은 수선을 임차인이 부담하는 약정은 일반적으로 허용된다.',
      '선순위 근저당·체납 세금은 계약서만으로 확인할 수 없다. 등기부등본·납세증명서 확인이 필요하다고 적는다.',
      '법 조항을 준용한다고만 쓴 조항은 위험 없음으로 본다.',
    ],
    skip_labels: ['임대차계약서 아님'],
  },
  {
    id: 'service',
    label: '용역·프리랜서 계약서',
    contract_kind: '용역·프리랜서 계약서',
    reviewer_role: '용역 계약 검토자',
    stances: ['수급인(프리랜서)', '도급인(발주자)'],
    checklist: [
      { id: 'scope', title: '업무 범위·검수', check: '업무 범위 불명확, 횟수 제한 없는 무상 수정, 검수 기준·기간 없음, 발주자의 주관적 만족을 완료 기준으로 함', law: '민법 제664조, 제665조', default_level: '중간' },
      { id: 'payment', title: '대금 지급', check: '지급 시기·조건 불명확, 검수 완료 때까지 무기한 유보, 발주자의 일방 감액', law: '민법 제665조, 하도급법 제13조(하도급 거래인 경우)', default_level: '높음' },
      { id: 'ip', title: '지식재산권', check: '대금 지급 전 권리 이전, 기존에 가진 자산·포트폴리오 사용까지 양도, 2차적저작물작성권 포괄 양도', law: '저작권법 제45조', default_level: '중간' },
      { id: 'liability', title: '손해배상·위약금', check: '손해배상 한도 없음, 과도한 지체상금·위약벌, 간접손해까지 배상', law: '민법 제393조, 제398조', default_level: '높음' },
      { id: 'termination', title: '계약 해지', check: '발주자만 이유 없이 해지 가능, 해지 시 이미 한 일의 대금 미지급', law: '민법 제673조', default_level: '높음' },
      { id: 'employment', title: '실질 근로관계', check: '출퇴근 시간·장소 지정, 상시 업무 지휘·감독, 다른 일 금지 같은 근로자에 가까운 조건', law: '근로기준법 제2조', default_level: '중간' },
    ],
    criteria: [{ label: '하도급 대금 지급기한(하도급법 적용 시)', value: '목적물 수령일부터 60일 이내' }],
    guidance: [
      '개인 프리랜서와의 계약에는 하도급법이 적용되지 않을 수 있다. 적용 여부가 분명하지 않으면 그렇게 적는다.',
      '대금을 모두 받은 뒤 권리를 넘기는 조항은 적법한 형태다.',
      '손해배상을 계약금액 이내로 제한하면 위험을 낮게 본다.',
      '근로자처럼 지휘·감독을 받는 조건이 여러 개 있으면 근로자성 위험으로 적는다.',
      '법 조항을 준용한다고만 쓴 조항은 위험 없음으로 본다.',
    ],
    skip_labels: ['용역계약서 아님'],
  },
];

export const contractPreset = (id: string): ContractPreset | undefined => CONTRACT_PRESETS.find((p) => p.id === id);

/** 프리셋을 고를 때 노드 config에 덮어쓸 값. 모델·문서 바인딩 같은 다른 설정은 건드리지 않는다. */
export function presetConfig(p: ContractPreset): Record<string, unknown> {
  return {
    preset: p.id,
    contract_kind: p.contract_kind,
    reviewer_role: p.reviewer_role,
    stance: p.stances[0] ?? '',
    checklist: p.checklist.map((c) => ({ ...c })),
    criteria: p.criteria.map((c) => ({ ...c })),
    guidance: [...p.guidance],
    skip_labels: [...p.skip_labels],
  };
}
