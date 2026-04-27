'use client';

import { useState, FormEvent } from 'react';
import { useSession } from '@/lib/auth-client';
import { useTurnstile } from '@/components/Turnstile';
import Link from 'next/link';
import Image from 'next/image';
import axios from 'axios';
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
import { Send, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: session } = useSession();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const {
    token: turnstileToken,
    reset: resetTurnstile,
    Widget: TurnstileWidget,
  } = useTurnstile(turnstileSiteKey, 'contact_form_submit');
  const { toast } = useToast();
  const { t: tToast } = useTranslation('toast');
  const { t } = useTranslation('contact');

  const isAuthenticated = !!session?.user?.email;

  const validateEmail = (email: string): boolean => {
    const regEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    return regEx.test(email);
  };

  const createContactUs = async (token?: string) => {
    const response = await axios
      .post(
        '/api/createContactUs',
        {
          name,
          email,
          message,
          turnstileToken: token,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      )
      .catch((error) => {
        console.error('Contact form submission error:', error);
        throw error;
      });
    return response;
  };

  function validateContactUs() {
    if (!name || name.trim().length < 2) {
      toast({
        variant: 'destructive',
        title: tToast('invalidName'),
        description: tToast('invalidNameContactDesc'),
      });
      return false;
    }

    if (!validateEmail(email)) {
      toast({
        variant: 'destructive',
        title: tToast('invalidEmail'),
        description: tToast('invalidEmailDesc'),
      });
      return false;
    }

    if (!message || message.trim().length < 10) {
      toast({
        variant: 'destructive',
        title: tToast('messageTooShort'),
        description: tToast('messageTooShortDesc'),
      });
      return false;
    }

    return true;
  }

  async function submitContactUs(e: FormEvent) {
    e.preventDefault();

    if (!validateContactUs()) {
      return;
    }

    setIsSubmitting(true);

    try {
      let token: string | undefined;

      if (!isAuthenticated) {
        if (!turnstileToken) {
          toast({
            variant: 'destructive',
            title: tToast('securityError'),
            description: tToast('turnstileNotReady'),
          });
          setIsSubmitting(false);
          return;
        }
        token = turnstileToken;
      }

      const response = await createContactUs(token);

      if (response?.data?.error) {
        toast({
          variant: 'destructive',
          title: tToast('submissionFailed'),
          description: response.data.error,
        });
      } else {
        setName('');
        setEmail('');
        setMessage('');
        resetTurnstile();

        toast({
          title: tToast('messageSentTitle'),
          description: tToast('messageSentDesc'),
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: tToast('submissionError'),
        description: tToast('submissionErrorContact'),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="from-background to-muted/20 flex min-h-screen flex-col bg-gradient-to-b">
      <div className="container mx-auto max-w-2xl px-4 py-12">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Image
              src="/logos/pana_logo_long_blue.png"
              alt="Pana MIA Club"
              width={300}
              height={150}
              className="h-auto w-64"
              priority
            />
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-4xl font-bold">{t('title')}</h1>
          <div className="text-muted-foreground space-y-2 text-lg">
            <p>
              {t('intro1')}{' '}
              <Link
                href="/#home-faq"
                className="text-pana-blue hover:underline"
              >
                {t('faqLink')}
              </Link>{' '}
              {t('intro1b')}{' '}
              <Link href="/about-us" className="text-pana-blue hover:underline">
                {t('aboutLink')}
              </Link>
              {t('intro1c')}
            </p>
            <p>{t('intro2')}</p>
          </div>
        </div>

        {/* Contact Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('formTitle')}</CardTitle>
            <CardDescription>{t('formDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitContactUs} className="space-y-6">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t('nameLabel')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  name="name"
                  maxLength={75}
                  placeholder={t('namePlaceholder')}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  {t('emailLabel')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  maxLength={100}
                  placeholder="you@example.com"
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Message Field */}
              <div className="space-y-2">
                <Label htmlFor="message">
                  {t('messageLabel')}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  maxLength={1000}
                  required
                  placeholder={t('messagePlaceholder')}
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {!isAuthenticated && (
                <div className="space-y-3">
                  {TurnstileWidget}
                  <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-3 text-sm">
                    <Shield className="h-4 w-4" />
                    <span>{t('turnstileNote')}</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-center">
                <Button
                  type="submit"
                  size="lg"
                  className="bg-pana-pink hover:bg-pana-pink/90 w-full md:w-auto"
                  disabled={isSubmitting}
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
      </div>
    </div>
  );
}

export default function ContactUsPage() {
  return <ContactForm />;
}
