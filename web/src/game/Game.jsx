import Board from "./Board";
import ClueInput from "./ClueInput";
import GuessInput from "./GuessInput";
import GuessLog from "./GuessLog";

export default function Game({
  room,
  round,
  role,
  remainingMs,
  endedInfo,
  onSetClue,
  onGuess,
  myTeam,

  // offer support
  myToken,
  offer,
  onAcceptOffer,
  onSkipOffer,

  // accepted cluegiver starts when ready
  onStartAcceptedRound,

  // guess log
  guessLog,
}) {
  const playing = room?.status === "running" && !!round;
  const inLobby = room?.status === "lobby";
  const accepted = room?.status === "accepted";

  const scores = room?.scores || { blue: 0, red: 0 };
  const clueText = round?.clue?.text || "";

  const clueGiverToken = room?.round?.clueGiverToken || null;
  const clueGiverName =
    clueGiverToken && room?.playersByToken?.[clueGiverToken]
      ? room.playersByToken[clueGiverToken].name
      : "Unknown";

  const secondsLeft =
    remainingMs == null ? null : Math.max(0, Math.ceil(remainingMs / 1000));

  const activeTeam = round?.activeTeam || null;
  const isMyTeamsTurn = !!myTeam && !!activeTeam && myTeam === activeTeam;

  // Only guessers on active team can guess
  const canGuess = playing && role === "guesser" && isMyTeamsTurn;

  // Offer UI logic
  const pendingOffer = !!offer && offer.status === "pending";
  const acceptedOffer = !!offer && offer.status === "accepted";

  // Robust token handling
  const acceptedToken = offer?.acceptedToken || offer?.offeredToken || null;

  const isOffered = pendingOffer && myToken && offer?.offeredToken === myToken;
  const isAcceptedCluegiver =
    acceptedOffer && myToken && acceptedToken === myToken;

  const offeredName =
    offer?.offeredToken && room?.playersByToken?.[offer.offeredToken]
      ? room.playersByToken[offer.offeredToken].name
      : "Someone";

  const acceptedName =
    acceptedToken && room?.playersByToken?.[acceptedToken]
      ? room.playersByToken[acceptedToken].name
      : "Someone";

  const handleStartAccepted = () => {
    console.log("[UI] Start Round clicked", {
      inLobby,
      offer,
      myToken,
      acceptedToken,
      isAcceptedCluegiver,
      hasHandler: typeof onStartAcceptedRound === "function",
    });

    if (typeof onStartAcceptedRound !== "function") {
      console.warn(
        "[UI] onStartAcceptedRound is not a function:",
        onStartAcceptedRound
      );
      return;
    }

    try {
      onStartAcceptedRound();
    } catch (e) {
      console.error("[UI] onStartAcceptedRound threw:", e);
    }
  };

  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>Game</h3>

      <div style={scoreWrap}>
        <div style={scoreBox}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>BLUE</div>
          <div style={scoreNum}>{scores.blue}</div>
        </div>

        <div style={scoreBox}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>RED</div>
          <div style={scoreNum}>{scores.red}</div>
        </div>
      </div>

      {/* Offer panel */}
      {(pendingOffer || acceptedOffer) && (
        <div style={offerBox}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            CLUEGIVER ({String(offer?.team || "").toUpperCase()} TEAM)
          </div>

          {/* PENDING */}
          {pendingOffer ? (
            isOffered ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  You’ve been picked as cluegiver.
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={btnPrimary}
                    onClick={onAcceptOffer}
                  >
                    Accept
                  </button>
                  <button type="button" style={btn} onClick={onSkipOffer}>
                    Skip
                  </button>
                </div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
                  Accept to take the role. Skip passes it to the next player (if
                  any).
                </div>
              </>
            ) : (
              <div style={{ opacity: 0.85, fontSize: 13 }}>
                Waiting for <b>{offeredName}</b> to accept or skip…
              </div>
            )
          ) : null}

          {/* ACCEPTED */}
          {acceptedOffer ? (
            <>
              <div style={{ opacity: 0.85, fontSize: 13 }}>
                Accepted cluegiver: <b>{acceptedName}</b>
              </div>

              {accepted && isAcceptedCluegiver ? (
                <>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
                    Start the round when your team is ready, or pass it on.
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      marginTop: 10,
                    }}
                  >
                    <button
                      type="button"
                      style={btnPrimary}
                      onClick={handleStartAccepted}
                    >
                      Start Round
                    </button>
                    <button type="button" style={btn} onClick={onSkipOffer}>
                      Pass / Decline
                    </button>
                  </div>

                  {typeof onStartAcceptedRound !== "function" ? (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                      ⚠️ Start handler missing (frontend wiring issue)
                    </div>
                  ) : null}
                </>
              ) : accepted ? (
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
                  Waiting for <b>{acceptedName}</b> to start…
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      )}

      {/* Show board for accepted cluegiver BEFORE starting */}
      {accepted && isAcceptedCluegiver && round?.board?.length > 0 ? (
        <>
          <div style={{ marginBottom: 10, opacity: 0.9 }}>
            Preview your board. Click "Start Round" when ready!
          </div>
          <Board tiles={round.board || []} role="cluegiver" guessed={round.guessed || {}} />
        </>
      ) : null}

      {playing ? (
        <>
          <div style={{ marginBottom: 10, lineHeight: 1.5 }}>
            <div>
              Round <b>#{round.number}</b> | Active team:{" "}
              <b>{round.activeTeam}</b> | Role: <b>{role}</b>
            </div>

            <div style={{ opacity: 0.85 }}>
              Cluegiver: <b>{clueGiverName}</b>
            </div>

            <div style={{ opacity: 0.85 }}>
              Time left: <b>{secondsLeft == null ? "-" : `${secondsLeft}s`}</b>
            </div>

            <div style={{ opacity: 0.75, fontSize: 12 }}>
              Your team: <b>{myTeam ? myTeam.toUpperCase() : "NO TEAM"}</b>
            </div>
          </div>

          <div style={clueBox}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>CLUE</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {clueText ? (
                clueText
              ) : (
                <span style={{ opacity: 0.6 }}>Not set yet</span>
              )}
            </div>
          </div>

          <Board tiles={round.board || []} role={role} guessed={round.guessed || {}} />

          {role === "cluegiver" ? (
            <ClueInput onSubmit={onSetClue} />
          ) : canGuess ? (
            <GuessInput onSubmit={onGuess} />
          ) : (
            <div style={infoBox}>
              {myTeam
                ? `Not your turn. ${activeTeam?.toUpperCase()} team is guessing.`
                : "Pick a team to participate."}
            </div>
          )}

          {/* Show guess log during active round */}
          <GuessLog guesses={guessLog} maxDisplay={5} />
        </>
      ) : (
        <>
          <div style={{ opacity: 0.8 }}>Not currently in a round.</div>

          {endedInfo?.payload?.fullBoard?.length ? (
            <div style={{ marginTop: 12 }}>
              <h4 style={{ marginBottom: 8 }}>Last board reveal</h4>
              <Board tiles={endedInfo.payload.fullBoard} role={"reveal"} guessed={endedInfo.payload.guessed || {}} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

const card = {
  border: "1px solid #333",
  padding: 12,
  borderRadius: 10,
  marginBottom: 12,
  background: "#1a1a1a",
  color: "#fff",
};

const scoreWrap = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginBottom: 12,
};

const scoreBox = {
  border: "1px solid #333",
  borderRadius: 10,
  padding: 10,
  background: "#0a0a0a",
};

const scoreNum = {
  fontSize: 20,
  fontWeight: 800,
  color: "#fff",
};

const clueBox = {
  border: "1px solid #333",
  borderRadius: 10,
  padding: 10,
  marginBottom: 12,
  background: "#0a0a0a",
};

const infoBox = {
  border: "1px solid #333",
  borderRadius: 10,
  padding: 10,
  marginTop: 8,
  fontSize: 13,
  opacity: 0.85,
  background: "#0a0a0a",
  color: "#aaa",
};

const offerBox = {
  border: "1px solid #333",
  borderRadius: 10,
  padding: 10,
  marginBottom: 12,
  background: "#0a0a0a",
  color: "#fff",
};

const btn = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #555",
  background: "#2a2a2a",
  color: "#fff",
  cursor: "pointer",
  transition: "all 0.2s",
};

const btnPrimary = {
  ...btn,
  border: "1px solid #fff",
  background: "#fff",
  color: "#000",
  fontWeight: 700,
};
