// src/game/GuessLog.jsx
export default function GuessLog({ guesses, maxDisplay = 5 }) {
  if (!guesses || guesses.length === 0) {
    return null;
  }

  const recent = guesses.slice(-maxDisplay).reverse();

  return (
    <div style={container}>
      <div style={header}>RECENT GUESSES</div>
      <div style={list}>
        {recent.map((g, idx) => {
          const teamColor = g.team === "blue" ? "#3b82f6" : "#ef4444";
          return (
            <div key={idx} style={item}>
              <div
                style={{
                  ...teamBadge,
                  background: teamColor,
                }}
              >
                {g.team.toUpperCase()}
              </div>
              <div style={playerName}>{g.guessedBy}</div>
              <div style={word}>{g.word}</div>
              <div style={points}>+{g.points}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const container = {
  border: "1px solid #333",
  borderRadius: 10,
  padding: 12,
  marginTop: 12,
  background: "#1a1a1a",
};

const header = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.6,
  marginBottom: 8,
  letterSpacing: "0.05em",
  color: "#fff",
};

const list = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const item = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px",
  borderRadius: 6,
  background: "#0a0a0a",
  fontSize: 13,
};

const teamBadge = {
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 700,
  color: "#fff",
  flexShrink: 0,
};

const playerName = {
  fontWeight: 600,
  color: "#fff",
  flexShrink: 0,
};

const word = {
  flex: 1,
  color: "#aaa",
  fontStyle: "italic",
};

const points = {
  fontWeight: 700,
  color: "#4ade80",
  flexShrink: 0,
};
