'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Send } from 'lucide-react';

export default function BecomeAPanaSinglePage() {
  const router = useRouter();
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
  const [pronounsSheher, setPronounsSheher] = useState(false);
  const [pronounsHehim, setPronounsHehim] = useState(false);
  const [pronounsTheythem, setPronounsTheythem] = useState(false);
  const [pronounsNone, setPronounsNone] = useState(false);
  const [pronounsOther, setPronounsOther] = useState(false);
  const [pronounsOtherdesc, setPronounsOtherdesc] = useState('');
  const [fiveWords, setFiveWords] = useState('');
  const [tags, setTags] = useState('');

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
        '/api/createExpressProfile',
        {
          email,
          name,
          locally_based: locallyBased,
          details,
          background,
          socials,
          phone_number: phoneNumber,
          whatsapp_community: whatsappCommunity,
          pronouns,
          five_words: fiveWords,
          tags,
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
      setIsSubmitting(true);
      const response = await createExpressProfile();
      setIsSubmitting(false);

      if (response) {
        if (response.data.error) {
          alert(response.data.error);
        } else {
          console.log(response.data.msg);
          router.push('/form/become-a-pana-confirmation');
        }
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-3xl px-4 py-12">
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
        <div className="mb-8 space-y-4">
          <h1 className="text-center text-4xl font-bold">
            Directory Express Sign Up Form
          </h1>
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              Why are you filling out this form?
            </h2>
            <p className="text-muted-foreground">
              We want to better understand your project and get a better sense
              of your needs. Some of this information will be for internal use
              and some will be published publicly on our directory. Once our
              Keyword-Searchable Directory is up on our website you will have
              the ability to edit your profiles as needed! In the meantime, you
              can view our current{' '}
              <a
                href="https://docs.google.com/spreadsheets/d/1FWh_LIroPsu_0Xej-anP0RuIBDp6k8l1cfJ0pq8dQjY"
                className="text-pana-blue hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Directory Sheet
              </a>
            </p>
            <p className="font-semibold">
              Please answer to the best of your ability. You are welcome to
              create more than one profile if you have separate projects - just
              make sure to use a different email.
            </p>
            <p className="text-sm italic text-muted-foreground">
              If you have questions please reach out to us at hola@panamia.club
            </p>
            <p className="text-sm text-destructive">
              * Indicates required field
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={submitExpressProfile} className="space-y-6">
              {/* Email */}
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
                <p className="text-sm text-muted-foreground">
                  The email that will be used for signing in
                </p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name of your self, Business, Project, or Org{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  name="name"
                  maxLength={75}
                  placeholder="Name"
                  value={name}
                  required
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  This name will display as the Title of your profile
                </p>
              </div>

              {/* Locally Based */}
              <div className="space-y-3">
                <Label>
                  Are you (the creator, director, owner, CEO) locally-based or a
                  native of South Florida?{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  South Florida is Miami-Dade, Broward and Palm Beach County
                </p>
                <RadioGroup
                  value={locallyBased}
                  onValueChange={setLocallyBased}
                  required
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="locally-yes" />
                    <Label htmlFor="locally-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="locally-no" />
                    <Label htmlFor="locally-no">No</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Details */}
              <div className="space-y-2">
                <Label htmlFor="details">
                  Details about your business/project{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="details"
                  name="details"
                  rows={4}
                  placeholder="Tell us about what you do..."
                  value={details}
                  required
                  onChange={(e) => setDetails(e.target.value)}
                />
              </div>

              {/* Background */}
              <div className="space-y-2">
                <Label htmlFor="background">Background/Story</Label>
                <Textarea
                  id="background"
                  name="background"
                  rows={4}
                  placeholder="Share your story..."
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  name="phone_number"
                  placeholder="(123) 456-7890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              {/* WhatsApp Community */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="whatsapp"
                  checked={whatsappCommunity}
                  onCheckedChange={(checked) =>
                    setWhatsappCommunity(checked === true)
                  }
                />
                <Label htmlFor="whatsapp" className="cursor-pointer">
                  Join our WhatsApp community for updates
                </Label>
              </div>

              {/* Pronouns */}
              <div className="space-y-3">
                <Label>Pronouns</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="she-her"
                      checked={pronounsSheher}
                      onCheckedChange={(checked) =>
                        setPronounsSheher(checked === true)
                      }
                    />
                    <Label htmlFor="she-her" className="cursor-pointer">
                      She/Her
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="he-him"
                      checked={pronounsHehim}
                      onCheckedChange={(checked) =>
                        setPronounsHehim(checked === true)
                      }
                    />
                    <Label htmlFor="he-him" className="cursor-pointer">
                      He/Him
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="they-them"
                      checked={pronounsTheythem}
                      onCheckedChange={(checked) =>
                        setPronounsTheythem(checked === true)
                      }
                    />
                    <Label htmlFor="they-them" className="cursor-pointer">
                      They/Them
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="no-pref"
                      checked={pronounsNone}
                      onCheckedChange={(checked) =>
                        setPronounsNone(checked === true)
                      }
                    />
                    <Label htmlFor="no-pref" className="cursor-pointer">
                      No Preference
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="other-pronoun"
                        checked={pronounsOther}
                        onCheckedChange={(checked) =>
                          setPronounsOther(checked === true)
                        }
                      />
                      <Label htmlFor="other-pronoun" className="cursor-pointer">
                        Other
                      </Label>
                    </div>
                    {pronounsOther && (
                      <Input
                        type="text"
                        placeholder="Specify pronouns"
                        value={pronounsOtherdesc}
                        onChange={(e) => setPronounsOtherdesc(e.target.value)}
                        className="ml-6"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Five Words */}
              <div className="space-y-2">
                <Label htmlFor="five-words">
                  Give us five words that describes your business/services{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="five-words"
                  type="text"
                  name="five_words"
                  placeholder="Creative, Local, Community..."
                  value={fiveWords}
                  required
                  onChange={(e) => setFiveWords(e.target.value)}
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">
                  Tags/Keywords <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tags"
                  type="text"
                  name="tags"
                  placeholder="art, music, food..."
                  value={tags}
                  required
                  onChange={(e) => setTags(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Comma-separated keywords for search
                </p>
              </div>

              {/* Social Media */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Social Media Links</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://example.com"
                      value={socialsWebsite}
                      onChange={(e) => setSocialsWebsite(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input
                      id="instagram"
                      type="text"
                      placeholder="@username"
                      value={socialsInstagram}
                      onChange={(e) => setSocialsInstagram(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook</Label>
                    <Input
                      id="facebook"
                      type="text"
                      placeholder="facebook.com/page"
                      value={socialsFacebook}
                      onChange={(e) => setSocialsFacebook(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tiktok">TikTok</Label>
                    <Input
                      id="tiktok"
                      type="text"
                      placeholder="@username"
                      value={socialsTiktok}
                      onChange={(e) => setSocialsTiktok(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter/X</Label>
                    <Input
                      id="twitter"
                      type="text"
                      placeholder="@username"
                      value={socialsTwitter}
                      onChange={(e) => setSocialsTwitter(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spotify">Spotify</Label>
                    <Input
                      id="spotify"
                      type="text"
                      placeholder="spotify.com/artist/..."
                      value={socialsSpotify}
                      onChange={(e) => setSocialsSpotify(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-pana-pink hover:bg-pana-pink/90 md:w-auto"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    'Submitting...'
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
