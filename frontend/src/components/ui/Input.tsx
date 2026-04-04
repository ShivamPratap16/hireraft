import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, icon, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={`w-full bg-[var(--surface-2)] border text-sm text-[var(--text-primary)] rounded-xl px-3.5 py-2.5
            placeholder:text-[var(--text-muted)] transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50
            ${icon ? 'pl-10' : ''}
            ${error ? 'border-red-500/40 focus:ring-red-500/30' : 'border-[var(--border)] hover:border-[var(--border-hover)]'}
            ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {helper && !error && <p className="text-xs text-[var(--text-muted)]">{helper}</p>}
    </div>
  )
);

Input.displayName = 'Input';
export default Input;
