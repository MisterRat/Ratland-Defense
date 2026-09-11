// Level identity + naming helpers shared by the generator page and smoke tests.
// The UUID (128-bit v4) is the level's identifier for the code — it goes into
// the JSON so shared levels can be deduped across users. The silly 2-word name
// is for humans only; the user can change it before creating.

// RFC 4122 v4 UUID, lowercase hyphenated (8-4-4-4-12). Uses crypto when
// available; falls back to Math.random so headless/file:// contexts work.
function lgUuid() {
  let bytes = null;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
  } else {
    bytes = new Array(16);
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const h = [];
  for (let i = 0; i < 16; i++) h.push((bytes[i] + 0x100).toString(16).slice(-2));
  return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' +
    h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' +
    h.slice(10, 16).join('');
}

// Silly name parts: deliberately absurd combos (adjective + noun).
const LG_ADJ = [
  'Soggy', 'Gristly', 'Wobbly', 'Grumpy', 'Feral', 'Mopey', 'Sneaky',
  'Bumbling', 'Cranky', 'Fluffy', 'Rancid', 'Sleepy', 'Wacky', 'Damp',
  'Curly', 'Sour', 'Giggly', 'Sticky', 'Lumbering', 'Spicy',
];
const LG_NOUN = [
  'Walrus', 'Toaster', 'Badger', 'Noodle', 'Pickle', 'Ostrich', 'Anvil',
  'Meatball', 'Sprocket', 'Gopher', 'Muffin', 'Tuba', 'Cactus', 'Waffle',
  'Penguin', 'Doorbell', 'Turnip', 'Chandelier', 'Hedgehog', 'Submarine',
];

// One silly 2-word name from a seeded RNG (mulberry32 instance) so the name
// is stable for a given Generate press.
function lgSillyName(rng) {
  const adj = LG_ADJ[Math.floor(rng() * LG_ADJ.length)];
  const noun = LG_NOUN[Math.floor(rng() * LG_NOUN.length)];
  return adj + ' ' + noun;
}
