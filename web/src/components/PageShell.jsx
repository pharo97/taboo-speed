// PageShell - Main layout wrapper with theming support
export default function PageShell({ children, theme = "neutral", centered = false }) {
  return (
    <div data-theme={theme} style={wrapper}>
      {/* Team-colored background effect */}
      <div style={getBackgroundStyle(theme)} />

      <div style={centered ? centeredContainer : container}>
        {children}
      </div>
    </div>
  );
}

function getBackgroundStyle(theme) {
  const baseStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: -1,
    overflow: "hidden",
    pointerEvents: "none",
  };

  if (theme === "red") {
    return {
      ...baseStyle,
      background: `
        radial-gradient(circle at 20% 50%, rgba(239, 68, 68, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 50%, rgba(239, 68, 68, 0.08) 0%, transparent 50%),
        #0a0a0a
      `,
    };
  }

  if (theme === "blue") {
    return {
      ...baseStyle,
      background: `
        radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
        #0a0a0a
      `,
    };
  }

  // Neutral theme
  return {
    ...baseStyle,
    background: `
      radial-gradient(circle at 20% 50%, rgba(239, 68, 68, 0.05) 0%, transparent 50%),
      radial-gradient(circle at 80% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
      #0a0a0a
    `,
  };
}

const wrapper = {
  minHeight: "100vh",
  background: "var(--bg-primary)",
  position: "relative",
  transition: "background 0.5s ease",
};

const container = {
  maxWidth: "1400px",
  margin: "0 auto",
  padding: "var(--space-lg)",
  position: "relative",
  zIndex: 1,
};

const centeredContainer = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "var(--space-lg)",
  position: "relative",
  zIndex: 1,
};
