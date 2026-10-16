/**
 * TEMPLE of Time - Chamber Definitions
 * Consolidated 5-Chamber Battery with clean, participant-friendly descriptions.
 */

import { ChamberDefinition } from './types';

export const CHAMBERS: ChamberDefinition[] = [
  {
    id: 'room-1',
    number: 1,
    name: 'The Weather Spire',
    subtitle: 'Simultaneity and temporal order judgement',
    timescale: '0 – 400 ms',
    paradigm: 'Simultaneity and temporal order judgement',
    description: 'Focus on the lightening flash and thunder tone and judge their order of appearance. Discover your ability to align light and sound.',
    scientificObjective: 'Align your senses to judge whether sound and light arrive simultaneously or in sequence.',
    instructions: [
      'Watch the screen for the flash of light and listen for the chime tone.',
      'Decide whether Sound arrived first, Light arrived first, or both occurred simultaneously.',
      'Use the response dial to register your decision and how confident you feel.'
    ],
    status: 'active',
    masteryThreshold: 75,
    iconName: 'zap'
  },
  {
    id: 'room-2',
    number: 2,
    name: 'The Grand Parlor',
    subtitle: 'Sense of Agency',
    timescale: '0 – 1400 ms',
    paradigm: 'Sense of Agency',
    description: 'Play this game of enchanted chess where sometimes you are in control of the board and other times you may not be the one controlling your pieces.',
    scientificObjective: 'Reflect upon your feeling of authorship when commanding movement across the board.',
    instructions: [
      'Choose your allegiance with the White Knight or Black Rook.',
      'Tap the piece on the checkered board to command its movement.',
      'Reflect on whether your touch guided the movement or if the board acted on its own.'
    ],
    status: 'active',
    masteryThreshold: 75,
    iconName: 'hourglass'
  },
  {
    id: 'room-3',
    number: 3,
    name: 'The Aviary',
    subtitle: 'Spontaneous tapping and temporal production',
    timescale: '300 ms – 3000 ms',
    paradigm: 'Spontaneous tapping and temporal production',
    description: 'Harvest grain to feed your magical pet. Start by harvesting at your own rhythm, then follow a steady 3-second rhythm.',
    scientificObjective: 'Follow your internal rhythm and produce steady time intervals.',
    instructions: [
      'Bond with your chosen avian familiar (Celestial Owl, Storm Raven, or Sun Hawk).',
      'Phase 1: Tap at your own steady, natural rhythm without counting.',
      'Phase 2: Tap to produce steady 3-second intervals to mature the grain.'
    ],
    status: 'active',
    masteryThreshold: 75,
    iconName: 'feather'
  },
  {
    id: 'room-4',
    number: 4,
    name: "The Puzzler's Study",
    subtitle: 'Multisource interference',
    timescale: '400 – 900 ms',
    paradigm: 'Multisource interference',
    description: 'Sit before the Altar of Triads to decipher ancient chronomantic runes. Three gemstone stones (1, 2, 3) anchor your focus while rapid triads of numbers appear.',
    scientificObjective: 'Identify the unique number among distractors swiftly and accurately.',
    instructions: [
      'Place your device in landscape mode flat on a surface.',
      'Rest 3 fingers of your dominant hand hovering above stones 1, 2, and 3.',
      'Identify the unique number in each triad and tap its matching stone.'
    ],
    status: 'active',
    masteryThreshold: 85,
    iconName: 'compass'
  },
  {
    id: 'room-5',
    number: 5,
    name: 'The Vault of Artifacts',
    subtitle: 'Delay discounting',
    timescale: '0 s – 60 s Real-Time Horizons',
    paradigm: 'Delay discounting',
    description: 'Send astral runners down pathways to retrieve sacred time-crystals and ancient coins. Greater rewards await those willing to wait for longer paths.',
    scientificObjective: 'Choose between immediate rewards and larger delayed treasures.',
    instructions: [
      'Select your runner to traverse the pathways.',
      'Choose between an immediate smaller reward or a grand vault after a brief wait.',
      'Watch your runner travel in real time to collect the coins into your vault.'
    ],
    status: 'active',
    masteryThreshold: 75,
    iconName: 'vault'
  }
];
