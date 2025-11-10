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

export const VALUE_CALCULATION_EXPLANATION = `Values are calculated from your match performance data and scaled relatively. The highest value in each period is set to 100, with others shown proportionally. This means your dominant playstyle trait becomes 100, and others are shown relative to it. Different periods may have different dominant values as your playstyle evolves.`;
