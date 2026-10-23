'use client';

import { cloneElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

/**
 * 권한이 없으면 자식(버튼 등)을 비활성으로 감싸고 이유를 툴팁으로 보여 준다.
 * 비활성 버튼은 포커스를 못 받으므로 span에 tabIndex를 줘서 키보드로도 툴팁을 볼 수 있게 한다.
 */
export function Guarded({
  allowed,
  reason,
  children,
}: {
  allowed: boolean;
  reason: string;
  children: React.ReactElement;
}) {
  if (allowed) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex cursor-not-allowed" aria-label={reason} data-guarded="true">
          {cloneElement(children as React.ReactElement<{ disabled?: boolean }>, { disabled: true })}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
