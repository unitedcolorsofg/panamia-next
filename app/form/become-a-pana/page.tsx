'use client';

import { useState, useRef, FormEvent } from 'react';
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

export default function BecomeAPanaForm() {
  const [activePage, setActivePage] = useState(1);

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
  const [pronounsSheher, setPronounsSheher] = useState(false);
  const [pronounsHehim, setPronounsHehim] = useState(false);
  const [pronounsTheythem, setPronounsTheythem] = useState(false);
  const [pronounsNone, setPronounsNone] = useState(false);
  const [pronounsOther, setPronounsOther] = useState(false);
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

  const createExpressProfile = async () => {
    const socials = {
      website: socialsWebsite,
      instagram: socialsInstagram,
      facebook: socialsFacebook,
      spotify: socialsSpotify,
      tiktok: socialsTiktok,
      twitter: socialsTwitter,
    };
    const pronouns = {
      sheher: pronounsSheher,
      hehim: pronounsHehim,
      theythem: pronounsTheythem,
      none: pronounsNone,
      other: pronounsOther,
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
          pronouns: pronouns,
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
        console.log(error);
        alert('There was a problem submitting the form, please contact us.');
        return null;
      });
    return response;
  };

  function validateExpressProfile() {
    if (email.length < 5) {
      alert('Please enter a valid email address.');
      return false;
    }
    return true;
  }

  async function submitExpressProfile(e: FormEvent) {
    e.preventDefault();
    if (validateExpressProfile()) {
      const response = await createExpressProfile();
      if (response) {
        if (response.data.error) {
          alert(response.data.error);
        } else {
          console.log(response.data.msg);
          setActivePage(8);
          confirmationRef.current?.scrollIntoView({ behavior: 'smooth' });
          await axios.post(
            '/api/profile/sendSubmission',
            { email: email },
            {
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
            }
          );
        }
      }
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
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    Page {activePage} of 7
                  </p>
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
                      <p className="text-sm text-muted-foreground">
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
                      />
                      <p className="text-sm text-muted-foreground">
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
                      />
                      <p className="text-sm text-muted-foreground">
                        The email that will be used for signing in, not
                        displayed on profile
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
                      />
                      <p className="text-sm text-muted-foreground">
                        Used for contacting you, not displayed on profile
                      </p>
                      <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                          id="whatsapp"
                          checked={whatsappCommunity}
                          onCheckedChange={(checked) =>
                            setWhatsappCommunity(checked as boolean)
                          }
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

              {/* Page 4: Pronouns */}
              {activePage === 4 && (
                <div ref={page4Ref}>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-lg font-bold">
                        What are your preferred pronouns?
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        If you are an Individual (not representing a group or
                        org)
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="sheher"
                            checked={pronounsSheher}
                            onCheckedChange={(checked) =>
                              setPronounsSheher(checked as boolean)
                            }
                          />
                          <Label htmlFor="sheher">She/Her</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="hehim"
                            checked={pronounsHehim}
                            onCheckedChange={(checked) =>
                              setPronounsHehim(checked as boolean)
                            }
                          />
                          <Label htmlFor="hehim">He/Him</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="theythem"
                            checked={pronounsTheythem}
                            onCheckedChange={(checked) =>
                              setPronounsTheythem(checked as boolean)
                            }
                          />
                          <Label htmlFor="theythem">They/Them</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="none"
                            checked={pronounsNone}
                            onCheckedChange={(checked) =>
                              setPronounsNone(checked as boolean)
                            }
                          />
                          <Label htmlFor="none">No Preference</Label>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="other-pronoun"
                              checked={pronounsOther}
                              onCheckedChange={(checked) =>
                                setPronounsOther(checked as boolean)
                              }
                            />
                            <Label htmlFor="other-pronoun">Other:</Label>
                          </div>
                          {pronounsOther && (
                            <Input
                              type="text"
                              placeholder="Please specify"
                              value={pronounsOtherdesc}
                              onChange={(e) =>
                                setPronounsOtherdesc(e.target.value)
                              }
                              className="ml-6"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setActivePage(3);
                          scrollToPage(3);
                        }}
                      >
                        Previous
                      </Button>
                      <Button
                        className="bg-pana-pink hover:bg-pana-pink/90"
                        onClick={() => {
                          setActivePage(5);
                          scrollToPage(5);
                        }}
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
                      />
                      <p className="text-sm text-muted-foreground">
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
                      />
                      <p className="text-sm text-muted-foreground">
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

              {/* Page 6: Social Media */}
              {activePage === 6 && (
                <div ref={page6Ref}>
                  <div className="space-y-6">
                    <div>
                      <Label className="text-lg font-bold">
                        Website and Social Media
                      </Label>
                      <p className="mt-1 text-sm text-muted-foreground">
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
                      >
                        Previous
                      </Button>
                      <Button
                        className="bg-pana-pink hover:bg-pana-pink/90"
                        onClick={() => {
                          setActivePage(7);
                          scrollToPage(7);
                        }}
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
                      >
                        Previous
                      </Button>
                      <Button
                        type="submit"
                        className="bg-pana-pink hover:bg-pana-pink/90"
                      >
                        Submit Form
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Page 8: Confirmation */}
              {activePage === 8 && (
                <div ref={confirmationRef} className="space-y-6 text-center">
                  <h2 className="text-3xl font-bold text-pana-pink">
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
                        Sign Up
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
            <p className="text-center text-sm text-muted-foreground">
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
