export default function Board({ tiles = [], guessed = {}, role }) {
  const showWords = role === "cluegiver" || role === "reveal";

  return (
    <div style={{ marginBottom: 12 }}>
      <h4 style={{ margin: "8px 0" }}>Board</h4>

      {tiles.length === 0 ? (
        <div style={{ opacity: 0.7 }}>
          Board hidden for guessers (as designed).
        </div>
      ) : (
        <div style={grid}>
          {tiles.map((t) => {
            const isGuessed = !!guessed?.[t.id];

            return (
              <div
                key={t.id}
                style={{
                  ...tileBase,
                  ...(isGuessed ? tileGuessed : null),
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
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                    {guessed[t.id]?.team?.toUpperCase?.() || "TEAM"}:{" "}
                    {guessed[t.id]?.by || "someone"}
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
  border: "1px solid #ccc",
  padding: 10,
  borderRadius: 10,
  minHeight: 58,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const tileGuessed = {
  border: "1px solid #ddd",
  background: "#fafafa",
};