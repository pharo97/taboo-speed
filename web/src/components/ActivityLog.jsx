import { ActivityIcon } from "./Icons";

// ActivityLog - Displays room activity and events
export default function ActivityLog({ log = [], maxEntries = 50 }) {
  const displayLog = log.slice(0, maxEntries);

  return (
    <div style={container}>
      <div style={header}>
        <ActivityIcon size={18} color="var(--text-primary)" />
        <h4 style={title}>Activity Log</h4>
      </div>

      <div style={logContainer}>
        {displayLog.length === 0 ? (
          <div style={emptyState}>No activity yet</div>
        ) : (
          displayLog.map((entry, index) => (
            <div key={index} style={logEntry} className="animate-fade-in">
              <div style={logText}>{entry}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const container = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-primary)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-md)",
  height: "100%",
  display: "flex",
  flexDirection: "column",
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

const logContainer = {
  flex: 1,
  overflowY: "auto",
  fontSize: "var(--text-sm)",
  fontFamily: "var(--font-mono)",
  maxHeight: "420px",
};

const logEntry = {
  padding: "var(--space-xs) var(--space-sm)",
  marginBottom: "2px",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-primary)",
};

const logText = {
  color: "var(--text-secondary)",
  fontSize: "var(--text-xs)",
  wordBreak: "break-word",
  lineHeight: 1.4,
};

const emptyState = {
  color: "var(--text-tertiary)",
  fontSize: "var(--text-sm)",
  textAlign: "center",
  padding: "var(--space-xl)",
  opacity: 0.7,
};
