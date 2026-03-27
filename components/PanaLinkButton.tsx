import styles from './PanaLinkButton.module.css';

interface PanaLinkButtonProps extends React.HTMLProps<HTMLButtonElement> {
  children?: React.ReactNode;
}

export default function PanaLinkButton(props: PanaLinkButtonProps) {
  return <button className={styles.linkButton}> {props.children} </button>;
}
