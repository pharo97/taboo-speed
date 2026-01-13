export default function Board({ tiles = [], role }) {
  const showWords = role === "cluegiver" || role === "reveal";

  return (
    <div style={{ marginBottom: 12 }}>
      <h4 style={{ margin: "8px 0" }}>Board</h4>

      {tiles.length === 0 ? (
        <div style={{ opacity: 0.7 }}>
          Board hidden for guessers (as designed).
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
          }}
        >
          {tiles.map((t) => (
            <div
              key={t.id}
              style={{ border: "1px solid #ccc", padding: 8, borderRadius: 6 }}
            >
              <div style={{ fontWeight: 600 }}>{showWords ? t.word : "?"}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {showWords ? `${t.points} pts` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
