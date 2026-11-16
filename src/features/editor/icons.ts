/** 블록 아이콘(lucide 이름 → 컴포넌트). 편집기 번들에만 들어간다. */
import {
  AlignLeft, ArrowDownWideNarrow, ArrowLeftRight, Bell, Binary, BookmarkPlus, BookOpenText, Bot, Box, Braces, CalendarClock, Camera, ClipboardCheck, Code, FileBox, FileDown, FileJson, FileText, FileUp, Filter, Flag, GitBranch, GitPullRequest, Globe, HardDrive, History, Inbox, Keyboard, Languages, Layers, ListPlus, Merge, MessageSquare, PenTool, Plug, Puzzle, Radio, Repeat, ScanEye, Send, Shapes, Sheet, ShieldAlert, ShieldCheck, Sparkles, Split, Tags, TextCursorInput, Timer, UserPen, Webhook,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  AlignLeft, ArrowDownWideNarrow, ArrowLeftRight, Bell, Binary, BookmarkPlus, BookOpenText, Bot, Box, Braces, CalendarClock, Camera, ClipboardCheck, Code, FileBox, FileDown, FileJson, FileText, FileUp, Filter, Flag, GitBranch, GitPullRequest, Globe, HardDrive, History, Inbox, Keyboard, Languages, Layers, ListPlus, Merge, MessageSquare, PenTool, Plug, Radio, Repeat, ScanEye, Send, Shapes, Sheet, ShieldAlert, ShieldCheck, Sparkles, Split, Tags, TextCursorInput, Timer, UserPen, Webhook,
};

export function blockIcon(name: string | undefined): LucideIcon {
  return (name && ICONS[name]) || Puzzle;
}
