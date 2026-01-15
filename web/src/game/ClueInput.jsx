import { useState } from "react";

export default function ClueInput({ onSubmit }) {
  const [text, setText] = useState("");

  return (
    <div style={{ marginTop: 8 }}>
      <h4 style={{ margin: "8px 0", color: "#fff" }}>Set Clue</h4>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="clue..."
          style={inputStyle}
        />
        <button onClick={() => {
            const v = text.trim();
            if (!v) return;
            onSubmit(v);
            setText("");
          }}
          style={buttonStyle}
        >
          Send
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid #444",
  background: "#2a2a2a",
  color: "#fff",
  fontSize: 16,
  outline: "none",
  minHeight: 44,
};

const buttonStyle = {
  padding: "12px 20px",
  borderRadius: 8,
  border: "1px solid #fff",
  background: "#fff",
  color: "#000",
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 0.2s",
  fontSize: 14,
  minHeight: 44,
};
