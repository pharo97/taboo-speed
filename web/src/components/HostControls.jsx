import { useMemo, useState } from "react";
import { SettingsIcon, PlayIcon, XIcon } from "./Icons";
import Button from "./Button";

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
      <div style={header}>
        <SettingsIcon size={18} color="var(--text-primary)" />
        <h4 style={title}>Host Controls</h4>
      </div>

      <div style={settingsGrid}>
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

        <div style={buttonGroup}>
          <Button onClick={applySettings} disabled={disabled} variant="default">
            Apply Settings
          </Button>
          <Button onClick={resetToCurrent} disabled={disabled} type="button" variant="ghost" size="small">
            Reset
          </Button>
        </div>
      </div>

      <div style={actionsSection}>
        <Button disabled={startDisabled} onClick={onStartRound} variant="accent" size="large">
          <PlayIcon size={16} color="#fff" />
          {startLabel}
        </Button>

        <Button
          onClick={onEndGame}
          variant="danger"
        >
          <XIcon size={16} color="#fff" />
          End Game
        </Button>
      </div>

      {offerActive ? (
        <div style={hint}>
          Host already started cluegiver selection. Wait for accept/skip. After accept, the cluegiver starts when ready.
        </div>
      ) : null}
    </div>
  );
}

const card = {
  border: "1px solid var(--border-primary)",
  padding: "var(--space-md)",
  borderRadius: "var(--radius-md)",
  marginBottom: "var(--space-md)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
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

const settingsGrid = {
  display: "grid",
  gap: "var(--space-md)",
  marginBottom: "var(--space-md)",
};

const label = {
  display: "block",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
};

const input = {
  display: "block",
  width: "100%",
  padding: "var(--space-md)",
  marginTop: "var(--space-xs)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-secondary)",
  background: "var(--bg-tertiary)",
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
  fontSize: "var(--text-base)",
  minHeight: "44px",
  transition: "all 0.2s ease",
};

const buttonGroup = {
  display: "flex",
  gap: "var(--space-sm)",
  flexWrap: "wrap",
};

const actionsSection = {
  display: "flex",
  gap: "var(--space-sm)",
  flexWrap: "wrap",
};

const hint = {
  marginTop: "var(--space-md)",
  fontSize: "var(--text-sm)",
  color: "var(--text-secondary)",
  opacity: 0.75,
  lineHeight: 1.4,
};
