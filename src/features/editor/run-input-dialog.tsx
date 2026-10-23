'use client';

import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import type { InputField } from '@/entities/workflow';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';

const EXAMPLE: Record<string, string> = {
  query: '접이식 캠핑 의자 컨셉',
  description: '접이식 캠핑 의자, 알루미늄 프레임',
  sketch: 'https://cdn.moa.dev/sketch/chair.png',
  question: '연차는 언제 생기나요?',
  topic: 'AI 에이전트',
  text: '테스트 입력',
};

/** 입력 노드 스키마로 만든 테스트 입력 폼 */
export function RunInputDialog({ open, onOpenChange, fields, onRun }: { open: boolean; onOpenChange: (o: boolean) => void; fields: InputField[]; onRun: (input: Record<string, unknown>) => void }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(fields.map((f) => [f.name, f.default ?? (f.type === 'boolean' ? false : f.type === 'number' || f.type === 'integer' ? 0 : f.type === 'object' || f.type === 'array' ? '' : (EXAMPLE[f.name] ?? ''))])));
    setErrors({});
  }, [open, fields]);

  const submit = () => {
    const errs: Record<string, string> = {};
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (f.required && (v === '' || v === undefined)) errs[f.name] = '필수 입력입니다.';
      if ((f.type === 'object' || f.type === 'array') && typeof v === 'string' && v.trim()) {
        try {
          out[f.name] = JSON.parse(v);
        } catch {
          errs[f.name] = 'JSON 형식이 아닙니다.';
        }
      } else if (v !== '') out[f.name] = f.type === 'number' || f.type === 'integer' ? Number(v) : v;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onRun(out);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>테스트 실행</DialogTitle>
          <DialogDescription>입력 노드에 정의한 필드로 만든 폼입니다. 지금 캔버스 상태(저장 전 포함)로 실행합니다. 입력에 &quot;fail&quot;을 넣으면 실패 흐름을 볼 수 있어요.</DialogDescription>
        </DialogHeader>
        <form
          id="run-input-form"
          className="max-h-[50vh] space-y-3 overflow-y-auto"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {fields.length === 0 ? <p className="text-muted text-sm">입력 필드가 없습니다. 바로 실행합니다.</p> : null}
          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              {f.type === 'boolean' ? (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!values[f.name]} onCheckedChange={(v) => setValues((s) => ({ ...s, [f.name]: v === true }))} />
                  {f.name}
                </label>
              ) : (
                <>
                  <Label htmlFor={`run-${f.name}`}>
                    {f.name}
                    {f.required ? <span className="text-danger"> *</span> : null} <span className="text-muted font-normal">· {f.type}</span>
                  </Label>
                  {f.type === 'object' || f.type === 'array' ? (
                    <Textarea id={`run-${f.name}`} value={String(values[f.name] ?? '')} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))} className="font-mono text-xs" placeholder={f.type === 'array' ? '[]' : '{}'} aria-invalid={!!errors[f.name]} />
                  ) : (
                    <Input id={`run-${f.name}`} type={f.type === 'number' || f.type === 'integer' ? 'number' : 'text'} value={String(values[f.name] ?? '')} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))} aria-invalid={!!errors[f.name]} aria-describedby={errors[f.name] ? `run-${f.name}-err` : undefined} />
                  )}
                  {f.description ? <p className="text-muted text-xs">{f.description}</p> : null}
                  {errors[f.name] ? (
                    <p id={`run-${f.name}-err`} className="text-danger text-xs">
                      {errors[f.name]}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ))}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type="submit" form="run-input-form">
            <Play aria-hidden /> 실행
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
