export default function ReconnectingOverlay({ show }) {
  if (!show) return null;

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={spinner} />
        <div style={title}>Reconnecting...</div>
        <div style={subtitle}>Please wait while we restore your connection</div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
  backdropFilter: "blur(4px)",
};

const card = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 16,
  padding: 32,
  textAlign: "center",
  maxWidth: "min(400px, calc(100vw - 40px))",
  margin: "0 20px",
};

const spinner = {
  width: 48,
  height: 48,
  margin: "0 auto 16px",
  border: "4px solid #333",
  borderTop: "4px solid #fff",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const title = {
  fontSize: 20,
  fontWeight: 700,
  color: "#fff",
  marginBottom: 8,
};

const subtitle = {
  fontSize: 14,
  color: "#aaa",
  opacity: 0.8,
};
