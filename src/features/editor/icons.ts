/** 블록 아이콘(lucide 이름 → 컴포넌트). 편집기 번들에만 들어간다. */
import {
  AlignLeft, ArrowDownWideNarrow, ArrowLeftRight, Bell, Binary, BookOpenText, BookmarkPlus, Bot, Box, Braces, CalendarClock, Camera, ClipboardCheck, Code, FileBox, FileJson, FileText, FileUp, Filter, Flag, GitBranch, GitPullRequest, Globe, HardDrive, History, Inbox, Keyboard, Languages, Merge, MessageSquare, PenTool, Plug, Radio, Repeat, ScanEye, Send, Shapes, Sheet, ShieldAlert, ShieldCheck, Sparkles, Split, Tags, TextCursorInput, Timer, UserPen, Webhook, Puzzle,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  AlignLeft, ArrowDownWideNarrow, ArrowLeftRight, Bell, Binary, BookOpenText, BookmarkPlus, Bot, Box, Braces, CalendarClock, Camera, ClipboardCheck, Code, FileBox, FileJson, FileText, FileUp, Filter, Flag, GitBranch, GitPullRequest, Globe, HardDrive, History, Inbox, Keyboard, Languages, Merge, MessageSquare, PenTool, Plug, Radio, Repeat, ScanEye, Send, Shapes, Sheet, ShieldAlert, ShieldCheck, Sparkles, Split, Tags, TextCursorInput, Timer, UserPen, Webhook,
};

export function blockIcon(name: string | undefined): LucideIcon {
  return (name && ICONS[name]) || Puzzle;
}
