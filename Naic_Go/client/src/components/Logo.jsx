import { Link } from 'react-router-dom';

export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path fill="#641C2B" d="M32 2C19.3 2 9 12.3 9 25c0 17.2 23 37 23 37s23-19.8 23-37C55 12.3 44.7 2 32 2z" />
      <rect x="19" y="15" width="26" height="19" rx="4.5" fill="#fff" />
      <rect x="22.5" y="18.5" width="19" height="7.5" rx="1.8" fill="#D94747" />
      <circle cx="25.5" cy="30" r="2" fill="#641C2B" />
      <circle cx="38.5" cy="30" r="2" fill="#641C2B" />
      <rect x="29" y="11" width="6" height="4" rx="1" fill="#A52A3A" />
    </svg>
  );
}

export default function Logo({ light = false, to = '/' }) {
  return (
    <Link to={to} className="flex items-center gap-2" aria-label="NaicGo home">
      <LogoMark />
      <span className={`text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-maroon'}`}>
        Naic<span className={light ? 'text-accent-50' : 'text-accent'}>Go</span>
      </span>
    </Link>
  );
}
