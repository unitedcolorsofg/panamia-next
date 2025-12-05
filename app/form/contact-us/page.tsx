'use client';

import type { Metadata } from 'next';
import { useState, FormEvent } from 'react';
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
import { Send } from 'lucide-react';

export default function ContactUsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createContactUs = async () => {
    const response = await axios
      .post(
        '/api/createContactUs',
        {
          name,
          email,
          message,
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
        return null;
      });
    return response;
  };

  function validateContactUs() {
    if (email.length < 5) {
      alert('Please enter a valid email address.');
      return false;
    }
    return true;
  }

  async function submitContactUs(e: FormEvent) {
    e.preventDefault();
    if (validateContactUs()) {
      setIsSubmitting(true);
      const response = await createContactUs();
      setIsSubmitting(false);

      if (response) {
        if (response.data.error) {
          alert(response.data.error);
        } else {
          setName('');
          setEmail('');
          setMessage('');
          alert('Your message has been submitted!');
        }
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-2xl px-4 py-12">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Image
              src="/img/home/logoPanaMIA2.png"
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
          <div className="space-y-2 text-lg text-muted-foreground">
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
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-center">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-pana-pink hover:bg-pana-pink/90 md:w-auto"
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
