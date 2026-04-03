const GridBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Base grid pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(59, 130, 246, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(59, 130, 246, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Secondary finer grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(99, 102, 241, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(99, 102, 241, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '10px 10px'
        }}
      />

      {/* Major grid lines - every 5th line */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(37, 99, 235, 0.25) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(37, 99, 235, 0.25) 1px, transparent 1px)
          `,
          backgroundSize: '200px 200px'
        }}
      />

      {/* Fade gradient overlay - creates the blur effect from top to bottom */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0) 0%,
              rgba(255, 255, 255, 0.1) 30%,
              rgba(255, 255, 255, 0.4) 60%,
              rgba(255, 255, 255, 0.8) 85%,
              rgba(255, 255, 255, 1) 100%
            )
          `
        }}
      />
    </div>
  )
}

export default GridBackground
