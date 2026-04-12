import type { Upgrade } from './Upgrade';

/**
 * Single-projectile only (no multishot cards). Archetypes: sustain on kills, mitigation,
 * crits, size, frenzy, speed thresholds, tradeoffs.
 */
export const ALL_UPGRADES: Upgrade[] = [
  {
    id: 'gristly-heart',
    name: 'Gristly Heart',
    description: '+1 max life. Flesh knits shut.',
    icon: '♥',
    apply: (player) => {
      player.maxHealth += 1;
      player.health = player.maxHealth;
    },
  },
  {
    id: 'panic-scuttle',
    name: 'Panic Scuttle',
    description: '+12% move speed. Fear makes you fast.',
    icon: '⋯',
    apply: (player) => {
      player.speed *= 1.12;
    },
  },
  {
    id: 'adrenal-gland',
    name: 'Adrenal Gland',
    description: 'Shoot ~15% faster. A twitchy trigger.',
    icon: '†',
    apply: (player) => {
      player.fireRate *= 0.85;
    },
  },
  {
    id: 'barbed-stinger',
    name: 'Barbed Stinger',
    description: '+1 damage. Each shot tears deeper.',
    icon: '▲',
    apply: (player) => {
      player.damage += 1;
    },
  },
  {
    id: 'hollow-needle',
    name: 'Hollow Needle',
    description: 'Projectiles pierce 1 more foe.',
    icon: '│',
    apply: (player) => {
      player.piercing += 1;
    },
  },
  {
    id: 'clotting',
    name: 'Clotting',
    description: 'Heal 1 HP. The wound seals.',
    icon: '◎',
    apply: (player) => {
      player.heal(1);
    },
  },
  {
    id: 'blood-meal',
    name: 'Blood Meal',
    description: 'Heal 2 HP. You feed.',
    icon: '◉',
    apply: (player) => {
      player.heal(2);
    },
  },
  {
    id: 'glass-carapace',
    name: 'Glass Carapace',
    description: '+0.35s invulnerability after each hit.',
    icon: '◇',
    apply: (player) => {
      player.hitInvulnBonus += 0.35;
    },
  },
  {
    id: 'shrinking-molt',
    name: 'Shrinking Molt',
    description: 'Slightly smaller — harder to catch.',
    icon: '○',
    apply: (player) => {
      player.size = Math.max(6, Math.floor(player.size * 0.88));
    },
  },
  {
    id: 'spiders-bargain',
    name: "Spider's Bargain",
    description: '+1 max HP and full heal, but −10% speed.',
    icon: '⚖',
    apply: (player) => {
      player.maxHealth += 1;
      player.health = player.maxHealth;
      player.speed *= 0.9;
    },
  },
  {
    id: 'ichor-haste',
    name: 'Ichor Haste',
    description: 'Projectiles travel ~10% faster.',
    icon: '»',
    apply: (player) => {
      player.projectileSpeedMult *= 1.1;
    },
  },
  {
    id: 'dread-numb',
    name: 'Dread Numb',
    description: 'Shoot ~8% faster. Numb fingers squeeze.',
    icon: '∴',
    apply: (player) => {
      player.fireRate *= 0.92;
    },
  },
  {
    id: 'brittle-fang',
    name: 'Brittle Fang',
    description: '+1 damage but −6% projectile speed.',
    icon: '!',
    apply: (player) => {
      player.damage += 1;
      player.projectileSpeedMult *= 0.94;
    },
  },
  {
    id: 'second-wind',
    name: 'Second Wind',
    description: '+8% speed and heal 1 if below max.',
    icon: '~',
    apply: (player) => {
      player.speed *= 1.08;
      if (player.health < player.maxHealth) player.heal(1);
    },
  },
  // —— New archetypes (no multishot) ——
  {
    id: 'carrion-crumb',
    name: 'Carrion Crumb',
    description: '30% chance to heal 1 HP when something dies.',
    icon: '⁂',
    apply: (player) => {
      player.killHealChance = Math.min(0.95, player.killHealChance + 0.3);
    },
  },
  {
    id: 'chitin-plates',
    name: 'Chitin Plates',
    description: 'Hits sting ~12% less.',
    icon: '⎔',
    apply: (player) => {
      player.damageTakenMult *= 0.88;
    },
  },
  {
    id: 'jagged-odds',
    name: 'Jagged Odds',
    description: '~18% chance for double damage on hit.',
    icon: '✦',
    apply: (player) => {
      player.critChance = Math.min(0.85, player.critChance + 0.18);
      player.critDamageMult = Math.max(player.critDamageMult, 2);
    },
  },
  {
    id: 'thick-ichor-shot',
    name: 'Thick Ichor',
    description: 'Heavier droplets — larger hit area.',
    icon: '●',
    apply: (player) => {
      player.projectileSizeBonus += 2;
    },
  },
  {
    id: 'ritual-tally',
    name: 'Ritual Tally',
    description: 'Every 5th kill restores 1 HP.',
    icon: '卌',
    apply: (player) => {
      if (!player.everyNthKillHeal) player.everyNthKillHeal = { n: 5, amount: 1 };
      else player.everyNthKillHeal.amount += 1;
    },
  },
  {
    id: 'blood-frenzy',
    name: 'Blood Frenzy',
    description: 'On kill: ~1.25s of faster shooting.',
    icon: '⚡',
    apply: (player) => {
      player.frenzyOnKillDuration = Math.max(player.frenzyOnKillDuration, 1.25);
      player.frenzyFireRateMult = Math.min(player.frenzyFireRateMult, 0.78);
    },
  },
  {
    id: 'desperate-scramble',
    name: 'Desperate Scramble',
    description: 'Below half health: +14% move speed.',
    icon: '⌁',
    apply: (player) => {
      player.lowHpSpeedMult = Math.max(player.lowHpSpeedMult, 1.14);
    },
  },
  {
    id: 'last-leg',
    name: 'Last Leg',
    description: 'At 1 heart: +22% move speed.',
    icon: '╱',
    apply: (player) => {
      player.lastLegSpeedMult = Math.max(player.lastLegSpeedMult, 1.22);
    },
  },
  {
    id: 'parasite-bond',
    name: 'Parasite Bond',
    description: '+1 max HP, full heal, but you take +8% damage.',
    icon: '⌬',
    apply: (player) => {
      player.maxHealth += 1;
      player.health = player.maxHealth;
      player.damageTakenMult *= 1.08;
    },
  },
  {
    id: 'starved-barrel',
    name: 'Starved Barrel',
    description: '+18% shot speed, −1 max HP (min 1).',
    icon: '⌐',
    apply: (player) => {
      player.projectileSpeedMult *= 1.18;
      player.maxHealth = Math.max(1, player.maxHealth - 1);
      player.health = Math.min(player.health, player.maxHealth);
    },
  },
  {
    id: 'grave-calm',
    name: 'Grave Calm',
    description: 'Take 6% less damage; move 4% slower.',
    icon: '☍',
    apply: (player) => {
      player.damageTakenMult *= 0.94;
      player.speed *= 0.96;
    },
  },
  {
    id: 'spinal-thread',
    name: 'Spinal Thread',
    description: '+1 pierce, but you take +6% damage.',
    icon: '⌇',
    apply: (player) => {
      player.piercing += 1;
      player.damageTakenMult *= 1.06;
    },
  },
];

export function getRandomUpgrades(count: number): Upgrade[] {
  const shuffled = [...ALL_UPGRADES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
