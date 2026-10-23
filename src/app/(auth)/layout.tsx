export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface flex min-h-dvh items-center justify-center p-6">{children}</div>;
}
