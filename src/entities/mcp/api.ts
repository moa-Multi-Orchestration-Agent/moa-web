import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Page } from '@/shared/lib/api-client';
import { wsKey } from '@/shared/lib/query';
import { mcpServerRowSchema, mcpToolRowSchema, toMcpServer, type McpServerForm, type McpServerRow } from './model';

export const mcpKeys = {
  all: ['mcp'] as const,
  servers: () => ['mcp', wsKey(), 'servers'] as const,
  tools: (serverId?: string) => ['mcp', wsKey(), 'tools', serverId ?? 'all'] as const,
};

export function useMcpServers() {
  return useQuery({
    queryKey: mcpKeys.servers(),
    queryFn: async () => mcpServerRowSchema.array().parse((await api.get<Page<unknown>>('/mcp/servers')).items),
    select: (rows) => rows.map(toMcpServer),
  });
}

export function useMcpTools(serverId?: string) {
  return useQuery({
    queryKey: mcpKeys.tools(serverId),
    queryFn: async () => mcpToolRowSchema.array().parse((await api.get<Page<unknown>>('/mcp/tools', { query: { server_id: serverId } })).items),
  });
}

export function useCreateMcpServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: McpServerForm & { allow_tools?: string[] | null; auth?: 'none' | 'token' | 'oauth'; oauth_code?: string }) =>
      api.post<McpServerRow>('/mcp/servers', { ...input, command: input.transport === 'stdio' ? input.command : null, url: input.transport === 'stdio' ? null : input.url }),
    onSuccess: () => qc.invalidateQueries({ queryKey: mcpKeys.all }),
  });
}

export function useSyncMcpServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/mcp/servers/${id}/sync`),
    onMutate: async (id) => {
      const key = mcpKeys.servers();
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<McpServerRow[]>(key);
      qc.setQueryData<McpServerRow[]>(key, (rows) => rows?.map((s) => (s.id === id ? { ...s, status: 'syncing' } : s)));
      return { prev, key };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(ctx.key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: mcpKeys.all }),
  });
}

export function useDeleteMcpServer() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/mcp/servers/${id}`), onSettled: () => qc.invalidateQueries({ queryKey: mcpKeys.all }) });
}
