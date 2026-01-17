import { useState, useEffect } from "react";
import { GridIcon, CheckIcon, StarIcon } from "../components/Icons";

export default function Board({ tiles = [], guessed = {}, role }) {
  const showWords = role === "cluegiver" || role === "reveal";
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 768);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div style={container}>
      <div style={header}>
        <GridIcon size={18} color="var(--text-primary)" />
        <h4 style={title}>Game Board</h4>
        <div style={tileCount}>{tiles.length} words</div>
      </div>

      {tiles.length === 0 ? (
        <div style={emptyState}>
          Board hidden for guessers (view available only for cluegiver)
        </div>
      ) : (
        <div style={{ ...grid, gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)" }}>
          {tiles.map((t) => {
            const isGuessed = !!guessed?.[t.id];
            const isMissed = role === "reveal" && !isGuessed;
            const difficulty = t.points === 5 ? "easy" : t.points === 10 ? "medium" : "hard";

            return (
              <div
                key={t.id}
                style={{
                  ...tileBase,
                  ...(isGuessed ? tileGuessed : getTileDifficultyStyle(difficulty)),
                  ...(isMissed ? tileMissed : null),
                }}
                className="animate-fade-in"
              >
                {/* Word or status */}
                <div style={wordContainer}>
                  <div style={wordText(isGuessed)}>
                    {showWords ? t.word : isGuessed ? <CheckIcon size={20} color="var(--success)" /> : "?"}
                  </div>
                </div>

                {/* Points indicator */}
                <div style={pointsContainer}>
                  {showWords ? (
                    <div style={pointsBadge(difficulty)}>
                      <StarIcon size={10} color={getPointsColor(difficulty)} filled />
                      {t.points} pts
                    </div>
                  ) : isGuessed ? (
                    <div style={guessedLabel}>GUESSED</div>
                  ) : null}
                </div>

                {/* Reveal who guessed it (only on reveal screen) */}
                {role === "reveal" && isGuessed ? (
                  <div style={revealInfo}>
                    <CheckIcon size={10} color="var(--success)" />
                    {guessed[t.id]?.team?.toUpperCase?.() || "TEAM"}: {guessed[t.id]?.by || "someone"}
                  </div>
                ) : null}

                {/* Show MISSED label for unguessed words in reveal */}
                {role === "reveal" && isMissed ? (
                  <div style={missedLabel}>
                    MISSED
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getTileDifficultyStyle(difficulty) {
  switch (difficulty) {
    case "easy":
      return {
        background: "linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)",
        border: "1px solid var(--border-secondary)",
      };
    case "medium":
      return {
        background: "linear-gradient(135deg, #1a2a3a 0%, var(--bg-secondary) 100%)",
        border: "1px solid #2a4a5a",
      };
    case "hard":
      return {
        background: "linear-gradient(135deg, #2a1a1a 0%, var(--bg-secondary) 100%)",
        border: "1px solid #4a2a2a",
      };
    default:
      return {};
  }
}

function getPointsColor(difficulty) {
  switch (difficulty) {
    case "easy":
      return "var(--success)";
    case "medium":
      return "var(--warning)";
    case "hard":
      return "var(--danger)";
    default:
      return "var(--text-secondary)";
  }
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

const tileCount = {
  fontSize: "var(--text-xs)",
  color: "var(--text-tertiary)",
  background: "var(--bg-tertiary)",
  padding: "4px 8px",
  borderRadius: "var(--radius-full)",
  fontWeight: 600,
};

const emptyState = {
  color: "var(--text-tertiary)",
  fontSize: "var(--text-sm)",
  textAlign: "center",
  padding: "var(--space-xl)",
  background: "var(--bg-card)",
  border: "1px solid var(--border-primary)",
  borderRadius: "var(--radius-md)",
  opacity: 0.7,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "var(--space-sm)",
};

const tileBase = {
  border: "1px solid var(--border-secondary)",
  padding: "var(--space-md)",
  borderRadius: "var(--radius-md)",
  minHeight: "80px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "center",
  color: "var(--text-primary)",
  transition: "all 0.2s ease",
  position: "relative",
};

const tileGuessed = {
  border: "1px solid var(--success)",
  background: "var(--success-bg)",
  opacity: 0.6,
};

const tileMissed = {
  border: "2px solid var(--danger)",
  background: "var(--danger-bg)",
};

const wordContainer = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  width: "100%",
};

const wordText = (isGuessed) => ({
  fontWeight: 700,
  fontSize: "var(--text-base)",
  textDecoration: isGuessed ? "line-through" : "none",
  opacity: isGuessed ? 0.6 : 1,
  wordBreak: "break-word",
  lineHeight: 1.2,
});

const pointsContainer = {
  marginTop: "var(--space-xs)",
};

const pointsBadge = (difficulty) => ({
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: getPointsColor(difficulty),
  background: "rgba(0, 0, 0, 0.3)",
  padding: "3px 8px",
  borderRadius: "var(--radius-full)",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
});

const guessedLabel = {
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "var(--success)",
  opacity: 0.8,
};

const revealInfo = {
  marginTop: "var(--space-xs)",
  fontSize: "var(--text-xs)",
  opacity: 0.9,
  color: "var(--success)",
  display: "flex",
  alignItems: "center",
  gap: "4px",
  textAlign: "center",
};

const missedLabel = {
  marginTop: "var(--space-xs)",
  fontSize: "var(--text-xs)",
  fontWeight: 700,
  color: "var(--danger)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
