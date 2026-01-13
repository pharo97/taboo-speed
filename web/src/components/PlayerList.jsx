// src/components/PlayerList.jsx
export default function PlayerList({ players, myToken }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h4>Players</h4>
      {players.length === 0 && <div>No players</div>}

      {players.map((p) => (
        <div key={p.token}>
          {p.name} ({p.team || "no-team"}
          {p.isHost ? ", host" : ""}
          {p.token === myToken ? ", you" : ""})
        </div>
      ))}
    </div>
  );
}
