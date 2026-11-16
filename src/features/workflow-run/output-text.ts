import type { InputField } from '@/entities/workflow';
import { isFileRef } from '@/shared/lib/attachments';

/** 실행 결과(output)에서 사람에게 보여 줄 답만 꺼낸다. 출력 노드는 {result}, LLM 노드는 {text, json}을 낸다. */
export function outputText(output: unknown, depth = 0): string {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  if (typeof output !== 'object' || depth > 4) return String(output);
  if (Array.isArray(output)) return output.map((x) => outputText(x, depth + 1)).filter(Boolean).join('\n');
  if (isFileRef(output)) return ''; // 파일은 내려받기 버튼으로 보여 준다
  const o = output as Record<string, unknown>;
  if ('result' in o) return outputText(o.result, depth + 1);
  if (typeof o.text === 'string') return o.text;
  if (typeof o.answer === 'string') return o.answer;
  const keys = Object.keys(o).filter((k) => k !== 'delivered_at');
  if (keys.length === 1) return outputText(o[keys[0]!], depth + 1);
  return JSON.stringify(o, null, 2);
}

/** 대화창에 적은 문장을 넣을 칸: 필수 문자열 칸 → 첫 문자열 칸. 칸이 없으면 message로 보낸다. */
export function chatField(fields: InputField[]): string {
  const strings = fields.filter((f) => f.type === 'string' && !f.enum?.length);
  return (strings.find((f) => f.required) ?? strings[0])?.name ?? 'message';
}

/** 실행 입력: 다른 칸은 기본값·직접 적은 값, 대화 칸은 방금 적은 문장 */
export function buildInput(fields: InputField[], extra: Record<string, string>, text: string): Record<string, unknown> {
  const main = chatField(fields);
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.name === main) continue;
    const raw = extra[f.name];
    if (raw === undefined || raw === '') {
      if (f.default !== undefined) out[f.name] = f.default;
      continue;
    }
    out[f.name] = f.type === 'number' || f.type === 'integer' ? Number(raw) : f.type === 'boolean' ? raw === 'true' : raw;
  }
  out[main] = text;
  return out;
}
