import { useState } from "react";

export default function GuessInput({ onSubmit }) {
  const [text, setText] = useState("");

  return (
    <div style={{ marginTop: 8 }}>
      <h4 style={{ margin: "8px 0" }}>Guess</h4>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="type your guess..."
          style={{ flex: 1 }}
        />
        <button
          onClick={() => {
            const v = text.trim();
            if (!v) return;
            onSubmit(v);
            setText("");
          }}
        >
          Guess
        </button>
      </div>
    </div>
  );
}
