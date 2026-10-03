import rollSoundUrl from '../assets/audio/rollsound.mp3';

let rollSound: HTMLAudioElement | null = null;

export function playRollSound(): void {
  rollSound ??= new Audio(rollSoundUrl);
  // Rewind so rapid rolls replay the sound instead of being ignored
  rollSound.currentTime = 0;
  rollSound.play().catch(() => {
    // Autoplay can be blocked; the roll still happens
  });
}
