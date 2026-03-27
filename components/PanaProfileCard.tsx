import Link from 'next/link';
import styles from './PanaProfileCard.module.css';

interface ProfileCardProps {
  name: string;
  url: string;
  image: string;
}

export default function PanaProfileCard({
  name,
  url,
  image,
}: ProfileCardProps) {
  return (
    <div className={styles.profileCardBlock}>
      <Link href={url} className={styles.imageLink}>
        <img className={styles.image} src={image} alt={name} />
      </Link>
      <Link href={url} className={styles.name}>
        {name}
      </Link>
    </div>
  );
}
