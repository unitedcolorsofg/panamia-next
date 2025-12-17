import styles from './CallToActionBar.module.css';
import SignupModal from './SignupModal';
import { Button } from '@/components/ui/button';

export default function CallToActionBar() {
  const isProduction = process.env.NODE_ENV === 'production';

  return (
    <div className={styles.callToAction}>
      {isProduction ? (
        <>
          <span className="hidden-sm">Stay updated on PanaMia! &nbsp;</span>
          <SignupModal />
        </>
      ) : (
        <div className="-ml-40 flex flex-col items-start gap-2 sm:ml-0 sm:flex-row sm:items-center">
          <span className="text-lg font-bold">
            You are visiting a test site!
          </span>
          <Button
            variant="default"
            size="default"
            className="bg-gradient-to-r from-pink-500 to-purple-600 font-semibold text-white shadow-lg hover:from-pink-600 hover:to-purple-700"
            asChild
          >
            <a href="https://www.panamia.club">Visit Panamia Club</a>
          </Button>
        </div>
      )}
    </div>
  );
}
