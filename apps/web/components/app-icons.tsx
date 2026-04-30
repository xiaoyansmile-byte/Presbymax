import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" {...props}>
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
      <path d="M10 20v-5h4v5" />
    </IconBase>
  );
}

export function PlanIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6h6v6H4z" />
      <path d="M14 6h6v6h-6z" />
      <path d="M4 16h6v2H4z" />
      <path d="M14 16h6v2h-6z" />
    </IconBase>
  );
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 19V5" />
      <path d="M5 19h14" />
      <path d="M9 15V11" />
      <path d="M13 15V8" />
      <path d="M17 15V12" />
    </IconBase>
  );
}

export function ReportIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </IconBase>
  );
}

export function AccountIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8.5" r="3.2" />
      <path d="M5 20c1.6-3.5 4.2-5.2 7-5.2s5.4 1.7 7 5.2" />
    </IconBase>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="8" r="2.5" />
      <path d="M4.5 19c.9-2.6 2.8-4 4.5-4s3.6 1.4 4.5 4" />
      <circle cx="16.5" cy="9" r="2" />
      <path d="M13.5 19c.5-1.8 1.6-2.8 3-2.8s2.5 1 3 2.8" />
    </IconBase>
  );
}

export function TemplateIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.6" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" />
    </IconBase>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.1-1.4-2.4-2.2.7a7 7 0 0 0-1.7-1l-.3-2.3H11l-.3 2.3a7 7 0 0 0-1.7 1l-2.2-.7-1.4 2.4 2 1.1a7 7 0 0 0 0 2l-2 1.1 1.4 2.4 2.2-.7c.5.4 1.1.8 1.7 1l.3 2.3h4l.3-2.3c.6-.2 1.2-.6 1.7-1l2.2.7 1.4-2.4-2-1.1c.1-.3.1-.6.1-1Z" />
    </IconBase>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3.2" />
    </IconBase>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8.5V12l2.5 1.5" />
    </IconBase>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.75" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function SolidPauseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="6.25" y="5.5" width="4.6" height="13" rx="1.2" fill="currentColor" />
      <rect x="13.15" y="5.5" width="4.6" height="13" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export function SolidPlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M8.25 6.9 17.5 12l-9.25 5.1Z" fill="currentColor" />
    </svg>
  );
}

export function TrendUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 16.5 9 11.5l3 3 6-6" />
      <path d="M14 8.5h4v4" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5.5 12 4 4 9-9" />
    </IconBase>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="6" y="10.5" width="12" height="8.5" rx="2" />
      <path d="M8.5 10.5V8.2A3.5 3.5 0 0 1 12 4.7h0A3.5 3.5 0 0 1 15.5 8.2v2.3" />
    </IconBase>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 7.5 17 12l-8 4.5z" />
    </IconBase>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h12" />
      <path d="m13 6 6 6-6 6" />
    </IconBase>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9 6 6 6-6 6" />
    </IconBase>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </IconBase>
  );
}
