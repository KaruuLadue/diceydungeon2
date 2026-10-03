import { DICE } from './dice';
import type { EnabledDice } from './roll';

export interface Settings {
  highlightMatches: boolean;
  soundEnabled: boolean;
  showRoomMaps: boolean;
  enabledDice: EnabledDice;
}

export const DEFAULT_SETTINGS: Settings = {
  highlightMatches: true,
  soundEnabled: true,
  showRoomMaps: true,
  enabledDice: { D4: true, D6: true, D8: true, D10: true, D12: true, D20: true, D100: true },
};

/** Fill in anything missing or invalid from the defaults */
export function parseSettings(data: unknown): Settings {
  const settings = structuredClone(DEFAULT_SETTINGS);
  if (typeof data !== 'object' || data === null) return settings;
  const raw = data as Record<string, unknown>;
  for (const key of ['highlightMatches', 'soundEnabled', 'showRoomMaps'] as const) {
    if (typeof raw[key] === 'boolean') settings[key] = raw[key];
  }
  if (typeof raw.enabledDice === 'object' && raw.enabledDice !== null) {
    const dice = raw.enabledDice as Record<string, unknown>;
    for (const die of DICE) {
      if (typeof dice[die] === 'boolean') settings.enabledDice[die] = dice[die];
    }
  }
  return settings;
}
