import type { Die } from './dice';
import type { Rng } from './rng';

/**
 * Random entries for the table editor's Randomize buttons. Only flavour
 * dice have them; structural dice (see STRUCTURAL_DICE) drive the drawing.
 */
export const GENERATORS: Partial<Record<Die, readonly string[]>> = {
  D8: [
    'No Encounter - The room is quiet.',
    'Wandering Patrol - A few guards on their rounds.',
    'Lurking Predator - Something hunts from the shadows.',
    'Restless Dead - Spirits stir as you enter.',
    'Swarm - Vermin pour from the cracks.',
    'Rival Party - Another group of adventurers.',
    'Sleeping Beast - A large creature at rest.',
    'Captive - Someone pleads for rescue.',
    'Ambush - Hidden entities ready to strike.',
    'Merchant - A strange trader offers wares.',
    'Elite Threat - Dangerous entity, possibly guarding something.',
    'Construct - A mechanical guardian awakens.',
  ],
  D12: [
    'Dusty Chamber',
    'Hidden Alcove',
    'Grand Hall',
    'Dark Corridor',
    'Ancient Library',
    'Torture Chamber',
    'Treasury Room',
    'Guard Post',
    'Dining Hall',
    'Armory',
    'Sleeping Quarters',
    'Throne Room',
    'Temple Sanctuary',
    'Magic Workshop',
    'Prison Cell',
    'Storage Room',
    'War Room',
    'Council Chamber',
    'Training Area',
    'Secret Passage',
  ],
  D20: [
    'Filled with cobwebs',
    'Eerily silent',
    'Dimly lit',
    'Partially flooded',
    'Covered in moss',
    'Magically enhanced',
    'Structurally unstable',
    'Trapped',
    'Recently occupied',
    'Ancient and worn',
    'Mysteriously clean',
    'Haunted',
    'Decorated ornately',
    'Completely dark',
    'Well maintained',
    'Abandoned',
    'Under construction',
    'Heavily guarded',
    'Partially collapsed',
    'Magical',
  ],
};

export function canRandomize(die: Die): boolean {
  return GENERATORS[die] !== undefined;
}

export function randomEntry(die: Die, rng: Rng): string {
  const options = GENERATORS[die];
  if (!options) throw new Error(`${die} has no random entries`);
  return options[rng.int(0, options.length - 1)] ?? '';
}
