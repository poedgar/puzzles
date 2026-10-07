// Puzzle registry. To add a puzzle, append an object to PUZZLES.
//
// Fields:
//   id, category, title, difficulty  – metadata
//   statement                        – HTML shown above the figure
//   figure(showConstruction)         – returns an SVG string
//   answer                           – numeric value of the correct answer
//   exact                            – exact form, shown after solving
//   tolerance                        – accepted absolute error
//   hints                            – array of HTML strings revealed one by one
//   solution                         – array of HTML steps

const CATEGORIES = [
  { id: "geometry", name: "Geometry" },
];

const PUZZLES = [
  {
    id: "two-circles-in-square",
    category: "geometry",
    title: "Two circles in a square",
    difficulty: "Easy",
    statement: `
      Two circles, each with radius <b>1</b>, fit inside a square.
      They touch each other, and each circle touches two sides of the square
      (they sit in opposite corners). What is the <b>area of the square</b>?`,
    figure(showConstruction) {
      const s = 2 + Math.SQRT2; // side length
      const pad = 0.15;
      const c1 = 1, c2 = s - 1;
      const construction = showConstruction ? `
        <line x1="0" y1="0" x2="${s}" y2="${s}" stroke="#94a3b8" stroke-width="0.02" stroke-dasharray="0.08 0.06"/>
        <line x1="${c1}" y1="${c1}" x2="${c1}" y2="0" stroke="#f59e0b" stroke-width="0.03"/>
        <line x1="${c1}" y1="${c1}" x2="0" y2="${c1}" stroke="#f59e0b" stroke-width="0.03"/>
        <line x1="${c1}" y1="${c1}" x2="${c2}" y2="${c2}" stroke="#ef4444" stroke-width="0.03"/>
        <line x1="${c2}" y1="${c2}" x2="${c2}" y2="${s}" stroke="#f59e0b" stroke-width="0.03"/>
        <line x1="${c2}" y1="${c2}" x2="${s}" y2="${c2}" stroke="#f59e0b" stroke-width="0.03"/>
        <circle cx="${c1}" cy="${c1}" r="0.04" fill="#0f172a"/>
        <circle cx="${c2}" cy="${c2}" r="0.04" fill="#0f172a"/>
        <text x="${c1 + 0.08}" y="0.5" font-size="0.2" fill="#b45309">1</text>
        <text x="0.45" y="${c1 - 0.08}" font-size="0.2" fill="#b45309">1</text>
        <text x="${s / 2 + 0.1}" y="${s / 2 - 0.05}" font-size="0.2" fill="#dc2626">2</text>` : "";
      return `
        <svg viewBox="${-pad} ${-pad} ${s + 2 * pad} ${s + 2 * pad}" class="block w-full">
          <rect x="0" y="0" width="${s}" height="${s}" fill="#eef2ff" stroke="#4f46e5" stroke-width="0.04"/>
          <circle cx="${c1}" cy="${c1}" r="1" fill="#c7d2fe" fill-opacity="0.7" stroke="#4338ca" stroke-width="0.03"/>
          <circle cx="${c2}" cy="${c2}" r="1" fill="#c7d2fe" fill-opacity="0.7" stroke="#4338ca" stroke-width="0.03"/>
          ${construction}
        </svg>`;
    },
    answer: (2 + Math.SQRT2) ** 2, // 6 + 4√2 ≈ 11.657
    exact: "6 + 4√2 ≈ 11.657",
    tolerance: 0.01,
    hints: [
      "Both circle centres lie on the diagonal of the square.",
      "Each centre is 1 unit from two sides, so it is √2 away from its nearest corner along the diagonal.",
      "The diagonal = √2 + 2 + √2. The diagonal of a square with side s is s·√2.",
    ],
    solution: [
      "By symmetry, both centres lie on the diagonal from one corner to the opposite corner.",
      "The first centre is at (1, 1), so its distance to the corner is √(1² + 1²) = √2. The same holds for the second circle.",
      "The circles touch, so the distance between the centres is 1 + 1 = 2.",
      "Diagonal: d = √2 + 2 + √2 = 2 + 2√2.",
      "Side: s = d / √2 = √2 + 2.",
      "Area: s² = (2 + √2)² = 4 + 4√2 + 2 = <b>6 + 4√2 ≈ 11.657</b>.",
    ],
  },
];
