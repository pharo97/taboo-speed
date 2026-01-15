import { useState, useEffect } from "react";

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
    <div style={{ marginBottom: 12 }}>
      <h4 style={{ margin: "8px 0", color: "#fff" }}>Board</h4>

      {tiles.length === 0 ? (
        <div style={{ opacity: 0.7, color: "#aaa" }}>
          Board hidden for guessers (as designed).
        </div>
      ) : (
        <div style={{ ...grid, gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)" }}>
          {tiles.map((t) => {
            const isGuessed = !!guessed?.[t.id];
            const isMissed = role === "reveal" && !isGuessed;

            return (
              <div
                key={t.id}
                style={{
                  ...tileBase,
                  ...(isGuessed ? tileGuessed : null),
                  ...(isMissed ? tileMissed : null),
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    textDecoration: isGuessed ? "line-through" : "none",
                    opacity: isGuessed ? 0.55 : 1,
                  }}
                >
                  {showWords ? t.word : isGuessed ? "✓" : "?"}
                </div>

                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  {showWords ? `${t.points} pts` : isGuessed ? "guessed" : ""}
                </div>

                {/* Reveal who guessed it (only on reveal screen) */}
                {role === "reveal" && isGuessed ? (
                  <div style={{ marginTop: 6, fontSize: 11, opacity: 0.9, color: "#4ade80" }}>
                    {guessed[t.id]?.team?.toUpperCase?.() || "TEAM"}:{" "}
                    {guessed[t.id]?.by || "someone"}
                  </div>
                ) : null}

                {/* Show MISSED label for unguessed words in reveal */}
                {role === "reveal" && isMissed ? (
                  <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: "#ef4444" }}>
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

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
};

const tileBase = {
  border: "1px solid #444",
  padding: 10,
  borderRadius: 10,
  minHeight: 58,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  background: "#2a2a2a",
  color: "#fff",
};

const tileGuessed = {
  border: "1px solid #333",
  background: "#1a1a1a",
  opacity: 0.6,
};

const tileMissed = {
  border: "1px solid #ef4444",
  background: "#2a1a1a",
};