import Link from 'next/link';
import styles from './AdminButton.module.css';

interface AdminButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  submit?: boolean;
  href?: string;
  disabled?: boolean;
}

export default function AdminButton({
  children,
  onClick,
  submit,
  href,
  disabled,
}: AdminButtonProps) {
  function handleClick() {
    if (onClick) {
      onClick();
    }
  }
  if (href) {
    return (
      <Link href={href}>
        {/* @next-codemod-error This Link previously used the now removed `legacyBehavior` prop, and has a child that might not be an anchor. The codemod bailed out of lifting the child props to the Link. Check that the child component does not render an anchor, and potentially move the props manually to Link. */}
        <button
          className={styles.adminButton}
          disabled={disabled ? true : false}
          onClick={handleClick}
        >
          {children}
        </button>
      </Link>
    );
  }
  return (
    <button
      className={styles.adminButton}
      type={submit ? 'submit' : 'button'}
      disabled={disabled ? true : false}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
