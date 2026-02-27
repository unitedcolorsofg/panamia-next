'use client';

import { useState, FormEvent } from 'react';
import { useSession } from '@/lib/auth-client';
import {
  GoogleReCaptchaProvider,
  useGoogleReCaptcha,
} from 'react-google-recaptcha-v3';
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

function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: session } = useSession();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { toast } = useToast();

  const isAuthenticated = !!session?.user?.email;

  const validateEmail = (email: string): boolean => {
    const regEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    return regEx.test(email);
  };

  const createContactUs = async (recaptchaToken?: string) => {
    const response = await axios
      .post(
        '/api/createContactUs',
        {
          name,
          email,
          message,
          recaptchaToken,
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
        title: 'Invalid Name',
        description: 'Please enter your name (at least 2 characters).',
      });
      return false;
    }

    if (!validateEmail(email)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
      });
      return false;
    }

    if (!message || message.trim().length < 10) {
      toast({
        variant: 'destructive',
        title: 'Message Too Short',
        description: 'Please enter a message (at least 10 characters).',
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
      let recaptchaToken: string | undefined;

      // Only require reCAPTCHA for unauthenticated users
      if (!isAuthenticated) {
        if (!executeRecaptcha) {
          toast({
            variant: 'destructive',
            title: 'Security Error',
            description: 'reCAPTCHA not ready. Please try again.',
          });
          setIsSubmitting(false);
          return;
        }

        recaptchaToken = await executeRecaptcha('contact_form_submit');
      }

      const response = await createContactUs(recaptchaToken);

      if (response?.data?.error) {
        toast({
          variant: 'destructive',
          title: 'Submission Failed',
          description: response.data.error,
        });
      } else {
        // Clear form
        setName('');
        setEmail('');
        setMessage('');

        toast({
          title: 'Message Sent Successfully!',
          description:
            "We've received your message and will get back to you soon.",
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description:
          'There was a problem submitting your message. Please try again.',
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
          <h1 className="mb-4 text-4xl font-bold">Contact Us</h1>
          <div className="text-muted-foreground space-y-2 text-lg">
            <p>
              Looking for answers? Check out our{' '}
              <Link
                href="/#home-faq"
                className="text-pana-blue hover:underline"
              >
                Frequently Asked Questions
              </Link>{' '}
              or learn more about who we are on our{' '}
              <Link href="/about-us" className="text-pana-blue hover:underline">
                About Us
              </Link>{' '}
              page.
            </p>
            <p>
              Please let us know if you have any questions for us. We&apos;ll
              reach out to you as soon as we can provide an answer.
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <Card>
          <CardHeader>
            <CardTitle>Send us a message</CardTitle>
            <CardDescription>
              Fill out the form below and we&apos;ll get back to you as soon as
              possible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitContactUs} className="space-y-6">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Your Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  name="name"
                  maxLength={75}
                  placeholder="Name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email Address <span className="text-destructive">*</span>
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
                  Message or Questions{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  maxLength={1000}
                  required
                  placeholder="Your message or questions you have for us"
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* reCAPTCHA Notice for Unauthenticated Users */}
              {!isAuthenticated && (
                <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-3 text-sm">
                  <Shield className="h-4 w-4" />
                  <span>
                    This form is protected by reCAPTCHA to prevent spam.
                  </span>
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
                    'Sending...'
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" aria-hidden="true" />
                      Submit Form
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
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  if (!recaptchaSiteKey) {
    console.error('NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not configured');
    // Still render the form, but reCAPTCHA won't work
    return <ContactForm />;
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey}>
      <ContactForm />
    </GoogleReCaptchaProvider>
  );
}
