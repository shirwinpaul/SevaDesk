// Original, simple SVG illustrations (hands, leaves, community, notebook). No stock art.

export function HandsLeafIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={className} role="img" aria-label="Two open hands holding a growing leaf">
      <circle cx="120" cy="80" r="70" fill="#d5f1ec" />
      <path d="M120 98 C120 70 120 55 120 40" stroke="#326423" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M120 62 C100 58 92 42 96 30 C110 32 122 44 120 62 Z" fill="#3f7d2c" />
      <path d="M120 54 C138 48 146 34 142 22 C128 24 118 38 120 54 Z" fill="#5a9e43" />
      <path d="M58 104 C70 96 92 96 112 106 L118 116 C100 118 80 120 64 126 C56 122 52 110 58 104 Z" fill="#e8891c" />
      <path d="M182 104 C170 96 148 96 128 106 L122 116 C140 118 160 120 176 126 C184 122 188 110 182 104 Z" fill="#f2a649" />
    </svg>
  );
}

export function CommunityIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 120" className={className} role="img" aria-label="Simple figures standing together">
      <rect x="10" y="96" width="220" height="8" rx="4" fill="#d5f1ec" />
      {[50, 95, 145, 190].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={44 + (i % 2) * 6} r="12" fill={i % 2 ? "#e8891c" : "#1f7a70"} />
          <path
            d={`M${x - 16} ${96} C${x - 16} ${70 + (i % 2) * 6} ${x + 16} ${70 + (i % 2) * 6} ${x + 16} 96 Z`}
            fill={i % 2 ? "#f2a649" : "#3f9c8f"}
          />
        </g>
      ))}
    </svg>
  );
}

export function NotebookIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="An open notebook with a leaf">
      <rect x="20" y="18" width="80" height="90" rx="8" fill="#fdeed8" stroke="#9a5408" strokeWidth="3" />
      {[40, 54, 68, 82].map((y) => (
        <line key={y} x1="32" y1={y} x2="88" y2={y} stroke="#e8891c" strokeWidth="3" strokeLinecap="round" />
      ))}
      <path d="M88 18 C104 26 108 44 98 56 C88 46 84 30 88 18 Z" fill="#3f7d2c" />
    </svg>
  );
}
