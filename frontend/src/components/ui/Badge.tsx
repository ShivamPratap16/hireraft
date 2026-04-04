type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted'
  | 'naukri'
  | 'linkedin'
  | 'indeed'
  | 'internshala';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

const styles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  muted: 'bg-[var(--surface-3)] text-[var(--text-muted)] border-[var(--border)]',
  naukri: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  linkedin: 'bg-blue-500/8 text-blue-300 border-blue-500/20',
  indeed: 'bg-rose-500/8 text-rose-300 border-rose-500/20',
  internshala: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-red-400',
  info: 'bg-blue-400',
  muted: 'bg-gray-400',
  naukri: 'bg-blue-400',
  linkedin: 'bg-blue-400',
  indeed: 'bg-rose-400',
  internshala: 'bg-emerald-400',
};

export default function Badge({ variant = 'muted', children, dot = false, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border
        ${styles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}

export function statusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    applied: 'info',
    viewed: 'warning',
    interview: 'success',
    rejected: 'danger',
    manual_apply_needed: 'warning',
    offered: 'success',
  };
  return map[status] || 'muted';
}

export function platformVariant(platform: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    naukri: 'naukri',
    linkedin: 'linkedin',
    indeed: 'indeed',
    internshala: 'internshala',
  };
  return map[platform?.toLowerCase()] || 'muted';
}
