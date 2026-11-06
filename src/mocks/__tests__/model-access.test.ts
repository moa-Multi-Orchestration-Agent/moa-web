import { beforeEach, describe, expect, it } from 'vitest';
import { credentialFormSchema, findModelStatus, modelKeyInfo, modelsResponseSchema, splitModelId } from '@/entities/credential';
import { modelLabel } from '@/entities/agent';
import { api, fail, fresh } from './helpers';

beforeEach(() => fresh());

interface Cred { id: string; base_url: string | null; masked: string; label: string }

describe('모델 키 API 주소(base URL)', () => {
  it('OpenAI 호환 서버는 주소가 필수이고 키는 비워도 된다', async () => {
    expect((await fail(api.post('/credentials', { provider: 'openai_compatible', label: 'vLLM', secret: '' }))).status).toBe(422);
    expect((await fail(api.post('/credentials', { provider: 'openai_compatible', label: 'x', base_url: 'ftp://a.example.com' }))).status).toBe(422);
    expect((await fail(api.post('/credentials', { provider: 'slack', label: 's', secret: 'xoxb-12345678', base_url: 'https://a.example.com' }))).status).toBe(422);
    const c = await api.post<Cred>('/credentials', { provider: 'openai_compatible', label: '사내 vLLM', base_url: 'http://localhost:8001/v1/', purposes: ['llm'] });
    expect(c.base_url).toBe('http://localhost:8001/v1');
    expect(c.masked).toBe('키 없음');
    const models = modelsResponseSchema.parse(await api.get('/models'));
    const fam = models.families.find((f) => f.id === 'openai_compatible')!;
    expect(fam.source).toBe('workspace');
    expect(fam.credentials[0]!.base_url).toBe('http://localhost:8001/v1');
    // 이름·주소 수정, 호환 서버 주소는 비울 수 없다
    const e = await api.patch<Cred>(`/credentials/${c.id}`, { label: 'vLLM 2', base_url: 'https://llm.example.com/v1' });
    expect(e.label).toBe('vLLM 2');
    expect(e.base_url).toBe('https://llm.example.com/v1');
    expect((await fail(api.patch(`/credentials/${c.id}`, { base_url: '' }))).status).toBe(422);
  });

  it('주소를 등록하지 않은 호환 모델은 실행 불가로 안내한다', async () => {
    const models = modelsResponseSchema.parse(await api.get('/models'));
    const info = modelKeyInfo(models, 'openai_compatible:qwen2.5-7b', null)!;
    expect(info.model.source).toBe('missing');
    expect(info.tone).toBe('error');
    // 목록 모델은 그대로 찾는다
    expect(findModelStatus(models, 'gpt-4o')?.family).toBe('openai');
    expect(findModelStatus(models, 'openai:gpt-4.1')?.label).toBe('gpt-4.1 (OpenAI)');
  });

  it('폼 검사: 호환 서버는 주소 필수, 일반 키는 값 8자 이상', () => {
    expect(credentialFormSchema.safeParse({ provider: 'openai_compatible', label: 'a', secret: '' }).success).toBe(false);
    expect(credentialFormSchema.safeParse({ provider: 'openai_compatible', label: 'a', secret: '', base_url: 'https://x.example.com/v1' }).success).toBe(true);
    expect(credentialFormSchema.safeParse({ provider: 'openai', label: 'a', secret: 'short' }).success).toBe(false);
    expect(credentialFormSchema.safeParse({ provider: 'openai', label: 'a', secret: 'sk-12345678', base_url: 'gw.example.com' }).success).toBe(false);
  });
});

describe('직접 입력 모델·생성 파라미터', () => {
  it('계열:모델id를 나누고 이름을 보여 준다', () => {
    expect(splitModelId('openai_compatible:meta-llama/llama-3.1-70b')).toEqual({ family: 'openai_compatible', model: 'meta-llama/llama-3.1-70b' });
    expect(splitModelId('gpt-4o')).toBeNull();
    expect(splitModelId('foo:bar')).toBeNull();
    expect(modelLabel('openai:gpt-4.1')).toBe('gpt-4.1 (OpenAI)');
    expect(modelLabel('claude-sonnet-4')).toBe('Claude Sonnet');
  });

  it('에이전트 model_params를 저장하고 돌려준다', async () => {
    const a = await api.post<{ id: string; model_params: Record<string, unknown> }>('/agents', { name: '파라미터', model: 'openai:gpt-4.1', model_params: { max_tokens: 500 } });
    expect(a.model_params).toEqual({ max_tokens: 500 });
    const b = await api.patch<{ model_params: Record<string, unknown> }>(`/agents/${a.id}`, { model_params: { response_format: 'json' } });
    expect(b.model_params).toEqual({ response_format: 'json' });
  });
});
