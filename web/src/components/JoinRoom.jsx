// src/components/JoinRoom.jsx
import { useState } from "react";

export default function JoinRoom({ onJoin, disabled }) {
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  function submit(e) {
    e.preventDefault();
    if (disabled) return;

    const rc = roomCodeInput.trim().toUpperCase();
    const nm = name.trim(); // allow blank, server will default to "Player"
    const pw = password.trim().toUpperCase();

    if (!rc || !pw) return;

    onJoin({ roomCodeInput: rc, name: nm, password: pw });

    // keep room code, clear the rest
    setName("");
    setPassword("");
  }

  return (
    <div
      style={{
        border: "1px solid #ddd",
        padding: 12,
        marginBottom: 12,
        borderRadius: 10,
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 10 }}>Join Game</h3>

      <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
        <input
          value={roomCodeInput}
          onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
          placeholder="Room Code (ABC123)"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={!!disabled}
          maxLength={12}
          style={monoInput}
        />

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value.toUpperCase())}
          placeholder="Password (A1B2C3)"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={!!disabled}
          maxLength={12}
          style={monoInput}
        />

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          disabled={!!disabled}
          maxLength={40}
        />

        <button type="submit" disabled={!!disabled}>
          Join
        </button>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          You need the room code + password. If you still mess it up, that’s
          between you and God.
        </div>
      </form>
    </div>
  );
}

const monoInput = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  letterSpacing: 1,
};
