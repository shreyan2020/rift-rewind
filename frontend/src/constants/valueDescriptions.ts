export const VALUE_DESCRIPTIONS: Record<string, string> = {
  'Achievement': 'First bloods, killing sprees, team damage %, high KDA. Your drive for competitive success.',
  'Benevolence': 'Kill participation, vision score, wards placed, assists. Your team-oriented support play.',
  'Conformity': 'Stealth wards, ward guarding, avoiding deaths. Following team strategies and safe play.',
  'Hedonism': 'Fountain kills, minion clears, blast cone tricks. Your playful, fun-focused actions.',
  'Power': 'Gold/min, damage dealt, damage mitigated. Your dominance and resource control.',
  'Security': 'Vision control, ward clearing, damage mitigation, turret kills. Your defensive, cautious positioning.',
  'Self-Direction': 'Solo kills, unique combos, gold spending efficiency. Your independent decision-making.',
  'Stimulation': 'Bounty gold, epic steals, kills near turrets, deaths. Your aggressive, high-action plays.',
  'Tradition': 'CS/min, early CS, longest life. Your adherence to standard farming and classic strategies.',
  'Universalism': 'Champion pool diversity, role flexibility. Your balanced, adaptable playstyle.',
};

export const VALUE_CALCULATION_EXPLANATION = `
Playstyle values are calculated through a three-step process:

1. Feature Extraction: Your in-game behaviors (kills, assists, vision, CS, etc.) are extracted from each match
2. Weighted Scoring: Features are combined with weights specific to each value (e.g., gold/min → Power, assists → Benevolence)
3. Z-Score Normalization: Each value is normalized independently across your games to ensure fair ranking

Your top 3 values are determined by which behaviors you expressed most consistently and strongly relative to your own baseline—not by absolute numbers. This ensures that all 10 values have equal opportunity to rank highly based on how prominently you exhibit each playstyle pattern.

The scores shown are the raw aggregated values (not z-scores) so you can compare with friends who upload their journeys!
`.trim();
