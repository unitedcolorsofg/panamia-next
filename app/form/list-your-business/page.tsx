'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { useTurnstile } from '@/components/Turnstile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Send, Shield, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

/**
 * Public business intake. No auth gate on purpose — see the rationale in
 * app/api/listings/intake/route.ts. A business can get into the directory
 * before it has an account, and claims the listing afterwards.
 *
 * Kept to a single page. The seven-page /form/become-a-pana flow is where the
 * full profile gets filled in, once someone has already committed.
 */
function ListYourBusinessForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [fiveWords, setFiveWords] = useState('');
  const [instagram, setInstagram] = useState('');
  const [website, setWebsite] = useState('');
  const [details, setDetails] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const {
    token: turnstileToken,
    error: turnstileError,
    reset: resetTurnstile,
    Widget: TurnstileWidget,
  } = useTurnstile(turnstileSiteKey, 'business_intake_submit');

  const { toast } = useToast();
  const { t } = useTranslation('listBusiness');
  const { t: tToast } = useTranslation('toast');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!turnstileToken) {
      toast({
        variant: 'destructive',
        title: tToast('securityError'),
        description: tToast('turnstileNotReady'),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Read the server's message on 4xx rather than letting axios throw it
      // away — the validation and duplicate-listing copy is worth showing.
      const response = await axios.post(
        '/api/listings/intake',
        {
          name,
          email,
          fiveWords,
          instagram,
          website,
          details,
          phoneNumber,
          turnstileToken,
        },
        { validateStatus: () => true }
      );

      if (response.data?.success) {
        setSubmittedEmail(email);
        return;
      }

      resetTurnstile();
      toast({
        variant: 'destructive',
        title: tToast('submissionFailed'),
        description: response.data?.error || tToast('submissionErrorGeneral'),
      });
    } catch {
      resetTurnstile();
      toast({
        variant: 'destructive',
        title: tToast('submissionError'),
        description: tToast('submissionErrorGeneral'),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setName('');
    setEmail('');
    setFiveWords('');
    setInstagram('');
    setWebsite('');
    setDetails('');
    setPhoneNumber('');
    setSubmittedEmail('');
    resetTurnstile();
  }

  if (submittedEmail) {
    return (
      <div className="auth-surface flex flex-col items-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-2xl space-y-6">
          <Card className="border-pana-ink/10 rounded-2xl shadow-xl dark:border-white/10">
            <CardContent className="space-y-6 p-8 text-center">
              <CheckCircle2
                className="text-pana-burnt dark:text-pana-flame mx-auto h-14 w-14"
                aria-hidden="true"
              />
              <div className="space-y-2">
                <h1 className="text-foreground text-3xl font-black tracking-tight">
                  {t('successTitle')}
                </h1>
                <p className="text-pana-ink/75 dark:text-muted-foreground text-lg">
                  {t('successBody', { email: submittedEmail })}
                </p>
              </div>

              <div className="bg-pana-butter-2/60 dark:bg-muted rounded-xl p-6 text-left">
                <h2 className="mb-3 font-extrabold">{t('successNextTitle')}</h2>
                <ol className="text-pana-ink/75 dark:text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
                  <li>{t('successNext1')}</li>
                  <li>{t('successNext2')}</li>
                  <li>{t('successNext3')}</li>
                </ol>
              </div>

              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button variant="outline" onClick={resetForm}>
                  {t('successAnother')}
                </Button>
                <Button
                  asChild
                  className="bg-pana-flame text-pana-ink hover:bg-pana-burnt font-extrabold"
                >
                  <Link href="/">{t('successHome')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-surface flex flex-col items-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center space-y-3 text-center">
          <span className="section-eyebrow">{t('eyebrow')}</span>
          <h1 className="text-foreground flex items-center justify-center gap-3 text-4xl font-black tracking-tight">
            <Store
              className="text-pana-burnt dark:text-pana-flame h-8 w-8"
              aria-hidden="true"
            />
            {t('title')}
          </h1>
          <div className="text-pana-ink/75 dark:text-muted-foreground space-y-2 text-lg">
            <p>{t('intro1')}</p>
            <p>{t('intro2')}</p>
          </div>
        </div>

        {/* How it works */}
        <Card className="border-pana-ink/10 rounded-2xl shadow-xl dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-xl font-black tracking-tight">
              {t('howItWorks')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {[
                { title: t('step1Title'), body: t('step1Body') },
                { title: t('step2Title'), body: t('step2Body') },
                { title: t('step3Title'), body: t('step3Body') },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="bg-pana-flame text-pana-ink flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-bold">{step.title}</p>
                    <p className="text-pana-ink/70 dark:text-muted-foreground text-sm">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Form */}
        <Card className="border-pana-ink/10 rounded-2xl shadow-xl dark:border-white/10">
          <CardHeader>
            <CardTitle className="font-black tracking-tight">
              {t('formTitle')}
            </CardTitle>
            <CardDescription>{t('formDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="business-name">
                  {t('nameLabel')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="business-name"
                  name="name"
                  type="text"
                  maxLength={100}
                  required
                  placeholder={t('namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business-email">
                  {t('emailLabel')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="business-email"
                  name="email"
                  type="email"
                  maxLength={100}
                  required
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
                <p className="text-muted-foreground text-sm">
                  {t('emailNote')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business-five-words">
                  {t('fiveWordsLabel')}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="business-five-words"
                  name="fiveWords"
                  type="text"
                  maxLength={120}
                  required
                  placeholder={t('fiveWordsPlaceholder')}
                  value={fiveWords}
                  onChange={(e) => setFiveWords(e.target.value)}
                  disabled={isSubmitting}
                />
                <p className="text-muted-foreground text-sm">
                  {t('fiveWordsNote')}
                </p>
              </div>

              {/* At least one link — the server enforces this too. */}
              <fieldset className="space-y-4">
                <legend className="text-sm font-medium">
                  {t('linksTitle')} <span className="text-destructive">*</span>
                </legend>
                <p className="text-muted-foreground -mt-2 text-sm">
                  {t('linksNote')}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="business-instagram">
                    {t('instagramLabel')}
                  </Label>
                  <Input
                    id="business-instagram"
                    name="instagram"
                    type="text"
                    maxLength={100}
                    placeholder={t('instagramPlaceholder')}
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-website">{t('websiteLabel')}</Label>
                  <Input
                    id="business-website"
                    name="website"
                    type="text"
                    maxLength={200}
                    placeholder={t('websitePlaceholder')}
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="business-details">{t('detailsLabel')}</Label>
                <Textarea
                  id="business-details"
                  name="details"
                  maxLength={1000}
                  rows={4}
                  placeholder={t('detailsPlaceholder')}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business-phone">{t('phoneLabel')}</Label>
                <Input
                  id="business-phone"
                  name="phoneNumber"
                  type="tel"
                  maxLength={30}
                  placeholder={t('phonePlaceholder')}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={isSubmitting}
                />
                <p className="text-muted-foreground text-sm">
                  {t('phoneNote')}
                </p>
              </div>

              {/* Required for everyone — this endpoint has no session to lean
                  on, so the server verifies the token unconditionally. */}
              <div className="space-y-3">
                {TurnstileWidget}
                {turnstileError && (
                  <p className="text-sm text-red-600">
                    {t('turnstileBlocked')}
                  </p>
                )}
                <div className="bg-pana-butter-2/60 text-pana-ink/75 dark:bg-muted dark:text-muted-foreground flex items-center gap-2 rounded-md p-3 text-sm">
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  <span>{t('turnstileNote')}</span>
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  type="submit"
                  size="lg"
                  className="bg-pana-flame text-pana-ink hover:bg-pana-burnt w-full font-extrabold md:w-auto"
                  disabled={
                    isSubmitting || (!!turnstileSiteKey && !turnstileToken)
                  }
                >
                  {isSubmitting ? (
                    t('sending')
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" aria-hidden="true" />
                      {t('submitButton')}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-pana-ink/75 dark:text-muted-foreground text-center text-sm">
          {t('alreadyListed')}{' '}
          <Link
            href="/signin"
            className="text-pana-indigo dark:text-pana-flame font-semibold underline"
          >
            {t('signInLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ListYourBusinessPage() {
  return <ListYourBusinessForm />;
}
