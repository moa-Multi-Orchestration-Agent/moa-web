import { nodeColor } from './node-colors';

/** Figma 스튜디오 표의 "노드 상자 체인" 미니 그림 */
export function MiniChain({ types, className }: { types: string[]; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className ?? ''}`} aria-label={`노드 ${types.length}개`}>
      {types.map((t, i) => (
        <span key={i} className="inline-flex items-center">
          {i > 0 ? <span className="bg-border h-px w-1.5" /> : null}
          <span className="h-2.5 w-4 rounded-[3px] border" style={{ borderColor: nodeColor(t).accent, background: nodeColor(t).soft }} />
        </span>
      ))}
    </span>
  );
}
