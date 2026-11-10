import type { ReactNode } from "react";
import "./CircleExpandButton.css";

type Props = {
  href: string;
  children: ReactNode;
  /** solid = deep teal pill; outline = glass pill with a coral dot */
  tone?: "solid" | "outline";
  /** small icon shown before the label (e.g. the GitHub mark) */
  icon?: ReactNode;
  className?: string;
};

/** A real link styled as the "circle expand" pill — keeps native link semantics. */
export function CircleExpandButton({ href, children, tone = "solid", icon, className = "" }: Props) {
  return (
    <a href={href} className={`ceb ceb--${tone}${className ? ` ${className}` : ""}`}>
      <span className="ceb__label">
        {icon}
        {children}
      </span>
      <span className="ceb__dot" aria-hidden="true">
        <svg className="ceb__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="12" x2="20" y2="12" />
          <polyline points="13,5 20,12 13,19" />
        </svg>
      </span>
      <span className="ceb__fill" aria-hidden="true" />
    </a>
  );
}
