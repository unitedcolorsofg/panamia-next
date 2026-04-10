import Link from 'next/link';
import styles from './HeroBar.module.css';

import PanaButton from './PanaButton';

export default function HeroBar() {
  return (
    <div className={styles.heroBar}>
      <Link href="">
        {/* @next-codemod-error This Link previously used the now removed `legacyBehavior` prop, and has a child that might not be an anchor. The codemod bailed out of lifting the child props to the Link. Check that the child component does not render an anchor, and potentially move the props manually to Link. */}
        <PanaButton text="Events" color="yellow"></PanaButton>
      </Link>
      <Link href="/podcasts">
        {/* @next-codemod-error This Link previously used the now removed `legacyBehavior` prop, and has a child that might not be an anchor. The codemod bailed out of lifting the child props to the Link. Check that the child component does not render an anchor, and potentially move the props manually to Link. */}
        <PanaButton text="Podcasts" color="yellow"></PanaButton>
      </Link>
    </div>
  );
}
