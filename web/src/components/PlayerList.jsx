// web/src/components/PlayerList.jsx
export default function PlayerList({
  players,
  myToken,
  isHost,
  onKick,
  onMakeHost,
}) {
  const me = players.find((p) => (p.token ?? p.playerToken) === myToken);

  return (
    <div style={{ marginBottom: 12 }}>
      <h4 style={{ marginBottom: 8 }}>Players</h4>
      {players.length === 0 && <div>No players</div>}

      <div style={{ display: "grid", gap: 8 }}>
        {players.map((p, idx) => {
          // Defensive: handle either token or playerToken.
          const token = p.token ?? p.playerToken ?? null;
          const isMe = token === myToken;

          // Stable key: prefer token; otherwise fall back to a deterministic string.
          const key = token || `${p.name || "player"}-${idx}`;

          return (
            <div key={key} style={row}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>
                  {p.name || "Player"}
                  {isMe ? <span style={{ opacity: 0.7 }}> (you)</span> : null}
                </span>

                {p.isHost ? <span style={badgeHost}>HOST</span> : null}

                <span style={p.connected ? badgeOn : badgeOff}>
                  {p.connected ? "ONLINE" : "OFFLINE"}
                </span>

                <span style={badgeTeam(p.team)}>
                  {p.team ? p.team.toUpperCase() : "NO TEAM"}
                </span>

                {/* Debug token (remove later) */}
                <span style={tokenPill} title="player token">
                  {token ? token.slice(0, 6) : "NO_TOKEN"}
                </span>
              </div>

              {/* Host actions */}
              {isHost && !p.isHost && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={btnDanger}
                    onClick={() => token && onKick?.(token)}
                    disabled={!token}
                    title="Remove this player from the room"
                  >
                    Kick
                  </button>

                  <button
                    style={btn}
                    onClick={() => token && onMakeHost?.(token)}
                    disabled={!token}
                    title="Transfer host powers"
                  >
                    Make Host
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {me?.isHost ? (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          You’re host. Try not to abuse power immediately.
        </div>
      ) : null}
    </div>
  );
}

const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 10,
  border: "1px solid #ddd",
  borderRadius: 10,
};

const badgeBase = {
  fontSize: 11,
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid #ccc",
  opacity: 0.9,
};

const badgeHost = {
  ...badgeBase,
  border: "1px solid #333",
  fontWeight: 700,
};

const badgeOn = {
  ...badgeBase,
};

const badgeOff = {
  ...badgeBase,
  opacity: 0.5,
};

const badgeTeam = (team) => ({
  ...badgeBase,
  border:
    team === "blue"
      ? "1px solid #1e40af"
      : team === "red"
      ? "1px solid #b91c1c"
      : "1px solid #ccc",
});

const tokenPill = {
  fontSize: 11,
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px dashed #999",
  opacity: 0.7,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const btn = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #bbb",
  background: "white",
  cursor: "pointer",
};

const btnDanger = {
  ...btn,
  border: "1px solid #a00",
  color: "#a00",
  fontWeight: 600,
};
