import { ShieldIcon } from "./Icons";
import Button from "./Button";

export default function TeamPicker({ myTeam, onPick, disabled }) {
  return (
    <div style={container}>
      <div style={header}>
        <ShieldIcon size={18} color="var(--text-primary)" />
        <h4 style={title}>Select Squad</h4>
      </div>

      <div style={teamGrid}>
        <button
          disabled={disabled}
          onClick={() => onPick("blue")}
          style={{
            ...teamButton,
            ...(myTeam === "blue" ? teamButtonActiveBlue : teamButtonInactive),
          }}
        >
          <div style={teamButtonContent}>
            <ShieldIcon size={24} color={myTeam === "blue" ? "var(--blue-light)" : "var(--blue-base)"} />
            <span style={teamButtonText}>BLUE TEAM</span>
            {myTeam === "blue" && <span style={activeIndicator}>✓ SELECTED</span>}
          </div>
        </button>

        <button
          disabled={disabled}
          onClick={() => onPick("red")}
          style={{
            ...teamButton,
            ...(myTeam === "red" ? teamButtonActiveRed : teamButtonInactive),
          }}
        >
          <div style={teamButtonContent}>
            <ShieldIcon size={24} color={myTeam === "red" ? "var(--red-light)" : "var(--red-base)"} />
            <span style={teamButtonText}>RED TEAM</span>
            {myTeam === "red" && <span style={activeIndicator}>✓ SELECTED</span>}
          </div>
        </button>
      </div>

      {myTeam && (
        <div style={currentTeamDisplay}>
          Current squad: <strong style={currentTeamName(myTeam)}>{myTeam.toUpperCase()}</strong>
        </div>
      )}
    </div>
  );
}

const container = {
  border: "1px solid var(--border-primary)",
  padding: "var(--space-md)",
  marginBottom: "var(--space-md)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-card)",
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

const teamGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--space-md)",
};

const teamButton = {
  padding: "var(--space-lg)",
  borderRadius: "var(--radius-md)",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
  fontSize: "var(--text-base)",
  minHeight: "80px",
  border: "2px solid transparent",
  position: "relative",
};

const teamButtonInactive = {
  background: "var(--bg-tertiary)",
  border: "2px solid var(--border-secondary)",
  color: "var(--text-primary)",
};

const teamButtonActiveBlue = {
  background: "var(--blue-bg)",
  border: "2px solid var(--blue-base)",
  color: "var(--blue-light)",
  boxShadow: "0 0 20px var(--blue-glow)",
};

const teamButtonActiveRed = {
  background: "var(--red-bg)",
  border: "2px solid var(--red-base)",
  color: "var(--red-light)",
  boxShadow: "0 0 20px var(--red-glow)",
};

const teamButtonContent = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--space-sm)",
};

const teamButtonText = {
  fontSize: "var(--text-base)",
  fontWeight: 700,
  letterSpacing: "0.05em",
};

const activeIndicator = {
  fontSize: "var(--text-xs)",
  opacity: 0.8,
  fontWeight: 600,
};

const currentTeamDisplay = {
  marginTop: "var(--space-md)",
  fontSize: "var(--text-sm)",
  color: "var(--text-secondary)",
  textAlign: "center",
};

const currentTeamName = (team) => ({
  color: team === "blue" ? "var(--blue-base)" : team === "red" ? "var(--red-base)" : "var(--text-primary)",
  fontWeight: 700,
});
