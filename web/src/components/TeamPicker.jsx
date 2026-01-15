export default function TeamPicker({ myTeam, onPick, disabled }) {
  return (
    <div style={container}>
      <h3 style={{ marginTop: 0, color: "#fff" }}>Team</h3>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          disabled={disabled}
          onClick={() => onPick("blue")}
          style={{
            ...btn,
            background: myTeam === "blue" ? "#3b82f6" : "#2a2a2a",
            border: myTeam === "blue" ? "2px solid #3b82f6" : "1px solid #555",
            color: "#fff",
          }}
        >
          Join Blue
        </button>
        <button
          disabled={disabled}
          onClick={() => onPick("red")}
          style={{
            ...btn,
            background: myTeam === "red" ? "#ef4444" : "#2a2a2a",
            border: myTeam === "red" ? "2px solid #ef4444" : "1px solid #555",
            color: "#fff",
          }}
        >
          Join Red
        </button>
        <div style={{ marginLeft: 8, opacity: 0.6, color: "#aaa", fontSize: 13 }}>
          Current: <b style={{ color: "#fff" }}>{myTeam || "-"}</b>
        </div>
      </div>
    </div>
  );
}

const container = {
  border: "1px solid #333",
  padding: 12,
  marginBottom: 12,
  borderRadius: 10,
  background: "#1a1a1a",
};

const btn = {
  padding: "12px 18px",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s",
  fontSize: 14,
  minHeight: 44,
};
