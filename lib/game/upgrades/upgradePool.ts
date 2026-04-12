import type { Upgrade } from './Upgrade';

export const ALL_UPGRADES: Upgrade[] = [
  {
    id: 'extra-heart',
    name: 'Extra Heart',
    description: '+1 max health, fully heals',
    icon: '+HP',
    apply: (player) => {
      player.maxHealth += 1;
      player.health = player.maxHealth;
    },
  },
  {
    id: 'speed-boost',
    name: 'Speed Boost',
    description: '+20% movement speed',
    icon: 'SPD',
    apply: (player) => {
      player.speed *= 1.2;
    },
  },
  {
    id: 'rapid-fire',
    name: 'Rapid Fire',
    description: '+25% fire rate',
    icon: 'RPD',
    apply: (player) => {
      player.fireRate *= 0.75;
    },
  },
  {
    id: 'damage-up',
    name: 'Damage Up',
    description: '+1 projectile damage',
    icon: 'DMG',
    apply: (player) => {
      player.damage += 1;
    },
  },
  {
    id: 'piercing-shot',
    name: 'Piercing Shot',
    description: 'Bullets pierce 1 extra enemy',
    icon: 'PRC',
    apply: (player) => {
      player.piercing += 1;
    },
  },
  {
    id: 'triple-shot',
    name: 'Triple Shot',
    description: 'Fire 3 bullets in a spread',
    icon: 'x3',
    apply: (player) => {
      player.bulletCount = Math.max(player.bulletCount, 3);
      player.bulletSpread = 0.15;
    },
  },
  {
    id: 'five-shot',
    name: 'Five Shot',
    description: 'Fire 5 bullets in a spread',
    icon: 'x5',
    apply: (player) => {
      player.bulletCount = Math.max(player.bulletCount, 5);
      player.bulletSpread = 0.12;
    },
  },
  {
    id: 'regeneration',
    name: 'Regeneration',
    description: 'Heal 1 HP now',
    icon: 'REG',
    apply: (player) => {
      player.heal(1);
    },
  },
];

// Get random upgrades (no duplicates)
export function getRandomUpgrades(count: number): Upgrade[] {
  const shuffled = [...ALL_UPGRADES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
