interface AvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

export default function Avatar({ name = '', size = 'md', className = '' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-semibold
        bg-gradient-to-br from-brand-500 to-brand-700 text-white shrink-0
        ${sizes[size]} ${className}`}
    >
      {initials}
    </div>
  );
}
