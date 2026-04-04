interface SectionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function SectionCard({
  title,
  description,
  icon,
  action,
  children,
  className = '',
}: SectionCardProps) {
  return (
    <div className={`glass rounded-2xl overflow-hidden animate-slide-up ${className}`}>
      <div className="flex items-start justify-between px-6 pt-5 pb-0">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 rounded-xl bg-[var(--accent-glow)] text-brand-400">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
            {description && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}
