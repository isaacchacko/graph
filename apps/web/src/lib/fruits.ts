/** Default node names, one per letter. */
export const FRUITS = [
  "Apple",
  "Banana",
  "Cherry",
  "Durian",
  "Elderberry",
  "Fig",
  "Grape",
  "Honeydew",
  "Imbe",
  "Jackfruit",
  "Kiwi",
  "Lemon",
  "Mango",
  "Nectarine",
  "Orange",
  "Papaya",
  "Quince",
  "Raspberry",
  "Strawberry",
  "Tangerine",
  "Ugli",
  "Voavanga",
  "Watermelon",
  "Xigua",
  "Yuzu",
  "Zucchini",
];

/** The first fruit not already taken; once all 26 are, Apple2, Banana2, … then Apple3. */
export function fruitName(taken: Iterable<string>): string {
  const names = new Set(taken);
  for (let round = 1; ; round++) {
    const suffix = round === 1 ? "" : String(round);
    const free = FRUITS.find((fruit) => !names.has(fruit + suffix));
    if (free) return free + suffix;
  }
}
