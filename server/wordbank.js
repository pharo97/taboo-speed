// server/wordbank.js
const fs = require("fs");
const path = require("path");

const WORDS_PATH = path.join(__dirname, "data", "taboo_words.txt");

function normalize(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}

// Slightly less strict than before so "hard" isn't a unicorn.
function classifyDifficulty(word) {
  const w = word.trim();
  const isMultiWord = /\s/.test(w);
  const len = w.replace(/\s+/g, "").length;

  // tweak as you want
  if (isMultiWord || len >= 10) return "hard";
  if (len >= 6) return "medium";
  return "easy";
}

function pointsForDifficulty(diff) {
  if (diff === "hard") return 15;
  if (diff === "medium") return 10;
  return 5;
}

let CACHE = null;

function loadWordBank() {
  if (CACHE) return CACHE;

  if (!fs.existsSync(WORDS_PATH)) {
    throw new Error(`Word list missing: ${WORDS_PATH}`);
  }

  const raw = fs.readFileSync(WORDS_PATH, "utf8");

  const lines = raw.split(/\r?\n/).map(normalize).filter(Boolean);

  const seen = new Set();
  const words = [];

  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const difficulty = classifyDifficulty(line);

    words.push({
      word: line,
      difficulty,
      points: pointsForDifficulty(difficulty),
    });
  }

  CACHE = words;
  return CACHE;
}

module.exports = { loadWordBank };
