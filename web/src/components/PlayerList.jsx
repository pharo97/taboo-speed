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
    <div style={container}>
      <h4 style={title}>Players</h4>
      {players.length === 0 && <div style={{ color: "#aaa" }}>No players</div>}

      <div style={{ display: "grid", gap: 8 }}>
        {players.map((p, idx) => {
          // Defensive: handle either token or playerToken.
          const token = p.token ?? p.playerToken ?? null;
          const isMe = token === myToken;

          // Stable key: prefer token; otherwise fall back to a deterministic string.
          const key = token || `${p.name || "player"}-${idx}`;

          return (
            <div key={key} style={{ ...row, ...(p.connected ? {} : rowDisconnected) }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: p.connected ? "#fff" : "#666" }}>
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75, color: "#aaa" }}>
          You're host. Try not to abuse power immediately.
        </div>
      ) : null}
    </div>
  );
}

const container = {
  marginBottom: 12,
  color: "#fff",
};

const title = {
  marginBottom: 8,
  marginTop: 0,
  color: "#fff",
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 10,
  border: "1px solid #333",
  borderRadius: 10,
  background: "#1a1a1a",
};

const rowDisconnected = {
  opacity: 0.5,
  border: "1px solid #555",
  background: "#111",
};

const badgeBase = {
  fontSize: 11,
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid #555",
  opacity: 0.9,
  color: "#fff",
};

const badgeHost = {
  ...badgeBase,
  border: "1px solid #fff",
  fontWeight: 700,
  background: "rgba(255, 255, 255, 0.1)",
};

const badgeOn = {
  ...badgeBase,
  background: "rgba(74, 222, 128, 0.1)",
  border: "1px solid #4ade80",
  color: "#4ade80",
};

const badgeOff = {
  ...badgeBase,
  opacity: 0.5,
};

const badgeTeam = (team) => ({
  ...badgeBase,
  background:
    team === "blue"
      ? "rgba(59, 130, 246, 0.1)"
      : team === "red"
      ? "rgba(239, 68, 68, 0.1)"
      : "rgba(100, 100, 100, 0.1)",
  border:
    team === "blue"
      ? "1px solid #3b82f6"
      : team === "red"
      ? "1px solid #ef4444"
      : "1px solid #666",
  color:
    team === "blue"
      ? "#3b82f6"
      : team === "red"
      ? "#ef4444"
      : "#aaa",
});

const tokenPill = {
  fontSize: 11,
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px dashed #555",
  opacity: 0.7,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  color: "#aaa",
};

const btn = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #555",
  background: "#2a2a2a",
  color: "#fff",
  cursor: "pointer",
  transition: "all 0.2s",
  fontSize: 13,
  minHeight: 40,
};

const btnDanger = {
  ...btn,
  border: "1px solid #ef4444",
  background: "rgba(239, 68, 68, 0.1)",
  color: "#ef4444",
  fontWeight: 600,
};
