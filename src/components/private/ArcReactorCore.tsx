interface ArcReactorCoreProps {
  userId: string;
  friendsCount: number;
  storiesCount: number;
  vaultItemCount: number;
}

export function ArcReactorCore({
  userId,
  friendsCount,
  storiesCount,
  vaultItemCount,
}: ArcReactorCoreProps) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex flex-col items-center justify-center py-2">
        <svg
          className="w-60 max-w-full drop-shadow-[0_0_18px_rgba(25,234,255,0.42)] sm:w-72"
          viewBox="0 0 400 400"
          role="img"
          aria-label="Animated Leo AI Arc Reactor core"
        >
          <defs>
            <radialGradient id="reactorGlow">
              <stop offset="0" stopColor="#eaffff" />
              <stop offset=".12" stopColor="#8fffff" />
              <stop offset=".34" stopColor="#14dfff" />
              <stop offset=".58" stopColor="#075b83" />
              <stop offset=".78" stopColor="#031927" />
              <stop offset="1" stopColor="#01070e" />
            </radialGradient>
            <linearGradient id="reactorMetal" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#d9ffff" />
              <stop offset=".35" stopColor="#2cecff" />
              <stop offset=".7" stopColor="#17658d" />
              <stop offset="1" stopColor="#a8ffff" />
            </linearGradient>
            <filter id="reactorBloom">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx="200"
            cy="200"
            r="180"
            fill="#03111e"
            stroke="#3befff"
            strokeWidth="2"
            opacity=".8"
          />
          <circle
            className="reactor-spin"
            cx="200"
            cy="200"
            r="165"
            fill="none"
            stroke="url(#reactorMetal)"
            strokeWidth="8"
            strokeDasharray="3 9 42 7 3 12"
          />
          <circle
            cx="200"
            cy="200"
            r="145"
            fill="none"
            stroke="#1bdff8"
            strokeWidth="2"
            strokeDasharray="70 8 12 8"
            opacity=".8"
          />
          <circle
            className="reactor-reverse"
            cx="200"
            cy="200"
            r="126"
            fill="none"
            stroke="#a4ffff"
            strokeWidth="5"
            strokeDasharray="2 5 24 5"
            filter="url(#reactorBloom)"
          />
          <circle
            cx="200"
            cy="200"
            r="105"
            fill="url(#reactorGlow)"
            stroke="#6df8ff"
            strokeWidth="3"
          />
          <g className="reactor-spin" stroke="#c5ffff" strokeWidth="3" fill="#0b7899">
            <path d="M200 105 L225 145 L200 160 L175 145 Z" />
            <path d="M295 200 L255 225 L240 200 L255 175 Z" />
            <path d="M200 295 L175 255 L200 240 L225 255 Z" />
            <path d="M105 200 L145 175 L160 200 L145 225 Z" />
          </g>
          <circle
            cx="200"
            cy="200"
            r="63"
            fill="#061a2a"
            stroke="#55f4ff"
            strokeWidth="5"
            filter="url(#reactorBloom)"
          />
          <path
            d="M200 145 L244 174 L244 226 L200 255 L156 226 L156 174 Z"
            fill="none"
            stroke="#b8ffff"
            strokeWidth="3"
          />
          <circle
            className="reactor-pulse"
            cx="200"
            cy="200"
            r="37"
            fill="url(#reactorGlow)"
            stroke="#e6ffff"
            strokeWidth="3"
            filter="url(#reactorBloom)"
          />
          <path d="M200 174 L218 200 L200 226 L182 200 Z" fill="#efffff" opacity=".95" />
        </svg>
        <div className="font-tech-mono mt-2 text-xs tracking-[0.22em] uppercase text-[#76f7ff]">
          Arc Reactor · Active
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-[#1d5466] bg-[#05121d]/90 p-5">
        <div className="text-xs font-medium tracking-[0.16em] uppercase text-[#65eaff]">
          Environment Overview
        </div>
        <dl className="divide-y divide-[#143c4a] text-sm">
          <div className="flex items-center justify-between py-3">
            <dt className="text-[#8cbac7]">Identity</dt>
            <dd className="font-tech-mono font-medium text-[#72f7c8]">{userId}</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-[#8cbac7]">Circle Connections</dt>
            <dd className="font-tech-mono font-medium text-[#e4fbff]">{friendsCount} friends</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-[#8cbac7]">Active 24h Stories</dt>
            <dd className="font-tech-mono font-medium text-[#e4fbff]">{storiesCount}</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-[#8cbac7]">Eclipse Vault</dt>
            <dd className="font-tech-mono font-medium text-[#72f7c8]">
              AES-256-GCM · {vaultItemCount} stored
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
