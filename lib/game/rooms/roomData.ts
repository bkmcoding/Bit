import type { RoomThemeId } from '../utils/constants';
import type { RoomBlueprint } from './proceduralRoomLayout';
import { buildRoomConfigsFromBlueprints } from './proceduralRoomLayout';
import type { RoomConfig } from './Room';
import { buildLinearRunDoorLayout, type MinimapLayout } from './runDoorLayout';

export type { MinimapLayout };

const themes: RoomThemeId[] = ['cellar', 'moss', 'ash', 'deep', 'rust'];
const themeFor = (id: number): RoomThemeId => themes[id % themes.length];

/** Authoring: enemy composition + theme (doors + layout come from the run seed). */
export const ROOM_BLUEPRINT_BASE = [
  {
    id: 0,
    theme: 'cellar' as const,
    enemies: [] as RoomBlueprint['enemies'],
  },
  { id: 1, theme: themeFor(1), enemies: ['spider', 'spider', 'spider'] },
  { id: 2, theme: themeFor(2), enemies: ['spider', 'spider', 'spider', 'skitter'] },
  { id: 3, theme: themeFor(3), enemies: ['spitter', 'spitter', 'spider'] },
  { id: 4, theme: themeFor(4), enemies: ['dasher', 'dasher', 'spider', 'spider'] },
  { id: 5, theme: themeFor(5), enemies: ['skitter', 'skitter', 'spider', 'spitter'] },
  { id: 6, theme: themeFor(6), enemies: ['webspinner', 'spider', 'spider', 'skitter'] },
  { id: 7, theme: themeFor(7), enemies: ['brute', 'spider', 'spider', 'skitter'] },
  { id: 8, theme: themeFor(8), enemies: ['spitter', 'spitter', 'dasher', 'dasher', 'widow'] },
  { id: 9, theme: themeFor(9), enemies: ['widow', 'widow', 'webspinner', 'spider'] },
  { id: 10, theme: themeFor(10), enemies: ['brute', 'skitter', 'skitter', 'spitter', 'spitter', 'dasher'] },
  {
    id: 11,
    theme: 'deep' as const,
    isBossRoom: true as const,
    enemies: ['broodmother'] as const,
  },
] as const;

export const ROOM_COUNT = ROOM_BLUEPRINT_BASE.length;

export type RunRoomBuild = {
  configs: RoomConfig[];
  connections: Map<number, Map<string, number>>;
  minimap: MinimapLayout;
};

/** Full room list + door graph + radar layout for one playthrough. */
export function buildRunRooms(runSeed: number): RunRoomBuild {
  const { connections, roomDoors, minimap } = buildLinearRunDoorLayout(ROOM_COUNT, runSeed);

  const blueprints: RoomBlueprint[] = ROOM_BLUEPRINT_BASE.map((b) => {
    const doors = roomDoors.get(b.id);
    if (!doors || doors.length === 0) {
      throw new Error(`[roomData] missing doors for room ${b.id}`);
    }
    return {
      id: b.id,
      doors,
      theme: b.theme,
      isBossRoom: 'isBossRoom' in b && b.isBossRoom ? true : undefined,
      enemies: [...b.enemies],
    };
  });

  const configs = buildRoomConfigsFromBlueprints(blueprints, runSeed);
  return { configs, connections, minimap };
}
