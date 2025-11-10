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

export const VALUE_CALCULATION_EXPLANATION = `Values are calculated as raw scores from your match performance data - weighted combinations of your in-game behaviors like gold earned, damage dealt, vision control, and teamwork. Higher scores indicate stronger expression of that behavioral trait. Different values naturally have different scales (e.g., Power uses gold amounts ~2000-5000, while Conformity uses ward counts ~-2 to +2), making direct comparisons meaningful when looking at relative patterns over time.`;
