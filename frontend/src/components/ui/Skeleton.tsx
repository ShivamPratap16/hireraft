interface SkeletonProps {
  className?: string;
  variant?: 'line' | 'card' | 'circle';
}

export default function Skeleton({ className = '', variant = 'line' }: SkeletonProps) {
  const base = 'bg-[var(--surface-3)] rounded-lg animate-shimmer';
  const variants = {
    line: `${base} h-4 w-full`,
    card: `${base} h-28 w-full rounded-2xl`,
    circle: `${base} w-10 h-10 rounded-full`,
  };
  return <div className={`${variants[variant]} ${className}`} />;
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface-2)]/50">
          <Skeleton variant="circle" className="shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}
