interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = 'w-7 h-7' }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="riva-brand-grad"
          x1="2"
          y1="2"
          x2="34"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="52%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="32" height="32" rx="10" fill="url(#riva-brand-grad)" />
      <path
        d="M12.5 24V12H18.2C20.9 12 22.6 13.4 22.6 15.8C22.6 17.7 21.4 19 19.5 19.4L23 24H19.6L16.5 19.7H15.3V24H12.5ZM15.3 17.4H18C19.2 17.4 19.9 16.8 19.9 15.9C19.9 14.9 19.2 14.3 18 14.3H15.3V17.4Z"
        fill="white"
      />
    </svg>
  );
}
