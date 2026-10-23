'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from './skeleton';

/** 마크다운 렌더러(react-markdown)는 필요한 화면에서만 지연 로드한다 */
export const Markdown = dynamic(() => import('react-markdown'), { ssr: false, loading: () => <Skeleton className="h-24 w-full" /> });
