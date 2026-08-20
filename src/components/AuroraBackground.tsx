export function AuroraBackground() {
  return (
    <div className="aurora-bg">
      <div
        className="aurora-blob"
        style={{
          width: 560,
          height: 560,
          left: "-10%",
          top: "-15%",
          background: "linear-gradient(135deg, var(--aurora-1a), var(--aurora-1b))",
          animation: "drift-a 22s ease-in-out infinite",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          width: 480,
          height: 480,
          right: "-8%",
          top: "10%",
          background: "linear-gradient(135deg, var(--aurora-2a), var(--aurora-2b))",
          animation: "drift-b 26s ease-in-out infinite",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          width: 420,
          height: 420,
          left: "20%",
          bottom: "-20%",
          background: "linear-gradient(135deg, var(--aurora-3a), var(--aurora-3b))",
          animation: "drift-a 30s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}
