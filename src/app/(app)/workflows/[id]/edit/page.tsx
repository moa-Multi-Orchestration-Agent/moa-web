import type { Metadata } from 'next';
import { copy } from '@/shared/lib/copy';
import { EditorLoader } from './editor-loader';

export const metadata: Metadata = { title: copy.pages.workflowEdit };

export default async function WorkflowEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorLoader id={id} />;
}
