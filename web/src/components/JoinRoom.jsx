// web/src/components/JoinRoom.jsx
import { useState } from "react";
import Button from "./Button";

export default function JoinRoom({ onJoin, disabled }) {
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [name, setName] = useState("");

  function submit(e) {
    e.preventDefault();
    if (disabled) return;

    const rc = roomCodeInput.trim().toUpperCase();
    const nm = name.trim();

    if (!rc) return;

    onJoin({ roomCodeInput: rc, name: nm || "Player" });

    // keep room code so they can retry quickly
    setName("");
  }

  return (
    <div style={card}>
      <h4 style={title}>Join Existing Game</h4>

      <form onSubmit={submit} style={form}>
        <input
          value={roomCodeInput}
          onChange={(e) => setRoomCodeInput(e.target.value)}
          placeholder="Room Code (e.g. TF8QGR)"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={!!disabled}
          style={input}
        />

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name (optional)"
          disabled={!!disabled}
          style={input}
        />

        <Button
          variant="primary"
          type="submit"
          disabled={!!disabled}
          size="large"
        >
          Join Game
        </Button>

        <div style={hint}>
          Enter the 6-character room code from your friend
        </div>
      </form>
    </div>
  );
}

const card = {
  border: "1px solid var(--border-primary)",
  padding: "var(--space-md)",
  marginBottom: "var(--space-md)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
};

const title = {
  marginTop: 0,
  marginBottom: "var(--space-md)",
  fontSize: "var(--text-lg)",
  color: "var(--text-primary)",
  fontWeight: 600,
};

const form = {
  display: "grid",
  gap: "var(--space-md)",
};

const input = {
  padding: "var(--space-md)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-secondary)",
  background: "var(--bg-tertiary)",
  color: "var(--text-primary)",
  outline: "none",
  fontSize: "var(--text-base)",
  minHeight: "48px",
  transition: "all 0.2s ease",
};

const hint = {
  fontSize: "var(--text-sm)",
  color: "var(--text-secondary)",
  opacity: 0.75,
};
