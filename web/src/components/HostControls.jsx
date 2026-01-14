import { useMemo, useState } from "react";

export default function HostControls({
  onStartRound,
  onUpdateSettings,
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
      <h3 style={{ marginTop: 0 }}>Host Controls</h3>

      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <label>
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
          />
        </label>

        <label>
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
          />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={applySettings} disabled={disabled}>
            Apply Settings
          </button>
          <button onClick={resetToCurrent} disabled={disabled} type="button">
            Reset
          </button>
        </div>
      </div>

      <button disabled={startDisabled} onClick={onStartRound}>
        {startLabel}
      </button>

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
  border: "1px solid #ddd",
  padding: 12,
  borderRadius: 10,
  marginBottom: 12,
};

const hint = {
  marginTop: 10,
  fontSize: 12,
  opacity: 0.75,
  lineHeight: 1.4,
};
