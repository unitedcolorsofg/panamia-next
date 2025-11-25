import Link from 'next/link';
import styles from './HeroBar.module.css';

import PanaButton from './PanaButton';

export default function HeroBar() {
  return (
    <div className={styles.heroBar}>
      <Link legacyBehavior href="">
        <PanaButton text="Events" color="yellow"></PanaButton>
      </Link>
      <Link legacyBehavior href="/podcasts">
        <PanaButton text="Podcasts" color="yellow"></PanaButton>
      </Link>
    </div>
  );
}
