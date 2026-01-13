export default function TeamPicker({ myTeam, onPick, disabled }) {
  return (
    <div style={{ border: "1px solid #ddd", padding: 12, marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>Team</h3>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button disabled={disabled} onClick={() => onPick("blue")}>
          Join Blue
        </button>
        <button disabled={disabled} onClick={() => onPick("red")}>
          Join Red
        </button>
        <div style={{ marginLeft: 8, opacity: 0.8 }}>
          Current: {myTeam || "-"}
        </div>
      </div>
    </div>
  );
}
