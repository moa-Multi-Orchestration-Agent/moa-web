import {
  BadgeDollarSign,
  Home,
  LayoutGrid,
  LayoutTemplate,
  Plug,
  Rocket,
  ScrollText,
  Settings,
  Store,
} from 'lucide-react';
import { copy } from '@/shared/lib/copy';

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: React.ElementType;
  /** 활성 판정에 쓰는 경로 접두어 */
  match: string[];
}

/** Figma 사이드바 구성 (frontend-plan D1) */
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: copy.nav.groups.build,
    items: [
      { href: '/home', label: copy.nav.home, short: copy.nav.home, icon: Home, match: ['/home'] },
      {
        href: '/studio',
        label: copy.nav.studio,
        short: copy.nav.studio,
        icon: LayoutGrid,
        match: ['/studio', '/agents', '/workflows'],
      },
    ],
  },
  {
    label: copy.nav.groups.operate,
    items: [
      { href: '/deploy', label: copy.nav.deploy, short: copy.nav.deployShort, icon: Rocket, match: ['/deploy'] },
      { href: '/runs', label: copy.nav.runs, short: copy.nav.runsShort, icon: ScrollText, match: ['/runs'] },
      {
        href: '/integrations',
        label: copy.nav.integrations,
        short: copy.nav.integrations,
        icon: Plug,
        match: ['/integrations'],
      },
    ],
  },
  {
    label: copy.nav.groups.explore,
    items: [
      {
        href: '/templates',
        label: copy.nav.templates,
        short: copy.nav.templates,
        icon: LayoutTemplate,
        match: ['/templates'],
      },
      {
        href: '/market',
        label: copy.nav.market,
        short: copy.nav.market,
        icon: Store,
        match: ['/market'],
      },
      {
        href: '/market/sales',
        label: copy.nav.sales,
        short: copy.nav.salesShort,
        icon: BadgeDollarSign,
        match: ['/market/sales'],
      },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: '/settings',
  label: copy.nav.settings,
  short: copy.nav.settings,
  icon: Settings,
  match: ['/settings'],
};

export const ALL_NAV: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

export function isActive(item: NavItem, pathname: string) {
  if (item.href === '/market') return pathname === '/market' || (/^\/market\//.test(pathname) && !pathname.startsWith('/market/sales'));
  return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`) || pathname.startsWith(`${m}?`));
}

/** 편집기 화면은 Figma처럼 축소 사이드바를 쓴다 */
export function isEditorPath(pathname: string) {
  return /^\/agents\/[^/]+/.test(pathname) || /^\/workflows\/[^/]+\/edit/.test(pathname);
}
