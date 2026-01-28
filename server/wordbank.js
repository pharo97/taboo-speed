// server/wordbank.js
const fs = require("fs");
const path = require("path");

const WORDS_PATH = path.join(__dirname, "data", "taboo_words.txt");

function normalize(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}

// Word categories for balanced distribution
const CATEGORIES = {
  // People & Professions
  PEOPLE: ['Doctor', 'Lawyer', 'Teacher', 'Engineer', 'Artist', 'Musician', 'Chef', 'Pilot', 'Athlete', 'Scientist', 'King', 'Queen', 'Prince', 'Princess', 'Knight', 'Warrior', 'Hero', 'Villain', 'Leader', 'Champion'],

  // Places & Locations
  PLACES: ['Africa', 'Castle', 'City', 'Ocean', 'River', 'School', 'Forest', 'Pyramid', 'House', 'Building', 'Tower', 'Palace', 'Temple', 'Bridge', 'Tunnel', 'Stadium', 'Museum', 'Volcano', 'Desert', 'Mountain', 'Island', 'Canyon', 'Jungle', 'Valley', 'Glacier', 'Peninsula', 'Lagoon', 'Rio de Janeiro'],

  // Actions & Verbs
  ACTIONS: ['Sleep', 'Brush', 'Dance', 'Sing', 'Jump', 'Run', 'Walk', 'Swim', 'Fly', 'Climb', 'Crawl', 'Slide'],

  // Objects & Things
  OBJECTS: ['Car', 'Duck', 'Bear', 'Sand', 'Ticket', 'Hawk', 'Milk', 'Pizza', 'Ring', 'Ball', 'Wind', 'Monkey', 'Shoes', 'Camera', 'Knife', 'Robot', 'Rain', 'Game', 'Chair', 'Horse', 'Storm', 'Watch', 'Egg', 'Window', 'Bread', 'Satellite', 'Bicycle', 'Motorcycle', 'Helicopter', 'Submarine', 'Rocket', 'Spaceship', 'Jet', 'Boat', 'Train', 'Airplane', 'Diamond', 'Gold', 'Silver', 'Bronze', 'Copper', 'Iron', 'Steel', 'Platinum', 'Emerald', 'Ruby'],

  // Adjectives & Descriptions
  ADJECTIVES: ['Trust', 'Justice', 'Love', 'Energy', 'Freedom', 'Peace', 'War', 'Victory', 'Defeat', 'Truth', 'Power', 'Hope', 'Dangerous', 'Beautiful', 'Powerful', 'Ancient', 'Modern', 'Frozen', 'Golden', 'Silent', 'Broken', 'Mysterious', 'Lonely', 'Curious', 'Brave', 'Gentle', 'Fierce', 'Quick', 'Slow', 'Fast', 'Loud', 'Quiet', 'Hot', 'Cold', 'Big', 'Small', 'Tall'],

  // Technology & Modern
  TECHNOLOGY: ['Internet', 'Robot', 'Satellite', 'Computer', 'Telephone', 'Television', 'Laptop', 'Smartphone', 'Tablet', 'Email', 'YouTube', 'Spotify', 'iPhone', 'PlayStation', 'Xbox', 'Laptop', 'Keyboard', 'Mouse', 'Monitor', 'Printer', 'Router', 'Charger', 'Headphones', 'Speaker', 'Webcam', 'Facebook', 'Instagram', 'Twitter', 'TikTok', 'Snapchat', 'WhatsApp', 'Discord', 'Reddit', 'Amazon', 'Netflix'],

  // Entertainment & Culture
  ENTERTAINMENT: ['Game', 'Holiday', 'Plate', 'Fortnite', 'Call of Duty', 'Minecraft', 'Naruto'],

  // Nature & Weather
  NATURE: ['Tiger', 'Bear', 'Duck', 'Hawk', 'Monkey', 'Horse', 'Wind', 'Rain', 'Storm', 'Night', 'Rainbow', 'Lightning', 'Thunder', 'Snowflake', 'Sunset', 'Sunrise', 'Eclipse', 'Comet', 'Aurora', 'Meteor'],

  // Food & Drink
  FOOD: ['Pizza', 'Milk', 'Apple', 'Bread', 'Egg', 'Burger', 'Sushi', 'Taco', 'Pasta', 'Curry', 'Sandwich', 'Salad', 'Soup', 'Steak', 'Coffee', 'Tea', 'Juice', 'Soda', 'Water', 'Beer', 'Wine', 'Cocktail', 'Smoothie', 'Milkshake'],

  // Emotions
  EMOTIONS: ['Happy', 'Sad', 'Angry', 'Excited', 'Nervous', 'Calm', 'Scared', 'Proud', 'Jealous', 'Confused'],

  // Time
  TIME: ['Summer', 'Winter', 'Spring', 'Autumn', 'January', 'February', 'March', 'April', 'May', 'June', 'Morning', 'Afternoon', 'Evening', 'Night', 'Midnight', 'Dawn', 'Dusk', 'Twilight', 'Noon', 'Sunrise'],

  // Sports
  SPORTS: ['Marathon', 'Basketball', 'Soccer', 'Tennis', 'Swimming', 'Boxing', 'Wrestling', 'Gymnastics', 'Surfing', 'Skiing'],

  // Music
  MUSIC: ['Guitar', 'Piano', 'Drum', 'Violin', 'Trumpet', 'Saxophone', 'Flute', 'Harmonica', 'Accordion', 'Microphone'],

  // Fantasy
  FANTASY: ['Dragon', 'Phoenix', 'Unicorn', 'Mermaid', 'Vampire', 'Werewolf', 'Zombie', 'Ghost', 'Witch', 'Wizard'],

  // Shapes
  SHAPES: ['Circle', 'Square', 'Triangle', 'Star', 'Heart', 'Arrow', 'Cross', 'Diamond', 'Spiral', 'Oval']
};

function getWordCategory(word) {
  const normalizedWord = word.trim();
  for (const [category, words] of Object.entries(CATEGORIES)) {
    if (words.some(w => w.toLowerCase() === normalizedWord.toLowerCase())) {
      return category;
    }
  }
  return 'GENERAL';
}

function classifyDifficulty(word) {
  const w = word.trim();
  const isMultiWord = /\s/.test(w);
  const len = w.replace(/\s+/g, "").length;

  // Multi-word phrases are always hard
  if (isMultiWord) return "hard";

  // Check category-based difficulty
  const category = getWordCategory(w);

  // Abstract concepts and emotions are typically harder
  if (category === 'ADJECTIVES' || category === 'EMOTIONS') {
    if (len >= 8) return "hard";
    if (len >= 5) return "medium";
    return "easy";
  }

  // Technology and modern terms can be tricky
  if (category === 'TECHNOLOGY' || category === 'ENTERTAINMENT') {
    if (len >= 9) return "hard";
    if (len >= 6) return "medium";
    return "easy";
  }

  // Fantasy and uncommon words are harder
  if (category === 'FANTASY') {
    if (len >= 8) return "hard";
    return "medium";
  }

  // Default length-based classification
  if (len >= 10) return "hard";
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
    const category = getWordCategory(line);

    words.push({
      word: line,
      difficulty,
      category,
      points: pointsForDifficulty(difficulty),
    });
  }

  CACHE = words;
  return CACHE;
}

function reloadWordBank() {
  CACHE = null;
  return loadWordBank();
}

module.exports = { loadWordBank, reloadWordBank };
