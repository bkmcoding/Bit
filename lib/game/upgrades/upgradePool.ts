import type { Upgrade } from './Upgrade';

/**
 * Single-projectile only (no multishot). Archetypes: sustain, mitigation (flat + i-frames),
 * crits, size, frenzy, tradeoffs. Avoid "% less damage taken" as the only hook — with 1–2 dmg
 * hits and few hearts, flat mitigation and invuln read clearly.
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
    description: 'Move ~7 px/s faster. Fear makes you fast.',
    icon: '⋯',
    apply: (player) => {
      player.speed *= 1.12;
    },
  },
  {
    id: 'adrenal-gland',
    name: 'Adrenal Gland',
    description: 'Shots come ~15% sooner. A twitchy trigger.',
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
    description: '+1 max HP and full heal, but −10% move speed.',
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
    description: 'Shots ~8% sooner. Numb fingers squeeze.',
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
    description: 'A little quicker on your feet; heal 1 if below max.',
    icon: '~',
    apply: (player) => {
      player.speed *= 1.08;
      if (player.health < player.maxHealth) player.heal(1);
    },
  },
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
    description: 'Enemy hits deal 1 less to you (still at least 1 per hit).',
    icon: '⎔',
    apply: (player) => {
      player.flatDamageMitigation += 1;
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
    description: 'Below half health: noticeably faster movement.',
    icon: '⌁',
    apply: (player) => {
      player.lowHpSpeedMult = Math.max(player.lowHpSpeedMult, 1.14);
    },
  },
  {
    id: 'last-leg',
    name: 'Last Leg',
    description: 'At 1 heart: surge of speed.',
    icon: '╱',
    apply: (player) => {
      player.lastLegSpeedMult = Math.max(player.lastLegSpeedMult, 1.22);
    },
  },
  {
    id: 'parasite-bond',
    name: 'Parasite Bond',
    description: '+1 max HP and full heal; shorter grace after hits (−0.2s i-frames).',
    icon: '⌬',
    apply: (player) => {
      player.maxHealth += 1;
      player.health = player.maxHealth;
      player.hitInvulnBonus -= 0.2;
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
    description: '+0.25s invulnerability after hits; move ~4% slower.',
    icon: '☍',
    apply: (player) => {
      player.hitInvulnBonus += 0.25;
      player.speed *= 0.96;
    },
  },
  {
    id: 'spinal-thread',
    name: 'Spinal Thread',
    description: '+1 pierce; your silhouette swells (easier for foes to graze you).',
    icon: '⌇',
    apply: (player) => {
      player.piercing += 1;
      player.size = Math.min(14, Math.ceil(player.size * 1.12));
    },
  },
  // —— More picks: double-edged and situational ——
  {
    id: 'greedsprout',
    name: 'Greedsprout',
    description: '+2 damage; −1 max HP (min 1).',
    icon: '☠',
    apply: (player) => {
      player.damage += 2;
      player.maxHealth = Math.max(1, player.maxHealth - 1);
      player.health = Math.min(player.health, player.maxHealth);
    },
  },
  {
    id: 'nerve-stitch',
    name: 'Nerve Stitch',
    description: '+0.35s invuln after hits; shots travel ~8% slower.',
    icon: '⌿',
    apply: (player) => {
      player.hitInvulnBonus += 0.35;
      player.projectileSpeedMult *= 0.92;
    },
  },
  {
    id: 'cinder-lace',
    name: 'Cinder Lace',
    description: '+12% projectile speed; −0.15s invuln after hits.',
    icon: '⌗',
    apply: (player) => {
      player.projectileSpeedMult *= 1.12;
      player.hitInvulnBonus -= 0.15;
    },
  },
  {
    id: 'hollow-pact',
    name: 'Hollow Pact',
    description: '+1 pierce; −1 max HP (min 1).',
    icon: '⍟',
    apply: (player) => {
      player.piercing += 1;
      player.maxHealth = Math.max(1, player.maxHealth - 1);
      player.health = Math.min(player.health, player.maxHealth);
    },
  },
  {
    id: 'luck-tooth',
    name: 'Luck Tooth',
    description: '+12% crit chance; move ~5% slower.',
    icon: '☘',
    apply: (player) => {
      player.critChance = Math.min(0.85, player.critChance + 0.12);
      player.critDamageMult = Math.max(player.critDamageMult, 2);
      player.speed *= 0.95;
    },
  },
  {
    id: 'bloom-rot',
    name: 'Bloom Rot',
    description: 'Heal 1; you grow slightly easier to hit.',
    icon: '❀',
    apply: (player) => {
      player.heal(1);
      player.size = Math.min(14, Math.ceil(player.size * 1.1));
    },
  },
  {
    id: 'salt-ledger',
    name: 'Salt Ledger',
    description: 'Every 4th kill restores 1 HP (stacks extra healing if you already tally kills).',
    icon: '⊞',
    apply: (player) => {
      if (!player.everyNthKillHeal) player.everyNthKillHeal = { n: 4, amount: 1 };
      else player.everyNthKillHeal.amount += 1;
    },
  },
  {
    id: 'ribbon-gnaw',
    name: 'Ribbon Gnaw',
    description: '+20% kill-heal odds; −1 damage (min 1).',
    icon: '✶',
    apply: (player) => {
      player.killHealChance = Math.min(0.95, player.killHealChance + 0.2);
      player.damage = Math.max(1, player.damage - 1);
    },
  },
  {
    id: 'salt-rind',
    name: 'Salt Rind',
    description: '+1 damage; lose 1 pierce (if you have any).',
    icon: '⊣',
    apply: (player) => {
      player.damage += 1;
      if (player.piercing > 0) player.piercing -= 1;
    },
  },
  {
    id: 'moth-dust',
    name: 'Moth Dust',
    description: '+3 projectile size; move ~6% slower.',
    icon: '✧',
    apply: (player) => {
      player.projectileSizeBonus += 3;
      player.speed *= 0.94;
    },
  },
  {
    id: 'glass-needle',
    name: 'Glass Needle',
    description: '+20% shot speed; −0.12s invuln after hits.',
    icon: '⋄',
    apply: (player) => {
      player.projectileSpeedMult *= 1.2;
      player.hitInvulnBonus -= 0.12;
    },
  },
  {
    id: 'turn-coil',
    name: 'Turn Coil',
    description: 'Stronger low-HP speed boost; −1 max HP (min 1).',
    icon: '⌭',
    apply: (player) => {
      player.lowHpSpeedMult = Math.max(player.lowHpSpeedMult, 1.2);
      player.maxHealth = Math.max(1, player.maxHealth - 1);
      player.health = Math.min(player.health, player.maxHealth);
    },
  },
  {
    id: 'tar-pith',
    name: 'Tar Pith',
    description: 'Enemy hits deal 1 less (min 1); −8% move speed.',
    icon: '⬡',
    apply: (player) => {
      player.flatDamageMitigation += 1;
      player.speed *= 0.92;
    },
  },
  {
    id: 'frayed-crown',
    name: 'Frayed Crown',
    description: 'Longer kill-frenzy (+0.4s); slightly slower baseline fire.',
    icon: '♔',
    apply: (player) => {
      player.frenzyOnKillDuration += 0.4;
      player.frenzyFireRateMult = Math.min(player.frenzyFireRateMult, 0.85);
      player.fireRate *= 1.05;
    },
  },
  {
    id: 'wick-thread',
    name: 'Wick Thread',
    description: '+1 hollow needle pierce; projectiles ~5% slower.',
    icon: '╎',
    apply: (player) => {
      player.piercing += 1;
      player.projectileSpeedMult *= 0.95;
    },
  },
  {
    id: 'rust-calm',
    name: 'Rust Calm',
    description: '+0.18s invuln; projectiles slightly smaller (−1 size).',
    icon: '◌',
    apply: (player) => {
      player.hitInvulnBonus += 0.18;
      player.projectileSizeBonus -= 1;
    },
  },
  {
    id: 'gutter-faith',
    name: 'Gutter Faith',
    description: 'Heal 1; each hit hurts for +1 more (after mitigation).',
    icon: '☽',
    apply: (player) => {
      player.heal(1);
      player.flatDamagePenalty += 1;
    },
  },
  {
    id: 'black-wax',
    name: 'Black Wax',
    description: '+1 max HP & full heal; +1 damage taken per hit (still at least 1 base).',
    icon: '⬮',
    apply: (player) => {
      player.maxHealth += 1;
      player.health = player.maxHealth;
      player.flatDamagePenalty += 1;
    },
  },
  {
    id: 'thin-saint',
    name: 'Thin Saint',
    description: 'Smaller hitbox; −1 max HP (min 1).',
    icon: '✟',
    apply: (player) => {
      player.size = Math.max(6, Math.floor(player.size * 0.9));
      player.maxHealth = Math.max(1, player.maxHealth - 1);
      player.health = Math.min(player.health, player.maxHealth);
    },
  },
  {
    id: 'crow-count',
    name: 'Crow Count',
    description: 'Every 6th kill heals 2 HP.',
    icon: '⧫',
    apply: (player) => {
      if (!player.everyNthKillHeal) player.everyNthKillHeal = { n: 6, amount: 2 };
      else player.everyNthKillHeal.amount += 1;
    },
  },
];

export function getRandomUpgrades(count: number): Upgrade[] {
  const shuffled = [...ALL_UPGRADES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
