'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/shared/ui/tooltip';
import { Toaster } from '@/shared/ui/sonner';
import { isApiError } from '@/shared/lib/api-client';
import { MockGate } from './mock-gate';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => {
          // 4xx는 다시 시도해도 같은 결과. 네트워크·5xx·retryable만 1번 더.
          if (isApiError(error) && error.status >= 400 && error.status < 500 && !error.retryable) return false;
          return count < 1;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MockGate>
        <QueryClientProvider client={client}>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </TooltipProvider>
        </QueryClientProvider>
      </MockGate>
    </ThemeProvider>
  );
}
