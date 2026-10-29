import { LogoMark } from '../../components/Logo';

/** Only allow same-site relative redirects (prevents open-redirect abuse). */
export function safeRedirect(value) {
  if (!value || typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  return value;
}

export default function AuthShell({ title, subtitle, children, wide = false }) {
  return (
    <div className="relative overflow-hidden py-10 sm:py-16">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(165,42,58,0.10),transparent_60%)]" />
      <div className={`container-page ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-6 text-center">
          <LogoMark className="mx-auto h-12 w-12" />
          <h1 className="mt-4 text-2xl sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
