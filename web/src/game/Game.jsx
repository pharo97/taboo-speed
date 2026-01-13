import Board from "./Board";
import ClueInput from "./ClueInput";
import GuessInput from "./GuessInput";

export default function Game({
  room,
  round,
  role,
  remainingMs,
  endedInfo,
  onSetClue,
  onGuess,
}) {
  const playing = room?.status === "playing" && round;

  return (
    <div style={{ border: "1px solid #ddd", padding: 12, marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>Game</h3>

      {playing ? (
        <>
          <div style={{ marginBottom: 10 }}>
            Round #{round.number} | Active team: <b>{round.activeTeam}</b> |
            Role: <b>{role}</b>
            <div style={{ opacity: 0.8 }}>
              Time left:{" "}
              {remainingMs == null ? "-" : Math.ceil(remainingMs / 1000)}s
            </div>
          </div>

          <Board tiles={round.board || []} role={role} />

          {role === "cluegiver" ? (
            <ClueInput onSubmit={onSetClue} />
          ) : (
            <GuessInput onSubmit={onGuess} />
          )}
        </>
      ) : (
        <>
          <div style={{ opacity: 0.8 }}>Not currently in a round.</div>

          {endedInfo?.payload?.fullBoard?.length ? (
            <div style={{ marginTop: 12 }}>
              <h4 style={{ marginBottom: 8 }}>Last board reveal</h4>
              <Board tiles={endedInfo.payload.fullBoard} role={"reveal"} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
