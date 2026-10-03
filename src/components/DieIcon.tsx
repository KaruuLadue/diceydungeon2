import type { Die } from '../core/dice';

const icons = import.meta.glob<string>('../assets/dice/*.png', {
  eager: true,
  import: 'default',
});

export function DieIcon({ die }: { die: Die }) {
  return <img src={icons[`../assets/dice/${die}.png`]} alt="" className="die-icon" />;
}
