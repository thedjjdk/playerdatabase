/* Shared scoring rules for player profiles and the Help page. */
window.PlayerDatabaseXp = (() => {
  'use strict';
  const geometryXp = new Map([
    ['easy', 2], ['normal', 4], ['hard', 8], ['harder', 15], ['insane', 25],
    ['easy-demon', 45], ['medium-demon', 80], ['hard-demon', 140], ['insane-demon', 250]
  ]);
  const celesteXp = new Map([
    ['blue', 5], ['green', 15], ['lime', 40], ['yellow', 100], ['orange', 240],
    ['red', 500], ['cracked', 900], ['shattered', 1500]
  ]);
  // Fixed reference ranks for confirmed Extreme Demons. Personal placement never affects XP.
  const extremeRanks = new Map([
    ['zodiac', 169], ['arctic lights', 320], ['spectrum cyclone', 326],
    ['storming summit', 329], ['generic wave', 427], ['chromatic haze', 448],
    ['catalyze', 465]
  ]);

  const fallback = 2;
  const firstLevelCost = 300;
  const levelStep = 75;
  const extremeTiers = [
    {label: 'Extreme Demon · Recorded AREDL ranks 1–250', maxRank: 250, xp: 1500},
    {label: 'Extreme Demon · Recorded AREDL ranks 251–500', maxRank: 500, xp: 900},
    {label: 'Other Extreme Demons', maxRank: Infinity, xp: 500}
  ];

  function beatSaberXp(grade) {
    return grade ? 5 + Math.round(995 * ((grade - 1) / 39) ** 3) : fallback;
  }

  function placementXp(game, rating, name) {
    if (game === 'geometry-dash') {
      if (rating !== 'extreme-demon') return geometryXp.get(rating) ?? fallback;
      const rank = extremeRanks.get(name) ?? Infinity;
      return extremeTiers.find(tier => rank <= tier.maxRank).xp;
    }
    if (game === 'celeste') return celesteXp.get(rating) ?? fallback;
    return beatSaberXp(rating);
  }

  function levelProgress(total) {
    const offset = 2 * firstLevelCost / levelStep - 1;
    const earned = Math.floor((Math.sqrt(offset ** 2 + 8 * total / levelStep) - offset) / 2);
    return {
      level: earned + 1,
      progress: total - (firstLevelCost * earned + levelStep * earned * (earned - 1) / 2),
      next: firstLevelCost + levelStep * earned
    };
  }

  return {geometryXp, celesteXp, extremeTiers, fallback, firstLevelCost, levelStep, beatSaberXp, placementXp, levelProgress};
})();
