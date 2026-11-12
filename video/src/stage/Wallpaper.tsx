export function Wallpaper() {
  return (
    <svg className="wallpaper" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7f9fc9" />
          <stop offset="0.42" stopColor="#c3cfe0" />
          <stop offset="0.6" stopColor="#f3d9c4" />
          <stop offset="0.66" stopColor="#f7e6d6" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9d3d0" />
          <stop offset="0.25" stopColor="#8fa9c0" />
          <stop offset="1" stopColor="#2f4a6b" />
        </linearGradient>
        <radialGradient id="sun" cx="0.62" cy="0.63" r="0.42">
          <stop offset="0" stopColor="#fff6e6" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#ffe2c2" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffe2c2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.55" />
        </linearGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="1.2" /></filter>
      </defs>
      <rect width="1280" height="470" fill="url(#sky)" />
      <rect width="1280" height="720" fill="url(#sun)" />
      <rect y="462" width="1280" height="258" fill="url(#sea)" />
      <g filter="url(#soft)">
        <path d="M0 462 L0 430 C60 418 110 404 170 410 C230 372 290 392 340 420 C380 436 430 448 470 462 Z" fill="#9db0c9" opacity="0.75" />
        <path d="M820 462 C860 440 900 398 960 388 C1010 352 1060 372 1100 398 C1150 392 1200 420 1280 436 L1280 462 Z" fill="#8ea4c2" opacity="0.8" />
        <path d="M0 462 L0 448 C80 440 140 446 220 462 Z" fill="#6d86a8" />
        <path d="M940 462 C980 452 1010 430 1050 426 C1090 410 1130 428 1160 446 C1200 450 1240 456 1280 462 Z" fill="#627c9f" />
      </g>
      <rect y="380" width="1280" height="90" fill="url(#mist)" />
      <g opacity="0.5">
        <rect x="700" y="486" width="190" height="2" rx="1" fill="#fff3df" />
        <rect x="660" y="512" width="270" height="2.5" rx="1.25" fill="#fff3df" opacity="0.7" />
        <rect x="610" y="548" width="370" height="3" rx="1.5" fill="#fff3df" opacity="0.45" />
        <rect x="560" y="596" width="470" height="4" rx="2" fill="#fff3df" opacity="0.25" />
      </g>
      <g>
        <path d="M250 520 C300 486 340 470 392 476 C430 446 492 452 520 486 C560 492 590 508 610 520 Z" fill="#22344f" />
        <path d="M250 520 C330 512 520 512 610 520 C520 532 330 532 250 520 Z" fill="#1a2940" opacity="0.6" />
        <path d="M392 476 C400 462 408 452 418 450 C426 458 430 468 432 478 Z" fill="#2c4263" />
      </g>
    </svg>
  );
}
