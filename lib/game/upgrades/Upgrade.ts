import type { Player } from '../entities/Player';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or simple text icon
  apply: (player: Player) => void;
}
