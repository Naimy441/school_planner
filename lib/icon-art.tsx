/** Shared artwork for generated PNG icons (rendered by next/og). */
export function IconArt({ size, padded = false }: { size: number; padded?: boolean }) {
  const s = size;
  const inset = padded ? s * 0.12 : 0;
  const inner = s - inset * 2;
  const u = inner / 64;
  return (
    <div style={{ width: s, height: s, display: "flex", background: "#191919", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: inner,
          height: inner,
          display: "flex",
          position: "relative",
          background: "linear-gradient(145deg, #2c2c2c, #191919)",
          borderRadius: padded ? inner * 0.22 : 0,
        }}
      >
        {[
          [17, 36],
          [29.5, 26],
          [42, 16],
        ].map(([y, w]) => (
          <div
            key={y}
            style={{
              position: "absolute",
              left: 14 * u,
              top: y * u,
              width: w * u,
              height: 5 * u,
              borderRadius: 2.5 * u,
              background: "rgba(255,255,255,0.3)",
            }}
          />
        ))}
        <svg width={inner} height={inner} viewBox="0 0 64 64" style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M35 44.5l5 5 10-12" stroke="#4fae7e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
    </div>
  );
}
