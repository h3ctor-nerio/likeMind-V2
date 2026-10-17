const ADJECTIVES = [
  "Quiet", "Bright", "Gentle", "Curious", "Steady", "Kind", "Brave", "Warm", "Patient", "Hopeful",
  "Open", "Sunny", "Calm", "Thoughtful", "Merry", "Wandering", "Bold", "Soft", "Clever", "Golden",
];
const NOUNS = [
  "Heron", "Maple", "River", "Lantern", "Finch", "Harbor", "Willow", "Comet", "Otter", "Meadow",
  "Pine", "Sparrow", "Tide", "Cedar", "Robin", "Ember", "Fern", "Kite", "Pebble", "Aspen",
];

export function randomDisplayName() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${n}${Math.floor(10 + Math.random() * 90)}`;
}
