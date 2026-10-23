'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { copy } from '@/shared/lib/copy';
import { Button } from './button';

export function CopyButton({
  value,
  label = copy.common.copy,
  iconOnly,
  size = 'sm',
  variant = 'outline',
}: {
  value: string;
  label?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'icon-sm' | 'default';
  variant?: 'outline' | 'ghost';
}) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      toast.success(copy.toast.copied);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error(copy.toast.genericError);
    }
  };
  const Icon = done ? Check : Copy;
  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? 'icon-sm' : size}
      onClick={onClick}
      aria-label={iconOnly ? label : undefined}
    >
      <Icon aria-hidden />
      {iconOnly ? null : done ? copy.common.copied : label}
    </Button>
  );
}
