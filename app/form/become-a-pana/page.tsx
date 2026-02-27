'use client';

import { useState, useRef, FormEvent, useEffect } from 'react';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Shield } from 'lucide-react';

function BecomeAPanaForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [activePage, setActivePage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [locallyBased, setLocallyBased] = useState('');
  const [details, setDetails] = useState('');
  const [background, setBackground] = useState('');
  const [socialsWebsite, setSocialsWebsite] = useState('');
  const [socialsInstagram, setSocialsInstagram] = useState('');
  const [socialsFacebook, setSocialsFacebook] = useState('');
  const [socialsSpotify, setSocialsSpotify] = useState('');
  const [socialsTiktok, setSocialsTiktok] = useState('');
  const [socialsTwitter, setSocialsTwitter] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappCommunity, setWhatsappCommunity] = useState(false);
  const [pronouns, setPronouns] = useState('');
  const [pronounsOtherdesc, setPronounsOtherdesc] = useState('');
  const [fiveWords, setFiveWords] = useState('');
  const [tags, setTags] = useState('');
  const [hearAboutUs, setHearAboutUs] = useState('');
  const [agreeTos, setAgreeTos] = useState(false);

  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const page3Ref = useRef<HTMLDivElement>(null);
  const page4Ref = useRef<HTMLDivElement>(null);
  const page5Ref = useRef<HTMLDivElement>(null);
  const page6Ref = useRef<HTMLDivElement>(null);
  const page7Ref = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);

  // Redirect unauthenticated users to sign-in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin?callbackUrl=/form/become-a-pana');
    }
  }, [status, router]);

  // Auto-fill email from session
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      setEmail(session.user.email);
    }
  }, [status, session]);

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render form until authenticated (redirect happens in useEffect)
  if (status !== 'authenticated') {
    return null;
  }

  const validateEmail = (email: string): boolean => {
    const regEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    return regEx.test(email);
  };

  const createExpressProfile = async () => {
    const socials = {
      website: socialsWebsite,
      instagram: socialsInstagram,
      facebook: socialsFacebook,
      spotify: socialsSpotify,
      tiktok: socialsTiktok,
      twitter: socialsTwitter,
    };
    const pronounsData = {
      sheher: pronouns === 'sheher',
      hehim: pronouns === 'hehim',
      theythem: pronouns === 'theythem',
      none: pronouns === 'none',
      other: pronouns === 'other',
      other_desc: pronounsOtherdesc,
    };
    const response = await axios
      .post(
        '/api/createExpressProfile/',
        {
          email: email,
          name: name,
          locally_based: locallyBased,
          details: details,
          background: background,
          socials: socials,
          phone_number: phoneNumber,
          whatsapp_community: whatsappCommunity,
          pronouns: pronounsData,
          five_words: fiveWords,
          tags: tags,
          hearaboutus: hearAboutUs,
          affiliate: null,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      )
      .catch((error) => {
        console.error('Express profile submission error:', error);
        throw error;
      });
    return response;
  };

  function validateExpressProfile() {
    if (!name || name.trim().length < 2) {
      toast({
        variant: 'destructive',
        title: 'Invalid Name',
        description: 'Please enter a business/project name.',
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

    if (!socialsWebsite || socialsWebsite.trim().length < 5) {
      toast({
        variant: 'destructive',
        title: 'Website Required',
        description: 'Please provide your website URL.',
      });
      return false;
    }

    if (!agreeTos) {
      toast({
        variant: 'destructive',
        title: 'Terms Required',
        description: 'You must agree to the Terms & Conditions.',
      });
      return false;
    }

    return true;
  }

  async function submitExpressProfile(e: FormEvent) {
    console.log('submitExpressProfile called');
    e.preventDefault();

    console.log('About to call validateExpressProfile');
    console.log('Form values:', { name, email, socialsWebsite, agreeTos });

    let validationResult;
    try {
      validationResult = validateExpressProfile();
      console.log('Validation result:', validationResult);
    } catch (error) {
      console.error('Validation threw error:', error);
      return;
    }

    if (!validationResult) {
      console.log('Validation failed - returning');
      return;
    }
    console.log('Validation passed - proceeding with submission');

    setIsSubmitting(true);

    try {
      console.log('About to call createExpressProfile');
      const response = await createExpressProfile();
      console.log('API response:', response);

      if (response?.data?.error) {
        toast({
          variant: 'destructive',
          title: 'Submission Failed',
          description: response.data.error,
        });
      } else {
        setActivePage(8);
        confirmationRef.current?.scrollIntoView({ behavior: 'smooth' });

        // Send submission confirmation email (non-blocking)
        axios
          .post(
            '/api/profile/sendSubmission',
            { email: email },
            {
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
            }
          )
          .catch((err) => console.error('Email send error:', err));

        toast({
          title: 'Success!',
          description:
            'Your profile has been submitted for review. Check your email for next steps.',
        });
      }
    } catch (error) {
      console.error('Submission error caught:', error);
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description:
          'There was a problem submitting the form. Please contact us at hola@panamia.club',
      });
    } finally {
      console.log('Finally block - setting isSubmitting to false');
      setIsSubmitting(false);
    }
  }

  const scrollToPage = (pageNum: number) => {
    const refs = [
      null,
      page1Ref,
      page2Ref,
      page3Ref,
      page4Ref,
      page5Ref,
      page6Ref,
      page7Ref,
      confirmationRef,
    ];
    refs[pageNum]?.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const submitPage2 = (e: FormEvent) => {
    e.preventDefault();
    setActivePage(3);
    scrollToPage(3);
  };

  const submitPage3 = (e: FormEvent) => {
    e.preventDefault();
    setActivePage(4);
    scrollToPage(4);
  };

  const submitPage5 = (e: FormEvent) => {
    e.preventDefault();
    setActivePage(6);
    scrollToPage(6);
  };

  const submitPage7 = (e: FormEvent) => {
    console.log('submitPage7 called');
    e.preventDefault();
    submitExpressProfile(e);
  };

  const progress = Math.trunc((activePage / 7) * 100);

  return (
    <div className="flex min-h-screen flex-col py-8 md:py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <Image
              src="/logos/pana_logo_long_blue.png"
              alt="Pana MIA"
              width={400}
              height={100}
              className="h-auto max-w-full"
              priority
            />
          </div>

          <h1 className="text-center text-3xl font-bold md:text-4xl">
            Directory Express Sign Up Form
          </h1>

          <Card>
            <CardContent className="p-6 md:p-8">
              {/* Progress Bar */}
              {activePage < 8 && (
                <div className="mb-8">
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Page 1: Introduction */}
              {activePage === 1 && (
                <div ref={page1Ref} className="space-y-6">
                  <h2 className="text-2xl font-bold">
                    Why are you filling out this form?
                  </h2>
                  <div className="space-y-4 text-lg">
                    <p>
                      We want to better understand your project and get a better
                      sense of your needs. Your answers are used to create your
                      user profile on our Local Directory. Once your user
                      profile is live, you'll be able to edit this information
                      at any time. You can browse our Local Directory{' '}
                      <Link
                        href="/directory/search"
                        className="text-pana-blue underline"
                      >
                        here
                      </Link>
                      .
                    </p>
                    <p className="font-bold">
                      Please answer to the best of your ability. You are welcome
                      to create more than one profile if you have separate
                      projects - just make sure to use a different email.
                    </p>
                    <p className="italic">
                      If you have questions please reach out to us at
                      hola@panamia.club
                    </p>
                  </div>
                  <div className="flex justify-end pt-6">
                    <Button
                      size="lg"
                      className="bg-pana-pink hover:bg-pana-pink/90"
                      onClick={() => {
                        setActivePage(2);
                        scrollToPage(2);
                      }}
                    >
                      Start
                    </Button>
                  </div>
                </div>
              )}

              {/* Page 2: Locally Based */}
              {activePage === 2 && (
                <div ref={page2Ref}>
                  <form onSubmit={submitPage2} className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-lg font-bold">
                        Are you (the creator, director, owner, CEO)
                        locally-based or a native of South Florida? *
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        South Florida is Miami-Dade, Broward and Palm Beach
                        County
                      </p>
                      <RadioGroup
                        value={locallyBased}
                        onValueChange={setLocallyBased}
                        required
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="yes" />
                          <Label htmlFor="yes">I am</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="no" />
                          <Label htmlFor="no">
                            I'm not (and therefore do not qualify to be a member
                            of this club)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="other" id="other" />
                          <Label htmlFor="other">
                            Other (please{' '}
                            <Link
                              href="/form/contact-us"
                              className="text-pana-blue underline"
                            >
                              contact us
                            </Link>{' '}
                            with details)
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="flex justify-between pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setActivePage(1);
                          scrollToPage(1);
                        }}
                      >
                        Previous
                      </Button>
                      <Button
                        type="submit"
                        className="bg-pana-pink hover:bg-pana-pink/90"
                      >
                        Next
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Continue with pages 3-7... (keeping them the same but with disabled={isSubmitting} on all inputs) */}
              {/* For brevity, I'll include the key pages with disabled states */}

              {/* Page 3: Basic Info */}
              {activePage === 3 && (
                <div ref={page3Ref}>
                  <form onSubmit={submitPage3} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">
                        Name of your Business, Project, or Organization *
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        maxLength={75}
                        placeholder="Name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isSubmitting}
                      />
                      <p className="text-muted-foreground text-sm">
                        This name will display as the Title of your profile
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        maxLength={100}
                        placeholder="you@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={true}
                        className="cursor-not-allowed bg-gray-50"
                      />
                      <p className="text-muted-foreground text-sm">
                        This email is from your sign-in and cannot be changed
                        here. Not displayed on your profile.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="text"
                        maxLength={15}
                        placeholder="(###) ###-####"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={isSubmitting}
                      />
                      <p className="text-muted-foreground text-sm">
                        Used for contacting you, not displayed on profile
                      </p>
                      <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                          id="whatsapp"
                          checked={whatsappCommunity}
                          onCheckedChange={(checked) =>
                            setWhatsappCommunity(checked as boolean)
                          }
                          disabled={isSubmitting}
                        />
                        <Label htmlFor="whatsapp">
                          I'm interested in joining the WhatsApp community
                          chat/forum for directory members
                        </Label>
                      </div>
                    </div>

                    <div className="flex justify-between pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setActivePage(2);
                          scrollToPage(2);
                        }}
                        disabled={isSubmitting}
                      >
                        Previous
                      </Button>
                      <Button
                        type="submit"
                        className="bg-pana-pink hover:bg-pana-pink/90"
                        disabled={isSubmitting}
                      >
                        Next
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Page 4: Pronouns */}
              {activePage === 4 && (
                <div ref={page4Ref}>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-lg font-bold">
                        What are your preferred pronouns?
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        If you are an Individual (not representing a group or
                        org)
                      </p>
                      <RadioGroup
                        value={pronouns}
                        onValueChange={(value) => {
                          setPronouns(value);
                          if (value !== 'other') {
                            setPronounsOtherdesc('');
                          }
                        }}
                        disabled={isSubmitting}
                        className="space-y-3"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="sheher" id="sheher" />
                          <Label htmlFor="sheher">She/Her</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="hehim" id="hehim" />
                          <Label htmlFor="hehim">He/Him</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="theythem" id="theythem" />
                          <Label htmlFor="theythem">They/Them</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="none" id="none" />
                          <Label htmlFor="none">No Preference</Label>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="other" id="other-pronoun" />
                            <Label htmlFor="other-pronoun">Other:</Label>
                          </div>
                          {pronouns === 'other' && (
                            <Input
                              type="text"
                              placeholder="Please specify"
                              value={pronounsOtherdesc}
                              onChange={(e) =>
                                setPronounsOtherdesc(e.target.value)
                              }
                              className="ml-6"
                              disabled={isSubmitting}
                            />
                          )}
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="flex justify-between pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setActivePage(3);
                          scrollToPage(3);
                        }}
                        disabled={isSubmitting}
                      >
                        Previous
                      </Button>
                      <Button
                        className="bg-pana-pink hover:bg-pana-pink/90"
                        onClick={() => {
                          setActivePage(5);
                          scrollToPage(5);
                        }}
                        disabled={isSubmitting}
                      >
                        Next/Skip
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Page 5: Project Details */}
              {activePage === 5 && (
                <div ref={page5Ref}>
                  <form onSubmit={submitPage5} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="details">
                        Explain your project in detail: *
                      </Label>
                      <Textarea
                        id="details"
                        maxLength={500}
                        placeholder="Project Details"
                        required
                        rows={4}
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        disabled={isSubmitting}
                      />
                      <p className="text-muted-foreground text-sm">
                        This will be your intro to our users! A trimmed snippet
                        of this will show on the Directory Search. Please
                        include where you are based in SoFlo :)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="five-words">
                        Give us five words that describes your
                        business/services: *
                      </Label>
                      <Input
                        id="five-words"
                        type="text"
                        maxLength={100}
                        required
                        value={fiveWords}
                        onChange={(e) => setFiveWords(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tags">
                        Please provide a list of tags people can find you with
                        in our directory
                      </Label>
                      <Input
                        id="tags"
                        type="text"
                        maxLength={250}
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        disabled={isSubmitting}
                      />
                      <p className="text-muted-foreground text-sm">
                        Example (The Dancing Elephant): Spiritual/Metaphysical,
                        Books, Bookstore, Retail Shop
                      </p>
                    </div>

                    <div className="flex justify-between pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setActivePage(4);
                          scrollToPage(4);
                        }}
                        disabled={isSubmitting}
                      >
                        Previous
                      </Button>
                      <Button
                        type="submit"
                        className="bg-pana-pink hover:bg-pana-pink/90"
                        disabled={isSubmitting}
                      >
                        Next
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Page 6: Social Media */}
              {activePage === 6 && (
                <div ref={page6Ref}>
                  <div className="space-y-6">
                    <div>
                      <Label className="text-lg font-bold">
                        Website and Social Media
                      </Label>
                      <p className="text-muted-foreground mt-1 text-sm">
                        These will be displayed on your profile, please use the
                        full URL for each
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="website">Website: *</Label>
                        <Input
                          id="website"
                          type="text"
                          required
                          placeholder="https://www.example-pana.com"
                          value={socialsWebsite}
                          onChange={(e) => setSocialsWebsite(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="instagram">Instagram:</Label>
                        <Input
                          id="instagram"
                          type="text"
                          placeholder="https://www.instagram.com/example-pana/"
                          value={socialsInstagram}
                          onChange={(e) => setSocialsInstagram(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="facebook">Facebook:</Label>
                        <Input
                          id="facebook"
                          type="text"
                          placeholder="https://www.facebook.com/example-pana/"
                          value={socialsFacebook}
                          onChange={(e) => setSocialsFacebook(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="spotify">Spotify:</Label>
                        <Input
                          id="spotify"
                          type="text"
                          placeholder="https://www.spotify.com/@example-pana"
                          value={socialsSpotify}
                          onChange={(e) => setSocialsSpotify(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tiktok">TikTok:</Label>
                        <Input
                          id="tiktok"
                          type="text"
                          placeholder="https://www.tiktok.com/@example-pana"
                          value={socialsTiktok}
                          onChange={(e) => setSocialsTiktok(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="twitter">Twitter:</Label>
                        <Input
                          id="twitter"
                          type="text"
                          placeholder="https://twitter.com/example-pana"
                          value={socialsTwitter}
                          onChange={(e) => setSocialsTwitter(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setActivePage(5);
                          scrollToPage(5);
                        }}
                        disabled={isSubmitting}
                      >
                        Previous
                      </Button>
                      <Button
                        className="bg-pana-pink hover:bg-pana-pink/90"
                        onClick={() => {
                          setActivePage(7);
                          scrollToPage(7);
                        }}
                        disabled={isSubmitting}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Page 7: Final Questions */}
              {activePage === 7 && (
                <div ref={page7Ref}>
                  <form onSubmit={submitPage7} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="hear-about">
                        How did you hear about us? (optional)
                      </Label>
                      <Textarea
                        id="hear-about"
                        maxLength={500}
                        rows={4}
                        value={hearAboutUs}
                        onChange={(e) => setHearAboutUs(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-4">
                      <p>
                        Please read our{' '}
                        <Link
                          href="/doc/terms-and-conditions"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pana-blue underline"
                        >
                          Terms and Conditions
                        </Link>{' '}
                        which includes our general terms, our privacy policy,
                        and permission to accept email and SMS marketing.
                      </p>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="tos"
                          checked={agreeTos}
                          onCheckedChange={(checked) =>
                            setAgreeTos(checked as boolean)
                          }
                          required
                          disabled={isSubmitting}
                        />
                        <Label htmlFor="tos">
                          I agree to the Terms & Conditions *
                        </Label>
                      </div>
                    </div>

                    <div className="flex justify-between pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setActivePage(6);
                          scrollToPage(6);
                        }}
                        disabled={isSubmitting}
                      >
                        Previous
                      </Button>
                      <Button
                        type="submit"
                        className="bg-pana-pink hover:bg-pana-pink/90"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Form'}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Page 8: Confirmation */}
              {activePage === 8 && (
                <div ref={confirmationRef} className="space-y-6 text-center">
                  <h2 className="text-pana-pink text-3xl font-bold">
                    Thank you for signing up!
                  </h2>
                  <div className="space-y-4 text-lg">
                    <p className="font-semibold">
                      We're confirming your profile details and will email you
                      when it's published.
                    </p>
                    <p>
                      You can{' '}
                      <Link
                        href="/api/auth/signin"
                        className="text-pana-blue underline"
                      >
                        Sign In
                      </Link>{' '}
                      using your profile email to see other features and
                      continue updating your profile! The Pana MIA Club
                      community is here for you! Visit our{' '}
                      <Link
                        href="/about-us"
                        className="text-pana-blue underline"
                      >
                        About Us
                      </Link>{' '}
                      to learn more about how we support locals.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {activePage < 8 && (
            <p className="text-muted-foreground text-center text-sm">
              If you're having any trouble with our form, please{' '}
              <Link
                href="/form/contact-us"
                className="text-pana-blue underline"
              >
                Contact Us
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BecomeAPanaPage() {
  // reCAPTCHA not needed - users are authenticated before accessing form
  return <BecomeAPanaForm />;
}
