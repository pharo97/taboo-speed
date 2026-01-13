import { useState } from "react";

export default function ClueInput({ onSubmit }) {
  const [text, setText] = useState("");

  return (
    <div style={{ marginTop: 8 }}>
      <h4 style={{ margin: "8px 0" }}>Set Clue</h4>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="clue..."
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
          Send
        </button>
      </div>
    </div>
  );
}
