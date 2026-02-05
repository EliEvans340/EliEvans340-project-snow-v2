"use client";

export default function SnowAnimation() {
  const snowflakes = Array.from({ length: 50 }, (_, i) => {
    const x = (i * 37 + 13) % 100;
    const size = 3 + (i % 5) * 2;                // 3-11px
    const blur = 1 + (i % 3) * 1.5;              // 1-4px blur for dither
    const duration = 10 + (i % 8) * 1.5;         // 10-20.5s
    const delay = -((i * 3) % 20);               // stagger
    const sway = 4 + (i % 4);                    // keyframe variant (0-3 for drift)
    const opacity = 0.12 + (i % 6) * 0.06;       // 0.12-0.42

    return { id: i, x, size, blur, duration, delay, sway, opacity };
  });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {snowflakes.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            width: s.size,
            height: s.size,
            filter: `blur(${s.blur}px)`,
            opacity: s.opacity,
            animation: `snowdrift-${s.sway % 4} ${s.duration}s linear ${s.delay}s infinite`,
          }}
        />
      ))}

      <style>{`
        @keyframes snowdrift-0 {
          0%   { top: -3%; transform: translateX(0); }
          100% { top: 103%; transform: translateX(20px); }
        }
        @keyframes snowdrift-1 {
          0%   { top: -3%; transform: translateX(0); }
          100% { top: 103%; transform: translateX(-18px); }
        }
        @keyframes snowdrift-2 {
          0%   { top: -3%; transform: translateX(0); }
          50%  { transform: translateX(15px); }
          100% { top: 103%; transform: translateX(-8px); }
        }
        @keyframes snowdrift-3 {
          0%   { top: -3%; transform: translateX(0); }
          33%  { transform: translateX(-10px); }
          66%  { transform: translateX(10px); }
          100% { top: 103%; transform: translateX(-3px); }
        }
      `}</style>
    </div>
  );
}
