'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateWorkflow, useWorkflows } from '@/entities/workflow';
import { copy } from '@/shared/lib/copy';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { Card } from './config-cards';
import { ALIAS_RE, aliasFromName, type DraftSkill, type DraftWorkflow } from './draft';
import { SkillPicker } from './skill-picker';

export function SkillsCard({
  skills,
  workflows,
  setSkills,
  setWorkflows,
  disabled,
}: {
  skills: DraftSkill[];
  workflows: DraftWorkflow[];
  setSkills: (fn: (s: DraftSkill[]) => DraftSkill[]) => void;
  setWorkflows: (fn: (w: DraftWorkflow[]) => DraftWorkflow[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const patch = (key: string, p: Partial<DraftSkill>) => setSkills((all) => all.map((s) => (s.key === key ? { ...s, ...p } : s)));
  return (
    <Card
      title={copy.builder.skills(skills.length)}
      actions={
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
          <Plus aria-hidden /> {copy.builder.addSkill}
        </Button>
      }
    >
      {skills.length === 0 ? (
        <p className="text-muted rounded-md border border-dashed p-4 text-sm">{copy.builder.noSkills}</p>
      ) : (
        <ul className="space-y-2.5">
          {skills.map((s) => (
            <li key={s.key} className="flex items-start gap-3 rounded-lg border p-3">
              <span aria-hidden className="bg-surface mt-0.5 size-9 shrink-0 rounded-md border" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{s.label}</span>
                  <Badge variant={s.kindLabel === 'MCP' ? 'blue' : 'gray'}>{s.kindLabel}</Badge>
                  {!s.id ? <Badge variant="orange">저장 전</Badge> : null}
                </div>
                {s.description ? <p className="text-muted mt-0.5 truncate text-xs">{s.description}</p> : null}
                <label className="mt-2 inline-flex items-center gap-2 text-xs">
                  <Switch checked={s.require_approval} onCheckedChange={(v) => patch(s.key, { require_approval: v })} disabled={disabled} aria-label={copy.builder.approvalSwitch(s.label)} className="scale-90" />
                  <span className={s.require_approval ? 'text-warning font-semibold' : 'text-muted'}>{copy.builder.requireApproval}</span>
                  {s.destructive ? <span className="text-muted">(쓰기 작업이라 기본으로 켜짐)</span> : null}
                </label>
              </div>
              <Switch checked={s.enabled} onCheckedChange={(v) => patch(s.key, { enabled: v })} disabled={disabled} aria-label={copy.builder.enabled(s.label)} />
              <Button variant="ghost" size="icon-sm" onClick={() => setSkills((all) => all.filter((x) => x.key !== s.key))} disabled={disabled} aria-label={copy.builder.removeSkill(s.label)}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <SkillPicker
        open={open}
        onOpenChange={setOpen}
        existing={skills}
        existingWorkflows={workflows}
        onDone={(newSkills, newWorkflows) => {
          setSkills((all) => [...all, ...newSkills]);
          if (newWorkflows.length) setWorkflows((all) => [...all, ...newWorkflows]);
        }}
      />
    </Card>
  );
}

export function WorkflowsCard({ workflows, setWorkflows, disabled }: { workflows: DraftWorkflow[]; setWorkflows: (fn: (w: DraftWorkflow[]) => DraftWorkflow[]) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Card
      title={copy.builder.workflows(workflows.length)}
      actions={
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
          <Plus aria-hidden /> {copy.builder.linkWorkflow}
        </Button>
      }
    >
      {workflows.length === 0 ? (
        <p className="text-muted rounded-md border border-dashed p-4 text-sm">{copy.builder.noWorkflows}</p>
      ) : (
        <ul className="space-y-2.5">
          {workflows.map((w, i) => {
            const bad = !ALIAS_RE.test(w.alias) || workflows.some((x, j) => j !== i && x.alias === w.alias);
            return (
              <li key={w.workflow_id} className="rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {w.name}
                      {i === 0 ? <Badge variant="gray">기본</Badge> : null}
                    </p>
                    {w.io_summary ? <p className="text-muted mt-0.5 text-xs">{w.io_summary}</p> : null}
                  </div>
                  <Link href={`/workflows/${w.workflow_id}/edit`} className="text-primary inline-flex items-center gap-1 text-sm font-semibold hover:underline">
                    열기 <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                  <Button variant="ghost" size="icon-sm" onClick={() => setWorkflows((all) => all.filter((x) => x.workflow_id !== w.workflow_id))} disabled={disabled} aria-label={copy.builder.unlink(w.name)}>
                    <X aria-hidden />
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Label htmlFor={`alias-${w.workflow_id}`} className="text-muted shrink-0 text-xs font-normal">
                    {copy.builder.alias}
                  </Label>
                  <Input
                    id={`alias-${w.workflow_id}`}
                    value={w.alias}
                    onChange={(e) => setWorkflows((all) => all.map((x) => (x.workflow_id === w.workflow_id ? { ...x, alias: e.target.value } : x)))}
                    className="h-8 font-mono text-xs"
                    disabled={disabled}
                    aria-invalid={bad}
                    aria-describedby={`alias-hint-${w.workflow_id}`}
                  />
                </div>
                <p id={`alias-hint-${w.workflow_id}`} className={bad ? 'text-danger mt-1 text-xs' : 'text-muted mt-1 text-xs'}>
                  {bad ? '영문 소문자로 시작, 소문자·숫자·밑줄 2~40자, 다른 별칭과 겹치지 않게' : copy.builder.aliasHint}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-muted mt-3 text-xs">{copy.builder.workflowsFoot}</p>
      <LinkWorkflowDialog open={open} onOpenChange={setOpen} taken={workflows} onLink={(w) => setWorkflows((all) => [...all, w])} />
    </Card>
  );
}

function LinkWorkflowDialog({ open, onOpenChange, taken, onLink }: { open: boolean; onOpenChange: (o: boolean) => void; taken: DraftWorkflow[]; onLink: (w: DraftWorkflow) => void }) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const list = useWorkflows({ limit: 100 });
  const create = useCreateWorkflow();
  const options = list.items.filter((w) => !taken.some((t) => t.workflow_id === w.id));
  const aliases = taken.map((t) => t.alias);

  const submit = async () => {
    if (mode === 'existing') {
      const w = options.find((x) => x.id === selected);
      if (!w) return;
      onLink({ workflow_id: w.id, alias: aliasFromName(w.name, aliases), name: w.name });
    } else {
      if (!name.trim()) return;
      try {
        const w = await create.mutateAsync({ name: name.trim() });
        onLink({ workflow_id: w.id, alias: aliasFromName(w.name, aliases), name: w.name });
        toast.success('새 워크플로를 만들어 연결했습니다. 저장 후 편집기에서 노드를 구성하세요.');
      } catch (e) {
        toast.error((e as Error).message);
        return;
      }
    }
    setSelected('');
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.builder.linkWorkflow}</DialogTitle>
          <DialogDescription>에이전트가 필요할 때 실행할 워크플로를 고르거나 새로 만드세요.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'existing' | 'new')} className="space-y-3">
          <div className="flex items-center gap-2">
            <RadioGroupItem id="lw-existing" value="existing" />
            <Label htmlFor="lw-existing">기존 워크플로 선택</Label>
          </div>
          {mode === 'existing' ? (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-full" aria-label="워크플로">
                <SelectValue placeholder={list.isPending ? '불러오는 중…' : options.length ? '워크플로 고르기' : '연결할 수 있는 워크플로가 없어요'} />
              </SelectTrigger>
              <SelectContent>
                {options.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <div className="flex items-center gap-2">
            <RadioGroupItem id="lw-new" value="new" />
            <Label htmlFor="lw-new">새로 만들기</Label>
          </div>
          {mode === 'new' ? <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="새 워크플로 이름" aria-label="새 워크플로 이름" /> : null}
        </RadioGroup>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {copy.common.cancel}
          </Button>
          <Button onClick={() => void submit()} disabled={create.isPending || (mode === 'existing' ? !selected : !name.trim())}>
            {create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            연결
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
