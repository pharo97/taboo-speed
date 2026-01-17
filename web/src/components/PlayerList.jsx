// web/src/components/PlayerList.jsx
import { UserIcon, CrownIcon, ShieldIcon } from "./Icons";
import Button from "./Button";

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
      <div style={header}>
        <UserIcon size={18} color="var(--text-primary)" />
        <h4 style={title}>Players ({players.length})</h4>
      </div>

      {players.length === 0 && <div style={emptyState}>No players yet</div>}

      <div style={playerGrid}>
        {players
          .filter(p => p.connected) // Only show connected players
          .map((p, idx) => {
          // Defensive: handle either token or playerToken.
          const token = p.token ?? p.playerToken ?? null;
          const isMe = token === myToken;

          // Stable key: prefer token; otherwise fall back to a deterministic string.
          const key = token || `${p.name || "player"}-${idx}`;

          return (
            <div key={key} style={{ ...row, ...(p.connected ? {} : rowDisconnected) }}>
              <div style={playerInfo}>
                <div style={playerMain}>
                  <span style={playerName(p.connected)}>
                    {p.name || "Player"}
                    {isMe ? <span style={youTag}> (you)</span> : null}
                  </span>

                  <div style={badgeContainer}>
                    {p.isHost && (
                      <span style={badgeHost}>
                        <CrownIcon size={10} color="#fff" />
                        HOST
                      </span>
                    )}

                    <span style={badgeTeam(p.team)}>
                      <ShieldIcon size={10} color={getTeamColor(p.team)} />
                      {p.team ? p.team.toUpperCase() : "NO TEAM"}
                    </span>
                  </div>
                </div>

                {/* Host actions */}
                {isHost && !p.isHost && (
                  <div style={actionButtons}>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => token && onKick?.(token)}
                      disabled={!token}
                    >
                      Kick
                    </Button>

                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => token && onMakeHost?.(token)}
                      disabled={!token}
                    >
                      Make Host
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTeamColor(team) {
  if (team === "blue") return "var(--blue-base)";
  if (team === "red") return "var(--red-base)";
  return "var(--text-tertiary)";
}

const container = {
  marginBottom: "var(--space-md)",
};

const header = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-sm)",
  marginBottom: "var(--space-md)",
};

const title = {
  margin: 0,
  fontSize: "var(--text-lg)",
  color: "var(--text-primary)",
  fontWeight: 600,
};

const emptyState = {
  color: "var(--text-tertiary)",
  fontSize: "var(--text-sm)",
  textAlign: "center",
  padding: "var(--space-lg)",
  opacity: 0.7,
};

const playerGrid = {
  display: "grid",
  gap: "var(--space-sm)",
};

const row = {
  padding: "var(--space-md)",
  border: "1px solid var(--border-primary)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-card)",
  transition: "all 0.2s ease",
};

const rowDisconnected = {
  opacity: 0.5,
  border: "1px solid var(--border-tertiary)",
  background: "var(--bg-secondary)",
};

const playerInfo = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-sm)",
};

const playerMain = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-xs)",
};

const playerName = (connected) => ({
  fontSize: "var(--text-base)",
  fontWeight: 600,
  color: connected ? "var(--text-primary)" : "var(--text-tertiary)",
});

const youTag = {
  opacity: 0.6,
  fontWeight: 400,
  fontSize: "var(--text-sm)",
};

const badgeContainer = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-xs)",
  alignItems: "center",
};

const badgeBase = {
  fontSize: "var(--text-xs)",
  padding: "3px 8px",
  borderRadius: "var(--radius-full)",
  border: "1px solid var(--border-tertiary)",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontWeight: 600,
  letterSpacing: "0.02em",
};

const badgeHost = {
  ...badgeBase,
  border: "1px solid var(--text-primary)",
  background: "rgba(255, 255, 255, 0.1)",
  color: "var(--text-primary)",
};

const badgeOn = {
  ...badgeBase,
  background: "var(--success-bg)",
  border: "1px solid var(--success)",
  color: "var(--success)",
};

const badgeOff = {
  ...badgeBase,
  opacity: 0.5,
  color: "var(--text-tertiary)",
};

const badgeTeam = (team) => ({
  ...badgeBase,
  background: team === "blue" ? "var(--blue-bg)" : team === "red" ? "var(--red-bg)" : "rgba(100, 100, 100, 0.1)",
  border: team === "blue" ? "1px solid var(--blue-base)" : team === "red" ? "1px solid var(--red-base)" : "1px solid var(--border-tertiary)",
  color: team === "blue" ? "var(--blue-base)" : team === "red" ? "var(--red-base)" : "var(--text-tertiary)",
});

const actionButtons = {
  display: "flex",
  gap: "var(--space-sm)",
  marginTop: "var(--space-xs)",
  flexWrap: "wrap",
};
