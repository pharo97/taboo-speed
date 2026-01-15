import { useMemo, useState } from "react";

export default function HostControls({
  onStartRound,
  onUpdateSettings,
  onEndGame,
  disabled,
  currentSettings,

  // pass room or offer so host can't spam-start during offer flow
  room,
  offer,
}) {
  const initial = useMemo(
    () => ({
      roundSeconds: currentSettings?.roundSeconds ?? 30,
      targetScore: currentSettings?.targetScore ?? 300,
    }),
    [currentSettings?.roundSeconds, currentSettings?.targetScore]
  );

  // draft is user-editable; we don't auto-clobber it on every room sync
  const [draft, setDraft] = useState(initial);

  const effectiveOffer = offer ?? room?.round?.offer ?? null;

  const offerStatus = effectiveOffer?.status || null;
  const offerActive = offerStatus === "pending" || offerStatus === "accepted";

  const startDisabled = disabled || offerActive;

  const startLabel = useMemo(() => {
    if (disabled) return "Start Round";
    if (offerStatus === "pending") return "Offer Sent (waiting...)";
    if (offerStatus === "accepted") return "Cluegiver Accepted (waiting...)";
    return "Start Round";
  }, [disabled, offerStatus]);

  function applySettings() {
    onUpdateSettings?.({
      roundSeconds: Number(draft.roundSeconds),
      targetScore: Number(draft.targetScore),
    });
  }

  function resetToCurrent() {
    setDraft({
      roundSeconds: currentSettings?.roundSeconds ?? 30,
      targetScore: currentSettings?.targetScore ?? 300,
    });
  }

  return (
    <div style={card}>
      <h3 style={title}>Host Controls</h3>

      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <label style={label}>
          Round Time (seconds)
          <input
            type="number"
            min={10}
            max={300}
            value={draft.roundSeconds}
            onChange={(e) =>
              setDraft((d) => ({ ...d, roundSeconds: e.target.value }))
            }
            disabled={disabled}
            style={input}
          />
        </label>

        <label style={label}>
          Target Score
          <input
            type="number"
            min={25}
            max={5000}
            value={draft.targetScore}
            onChange={(e) =>
              setDraft((d) => ({ ...d, targetScore: e.target.value }))
            }
            disabled={disabled}
            style={input}
          />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={applySettings} disabled={disabled} style={btn}>
            Apply Settings
          </button>
          <button onClick={resetToCurrent} disabled={disabled} type="button" style={btn}>
            Reset
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={startDisabled} onClick={onStartRound} style={btnPrimary}>
          {startLabel}
        </button>

        <button
          onClick={onEndGame}
          style={btnDanger}
          title="Force end the game (determines winner by current score)"
        >
          End Game
        </button>
      </div>

      {offerActive ? (
        <div style={hint}>
          Host already started cluegiver selection. Wait for accept/skip. After
          accept, the cluegiver starts when ready.
        </div>
      ) : null}
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

const title = { marginTop: 0, marginBottom: 10, color: "#fff" };

const label = {
  display: "block",
  color: "#fff",
  marginBottom: 8,
};

const input = {
  display: "block",
  width: "100%",
  padding: "12px 14px",
  marginTop: 4,
  borderRadius: 8,
  border: "1px solid #444",
  background: "#2a2a2a",
  color: "#fff",
  outline: "none",
  boxSizing: "border-box",
  fontSize: 16,
  minHeight: 44,
};

const btn = {
  padding: "12px 16px",
  borderRadius: 8,
  border: "1px solid #555",
  background: "#2a2a2a",
  color: "#fff",
  cursor: "pointer",
  transition: "all 0.2s",
  fontSize: 14,
  minHeight: 44,
};

const btnPrimary = {
  ...btn,
  border: "1px solid #fff",
  background: "#fff",
  color: "#000",
  fontWeight: 700,
};

const btnDanger = {
  ...btn,
  border: "1px solid #ef4444",
  background: "#ef4444",
  color: "#fff",
  fontWeight: 600,
};

const hint = {
  marginTop: 10,
  fontSize: 12,
  opacity: 0.75,
  lineHeight: 1.4,
  color: "#aaa",
};
