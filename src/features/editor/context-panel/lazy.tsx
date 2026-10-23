'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/shared/ui/skeleton';

/** 컨텍스트 패널 지연 로드(실행 화면 시트·에이전트 테스트 탭에서 열 때만) */
export const LazyContextPanel = dynamic(() => import('./index'), { ssr: false, loading: () => <Skeleton className="m-4 h-64" /> });
