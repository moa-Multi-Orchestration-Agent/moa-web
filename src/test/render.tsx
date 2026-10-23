import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react';
import { TooltipProvider } from '@/shared/ui/tooltip';

export function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
}

export function wrapper(client = makeClient()) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    );
  };
}

export function renderWithQuery(ui: React.ReactElement, client = makeClient()) {
  return { client, ...render(ui, { wrapper: wrapper(client) }) };
}

export function renderHookWithQuery<T>(hook: () => T, client = makeClient()) {
  return { client, ...renderHook(hook, { wrapper: wrapper(client) }) };
}
