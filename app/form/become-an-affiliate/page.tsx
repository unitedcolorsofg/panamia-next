'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';

export default function BecomeAnAffiliatePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [acceptTOS, setAcceptTOS] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const acceptAffiliateTOS = async () => {
    const response = await axios
      .post(
        '/api/affiliate/acceptTOS',
        {
          accept_tos: acceptTOS,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      )
      .catch((error) => {
        console.log(error);
        toast({
          title: 'Error',
          description:
            'There was a problem submitting the form. Please refresh the page and try again.',
          variant: 'destructive',
        });
      });
    return response;
  };

  async function submitAffiliateTOS(e: FormEvent) {
    e.preventDefault();

    if (!acceptTOS) {
      toast({
        title: 'Required',
        description: 'Please accept the Terms and Conditions to continue.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const response = await acceptAffiliateTOS();
    setIsSubmitting(false);

    if (response) {
      if (response.data.error) {
        toast({
          title: 'Error',
          description: response.data.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Your affiliate code has been activated!',
        });
        router.push('/');
      }
    }
  }

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-lg">Loading...</p>
      </div>
    );
  }

  // Redirect to sign in if not authenticated
  if (status === 'unauthenticated') {
    return (
      <div className="from-background to-muted/20 flex min-h-screen flex-col items-center justify-center bg-gradient-to-b">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              You must be signed in to become an affiliate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/api/auth/signin">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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
          <h1 className="mb-4 text-4xl font-bold">Become A ComPana</h1>
          <p className="text-muted-foreground text-lg">
            Complete the form below to join our ComPana Affiliate Program and
            start earning awesome rewards!
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Affiliate Terms and Conditions</CardTitle>
            <CardDescription>
              Please review and accept the terms to activate your affiliate code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitAffiliateTOS} className="space-y-6">
              {/* Terms Summary */}
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Please review the Full{' '}
                  <Link
                    href="/doc/affiliate-terms-and-conditions"
                    className="text-pana-blue hover:underline"
                  >
                    Terms and Conditions
                  </Link>
                </p>

                <div>
                  <h3 className="mb-3 font-semibold">
                    Terms and Conditions Summary
                  </h3>
                  <ol className="space-y-3 pl-5 text-sm">
                    <li className="list-decimal">
                      The affiliate agrees to actively promote Pana MIA Club in
                      a positive manner and in accordance with the
                      organization&apos;s values and mission.
                    </li>
                    <li className="list-decimal">
                      Affiliates must comply with all applicable laws and
                      regulations in their promotion of Pana MIA Club
                    </li>
                    <li className="list-decimal">
                      Points can be redeemed within the affiliate system,
                      providing individuals with the opportunity to accumulate
                      points eligible for specific rewards (subject to change).
                    </li>
                    <li className="list-decimal">
                      The affiliate consents to receiving all marketing and
                      promotional materials via email and direct messaging
                    </li>
                  </ol>
                </div>
              </div>

              {/* Accept TOS Checkbox */}
              <div className="flex items-start space-x-3 rounded-lg border p-4">
                <Checkbox
                  id="accept-tos"
                  checked={acceptTOS}
                  onCheckedChange={(checked) => setAcceptTOS(checked === true)}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="accept-tos"
                    className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I have read and agree to the Affiliate Terms and Conditions{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center">
                <Button
                  type="submit"
                  size="lg"
                  className="bg-pana-pink hover:bg-pana-pink/90 w-full md:w-auto"
                  disabled={isSubmitting || !acceptTOS}
                >
                  {isSubmitting ? (
                    'Submitting...'
                  ) : (
                    <>
                      <CheckCircle2
                        className="mr-2 h-5 w-5"
                        aria-hidden="true"
                      />
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
