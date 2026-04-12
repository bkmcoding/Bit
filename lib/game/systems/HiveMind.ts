import { Vector2 } from '../utils/Vector2';
import { HIVE_MIND_HARD } from '../utils/constants';

export type HiveRole = 'chase' | 'kite' | 'wander';

export interface HiveMindSteerInput {
  slotIndex: number;
  slotCount: number;
  playerPos: Vector2;
  playerVel: Vector2;
  enemyPos: Vector2;
  role: HiveRole;
  /** For `kite`, orbit at roughly this radius from the predicted player. */
  kiteRadius?: number;
}

/**
 * Unit direction toward a slot on a ring around the player.
 * Ring center is the real player position for chase/wander (velocity prediction made
 * circular strafing a synchronized “dance”). No rotating slots — angles are fixed per
 * enemy index so the group spreads bearings without orbiting a moving target.
 */
export function hiveMindSteerUnit(input: HiveMindSteerInput): Vector2 | null {
  const n = Math.max(1, input.slotCount);
  const i = ((input.slotIndex % n) + n) % n;

  const playerSpeed = input.playerVel.magnitude();
  const moveT = Math.min(1, playerSpeed / HIVE_MIND_HARD.SPIN_RAMP_SPEED);
  const theta = (Math.PI * 2 * i) / n;

  let ring: number;
  if (input.role === 'kite') {
    const base = Math.max(
      HIVE_MIND_HARD.RING_CHASE + 8,
      input.kiteRadius ?? HIVE_MIND_HARD.RING_WANDER
    );
    ring = base * (0.88 + 0.12 * moveT);
  } else if (input.role === 'wander') {
    ring = HIVE_MIND_HARD.RING_WANDER * (0.9 + 0.1 * moveT);
  } else {
    ring =
      HIVE_MIND_HARD.RING_CHASE_CLOSE +
      (HIVE_MIND_HARD.RING_CHASE - HIVE_MIND_HARD.RING_CHASE_CLOSE) * moveT;
  }

  const focus =
    input.role === 'kite'
      ? input.playerPos.add(input.playerVel.mul(HIVE_MIND_HARD.KITE_PREDICT_SEC))
      : input.playerPos;

  const slot = new Vector2(Math.cos(theta), Math.sin(theta)).mul(ring);
  const target = focus.add(slot);
  const to = target.sub(input.enemyPos);
  const mag = to.magnitude();
  if (mag < 0.5) return null;
  return to.div(mag);
}
