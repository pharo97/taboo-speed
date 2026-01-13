export default function HostControls({ onStartRound, disabled }) {
  return (
    <div style={{ border: "1px solid #ddd", padding: 12, marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>Host Controls</h3>
      <button disabled={disabled} onClick={onStartRound}>
        Start Round
      </button>
    </div>
  );
}
