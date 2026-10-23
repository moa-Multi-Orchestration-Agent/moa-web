'use client';

import { Component, Suspense, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, useGLTF } from '@react-three/drei';
import { Download, RotateCw } from 'lucide-react';
import { Button } from './button';

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

class LoadBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** glb 3D 뷰어: 드래그 회전·휠 확대·다운로드. next/dynamic(ssr:false)로만 불러 쓴다. */
export default function ThreeViewer({ url, previewUrl, height = 320 }: { url: string; previewUrl?: string | null; height?: number }) {
  const [auto, setAuto] = useState(true);
  const [failed, setFailed] = useState(false);
  return (
    <div className="bg-surface relative overflow-hidden rounded-lg border" style={{ height }}>
      {failed ? (
        previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="3D 결과 미리보기 이미지" className="h-full w-full object-contain" />
        ) : (
          <p className="text-muted flex h-full items-center justify-center text-sm">3D 모델을 불러오지 못했습니다.</p>
        )
      ) : (
        <Canvas camera={{ position: [2.5, 2, 2.5], fov: 45 }} aria-label="3D 결과 뷰어 — 드래그로 회전, 휠로 확대">
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 5, 2]} intensity={1.2} />
          <LoadBoundary onError={() => setFailed(true)}>
            <Suspense fallback={null}>
              <Bounds fit clip observe margin={1.2}>
                <Center>
                  <Model url={url} />
                </Center>
              </Bounds>
            </Suspense>
          </LoadBoundary>
          <OrbitControls makeDefault autoRotate={auto} enablePan={false} />
        </Canvas>
      )}
      <div className="absolute right-2 bottom-2 flex gap-1.5">
        <Button size="xs" variant="outline" onClick={() => setAuto((a) => !a)} aria-pressed={auto}>
          <RotateCw aria-hidden /> {auto ? '회전 멈춤' : '자동 회전'}
        </Button>
        <Button size="xs" variant="outline" asChild>
          <a href={url} download target="_blank" rel="noreferrer">
            <Download aria-hidden /> glb 다운로드
          </a>
        </Button>
      </div>
    </div>
  );
}
