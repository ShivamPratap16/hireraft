import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const padClasses = { sm: 'p-4', md: 'p-5', lg: 'p-6' };

export default function Card({
  glow = false,
  hover = true,
  padding = 'md',
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`glass rounded-2xl ${padClasses[padding]} transition-all duration-200
        ${hover ? 'hover:border-[var(--glass-border-hover)]' : ''}
        ${glow ? 'animate-pulse-glow' : ''}
        ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
