import { create } from 'zustand';
import { setWorkspaceId } from '@/shared/lib/api-client';

/** 현재 워크스페이스(앱 전역, 메모리). api-client의 X-Workspace-Id와 함께 바뀐다. */
interface CurrentWorkspaceState {
  id: string | null;
  setId: (id: string | null) => void;
}

export const useCurrentWorkspaceStore = create<CurrentWorkspaceState>((set) => ({
  id: null,
  setId: (id) => {
    setWorkspaceId(id);
    set({ id });
  },
}));
