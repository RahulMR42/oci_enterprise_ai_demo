export const defaultCardAppearance = {
  reflection: 46,
  darkness: 28,
  tune: "classic"
};

export const cardColorTunes = [
  {
    id: "classic",
    label: "Classic",
    colors: {
      teal: ["#2f4f4f", "#3f6b68", "#6f7d71"],
      blue: ["#243447", "#31516f", "#607d99"],
      violet: ["#3a3f4b", "#555d6b", "#77736c"],
      amber: ["#7a4d22", "#9b6a32", "#b08a57"],
      green: ["#31533d", "#4f745a", "#77856c"],
      red: ["#7f251f", "#a33a32", "#c56a4b"]
    }
  },
  {
    id: "bright",
    label: "Bright",
    colors: {
      teal: ["#0891b2", "#0d9488", "#22c55e"],
      blue: ["#1d4ed8", "#2563eb", "#06b6d4"],
      violet: ["#6d28d9", "#8b5cf6", "#ec4899"],
      amber: ["#ea580c", "#f59e0b", "#eab308"],
      green: ["#047857", "#16a34a", "#84cc16"],
      red: ["#dc2626", "#f97316", "#facc15"]
    }
  },
  {
    id: "graphite",
    label: "Graphite",
    colors: {
      teal: ["#0f3f46", "#245b63", "#48766f"],
      blue: ["#172554", "#334155", "#64748b"],
      violet: ["#2e1065", "#4338ca", "#6b7280"],
      amber: ["#3f2d1a", "#6b4f2a", "#a16207"],
      green: ["#143322", "#365f45", "#64745b"],
      red: ["#4a1d1d", "#7f1d1d", "#9a3412"]
    }
  }
];

export function getCardAppearanceVars({ reflection, darkness, tune }) {
  const safeReflection = clampPercent(reflection);
  const safeDarkness = clampPercent(darkness);
  const selectedTune = findTune(tune);

  return {
    "--card-reflection": (safeReflection / 100).toFixed(2),
    "--card-darkness": (safeDarkness / 100).toFixed(2),
    ...getTuneVars(selectedTune)
  };
}

function clampPercent(value) {
  const numericValue = Number.parseFloat(value);

  if (Number.isNaN(numericValue)) {
    return 0;
  }

  return Math.min(100, Math.max(0, numericValue));
}

function findTune(tuneId) {
  return cardColorTunes.find((tune) => tune.id === tuneId) ?? cardColorTunes[0];
}

function getTuneVars(tune) {
  return Object.entries(tune.colors).reduce((vars, [accent, colors]) => {
    colors.forEach((color, index) => {
      vars[`--accent-${accent}-${index + 1}`] = color;
    });

    return vars;
  }, {});
}
