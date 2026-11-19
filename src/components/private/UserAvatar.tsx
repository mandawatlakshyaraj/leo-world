interface UserAvatarProps {
  name: string;
  avatarDataUrl?: string;
  isOnline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const SIZE_CLASSES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-20 w-20 text-2xl',
};

export function UserAvatar({
  name,
  avatarDataUrl,
  isOnline = false,
  size = 'md',
  onClick,
}: UserAvatarProps) {
  const initial = (name || '?').slice(0, 1).toUpperCase();
  const baseClass = `relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-[#2a6278] bg-gradient-to-br from-[#133249] to-[#081523] font-semibold text-[#9ff4ff] ${SIZE_CLASSES[size]}`;

  const content = (
    <>
      {avatarDataUrl ? (
        <img src={avatarDataUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
      {isOnline && (
        <span
          aria-label="Online"
          title="Online"
          className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-[#071522] bg-emerald-400"
        />
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`View profile for ${name}`}
        className={`${baseClass} cursor-pointer transition hover:border-[#42e8f5]`}
      >
        {content}
      </button>
    );
  }

  return <span className={baseClass}>{content}</span>;
}
