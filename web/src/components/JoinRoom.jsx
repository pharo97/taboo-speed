// web/src/components/JoinRoom.jsx
import { useState } from "react";

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
    <div style={{ border: "1px solid #ddd", padding: 12, marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>Join Game</h3>

      <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
        <input
          value={roomCodeInput}
          onChange={(e) => setRoomCodeInput(e.target.value)}
          placeholder="Room Code (e.g. TF8QGR)"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={!!disabled}
        />

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name (optional)"
          disabled={!!disabled}
        />

        <button type="submit" disabled={!!disabled}>
          Join
        </button>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          One code. One job. Humans will still mess it up.
        </div>
      </form>
    </div>
  );
}
