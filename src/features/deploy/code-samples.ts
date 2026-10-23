/** 호출 예시 생성(입력 스키마 → curl·JavaScript·Python) */
export function codeSamples(url: string, body: Record<string, unknown>, mode: 'sync' | 'async') {
  const json = JSON.stringify(body, null, 2);
  const oneLine = JSON.stringify(body);
  const curl = `curl -X POST ${url} \\
  -H "Authorization: Bearer $MOA_API_KEY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '${oneLine.replace(/'/g, "'\\''")}'${mode === 'async' ? '\n\n# 202 응답의 status_url을 조회하거나 웹훅으로 완료 알림을 받습니다' : ''}`;
  const js = `const res = await fetch('${url}', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.MOA_API_KEY}\`,
    'Idempotency-Key': crypto.randomUUID(),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(${json.replace(/\n/g, '\n  ')}),
});
if (!res.ok) throw new Error((await res.json()).detail);
const data = await res.json(); // ${mode === 'sync' ? '{ run_id, status, output, usage, latency_ms }' : '{ job_id, status, status_url, events_url }'}`;
  const py = `import os, uuid, requests

res = requests.post(
    "${url}",
    headers={
        "Authorization": f"Bearer {os.environ['MOA_API_KEY']}",
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json=${toPython(body)},
    timeout=60,
)
res.raise_for_status()
print(res.json())`;
  return { curl, js, py };
}

function toPython(v: unknown): string {
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return `[${v.map(toPython).join(', ')}]`;
  return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${JSON.stringify(k)}: ${toPython(x)}`).join(', ')}}`;
}

/** 웹 채팅 위젯 임베드 코드 */
export function embedSnippet(url: string) {
  return `<script src="https://cdn.moa.dev/widget.js" data-endpoint="${url}" data-key="공개 위젯 키" async></script>`;
}
