// Lightweight inline SVG icons — no external dependency.
// All icons use currentColor so they inherit text color.
type IconProps = { className?: string; "aria-hidden"?: boolean };
const defaults: IconProps = { "aria-hidden": true };

export function IconDashboard({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}

export function IconBriefcase({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="5" width="14" height="10" rx="2" />
      <path d="M5 5V3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M1 10h14" />
    </svg>
  );
}

export function IconClipboard({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-2" />
      <rect x="5" y="1" width="6" height="3" rx="1" />
      <path d="M5 7h6M5 10h4" />
    </svg>
  );
}

export function IconTrendingUp({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,11 5,7 8,10 14,4" />
      <polyline points="10,4 14,4 14,8" />
    </svg>
  );
}

export function IconChat({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 10a2 2 0 0 1-2 2H5l-3 3V3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7z" />
    </svg>
  );
}

export function IconStar({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="8,1 10,6 15,6 11,9.5 12.5,15 8,12 3.5,15 5,9.5 1,6 6,6" />
    </svg>
  );
}

export function IconDocument({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6z" />
      <polyline points="9,1 9,6 14,6" />
      <path d="M5 9h6M5 12h4" />
    </svg>
  );
}

export function IconCode({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5,4 1,8 5,12" />
      <polyline points="11,4 15,8 11,12" />
      <line x1="9" y1="2" x2="7" y2="14" />
    </svg>
  );
}

export function IconTarget({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="7" />
      <circle cx="8" cy="8" r="4" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconSliders({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="8" x2="4" y2="2" />
      <line x1="4" y1="14" x2="4" y2="11" />
      <line x1="8" y1="5" x2="8" y2="2" />
      <line x1="8" y1="14" x2="8" y2="8" />
      <line x1="12" y1="11" x2="12" y2="2" />
      <line x1="12" y1="14" x2="12" y2="14" />
      <circle cx="4" cy="9.5" r="1.5" />
      <circle cx="8" cy="6.5" r="1.5" />
      <circle cx="12" cy="12.5" r="1.5" />
    </svg>
  );
}

export function IconGear({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="4" x2="16" y2="16" />
      <line x1="16" y1="4" x2="4" y2="16" />
    </svg>
  );
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5,3 9,7 5,11" />
    </svg>
  );
}

export function IconNexus({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      {/* Bold geometric N lettermark — NEXUS brand mark */}
      <rect x="4" y="2" width="4" height="20" />
      <polygon points="8,2 12,2 20,22 16,22" />
      <rect x="16" y="2" width="4" height="20" />
    </svg>
  );
}

export function IconRefresh({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 2.5A7 7 0 1 0 14 9" />
      <polyline points="10,1 14,2.5 12.5,6.5" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2,7 5,11 12,3" />
    </svg>
  );
}

export function IconAlert({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1L15 14H1z" />
      <line x1="8" y1="6" x2="8" y2="9" />
      <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function IconExternal({ className }: IconProps) {
  return (
    <svg {...defaults} className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" />
      <polyline points="8,1 11,1 11,4" />
      <line x1="5.5" y1="6.5" x2="11" y2="1" />
    </svg>
  );
}
