'use client';

import { useState, useRef, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Option lists — keep in sync with the server enum validators in
// app/api/venues/route.ts and lib/schema/index.ts.
// ---------------------------------------------------------------------------

const VENUE_TYPES = [
  'bar_restaurant',
  'library_civic',
  'park_outdoor_public',
  'private_residence',
  'religious_community_hall',
  'coworking_office',
  'gallery_museum',
  'theater_performance',
  'studio_practice',
  'classroom_school',
  'beach_waterfront',
  'hotel_ballroom',
  'warehouse_industrial',
  'rooftop',
  'other',
] as const;

const ENVIRONMENTS = ['indoor', 'outdoor', 'mixed'] as const;
const USAGES = ['single_purpose', 'mixed_use'] as const;
const OWNERSHIPS = ['private', 'public', 'nonprofit', 'unknown'] as const;
const ADA_VALUES = ['yes', 'partial', 'none', 'unknown'] as const;
const PARKING_VALUES = [
  'none',
  'street',
  'lot',
  'garage',
  'valet',
  'limited_garage',
  'good_luck',
] as const;
const RENTAL_MODELS = [
  'free',
  'hourly',
  'flat',
  'tickets',
  'request_quote',
  'revenue_share',
  'other',
] as const;
const AV_TAGS = [
  'wifi',
  'power_outlets',
  'projector',
  'screen',
  'microphones',
  'pa_system',
  'stage_lighting',
  'livestream_cam',
  'hdmi_input',
  'usb_c_input',
  'chairs_provided',
  'tables_provided',
  'stage_area',
  'none_byod',
] as const;

const TOTAL_PAGES = 11; // last page (12) is the confirmation, not counted in progress

type VenueType = (typeof VENUE_TYPES)[number];
type Env = (typeof ENVIRONMENTS)[number];
type Usage = (typeof USAGES)[number];
type Ownership = (typeof OWNERSHIPS)[number];
type Ada = (typeof ADA_VALUES)[number];
type Parking = (typeof PARKING_VALUES)[number];
type RentalModel = (typeof RENTAL_MODELS)[number];

function NavRow({
  onNext,
  onPrev,
  showBack = true,
  t,
}: {
  onNext: () => void;
  onPrev?: () => void;
  showBack?: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="flex justify-between pt-6">
      {showBack && onPrev ? (
        <Button variant="outline" onClick={onPrev}>
          {t('buttons.back')}
        </Button>
      ) : (
        <span />
      )}
      <Button onClick={onNext}>{t('buttons.next')}</Button>
    </div>
  );
}

function SafetyCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded border p-3">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <span>{label}</span>
    </label>
  );
}

export default function SubmitVenueForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation('submitVenue');
  const { t: tToast } = useTranslation('toast');

  const [activePage, setActivePage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  // Page 1 — Identity
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerRole, setOwnerRole] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');

  // Page 2 — Location
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('US');
  const [parcelControlNumber, setParcelControlNumber] = useState('');
  const [parcelUnit, setParcelUnit] = useState('');
  const [pcnChecking, setPcnChecking] = useState(false);
  const [pcnConflict, setPcnConflict] = useState<{
    name: string;
    status: string;
  } | null>(null);

  // Page 3 — Type
  const [venueType, setVenueType] = useState<VenueType | ''>('');
  const [environment, setEnvironment] = useState<Env | ''>('');
  const [usage, setUsage] = useState<Usage | ''>('');
  const [ownership, setOwnership] = useState<Ownership>('unknown');

  // Page 4 — Capacity
  const [fireCapacity, setFireCapacity] = useState('');
  const [capacity, setCapacity] = useState('');

  // Page 5 — AV
  const [avTags, setAvTags] = useState<Set<string>>(new Set());

  // Page 6 — Accessibility & Parking
  const [adaAccessibility, setAdaAccessibility] = useState<Ada>('unknown');
  const [accessibilityNotes, setAccessibilityNotes] = useState('');
  const [parkingOptions, setParkingOptions] = useState<Parking>('none');
  const [parkingInstructions, setParkingInstructions] = useState('');

  // Page 7 — Safety
  const [exitCount, setExitCount] = useState('');
  const [aedOnSite, setAedOnSite] = useState(false);
  const [firstAidKit, setFirstAidKit] = useState(false);
  const [fireExtinguishersAccessible, setFireExtinguishersAccessible] =
    useState(false);
  const [severeWeatherShelter, setSevereWeatherShelter] = useState(false);
  const [securityStaffed, setSecurityStaffed] = useState(false);
  const [evacuationPlanUrl, setEvacuationPlanUrl] = useState('');
  const [safetyPlanUrl, setSafetyPlanUrl] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');
  const [safetyContactName, setSafetyContactName] = useState('');
  const [safetyContactPhone, setSafetyContactPhone] = useState('');

  // Page 8 — Insurance
  const [insuranceCoiUrl, setInsuranceCoiUrl] = useState('');
  const [insuranceCoiExpiresAt, setInsuranceCoiExpiresAt] = useState('');
  const [insuranceNotes, setInsuranceNotes] = useState('');

  // Page 9 — Rental & Booking
  const [isFree, setIsFree] = useState(false);
  const [rentalModel, setRentalModel] = useState<RentalModel | ''>('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [flatRate, setFlatRate] = useState('');
  const [minimumHours, setMinimumHours] = useState('');
  const [pricingNotes, setPricingNotes] = useState('');
  const [bookingInstructions, setBookingInstructions] = useState('');

  // Page 10 — Licensing & Rules
  const [hasLiquorLicense, setHasLiquorLicense] = useState(false);
  const [houseRules, setHouseRules] = useState('');
  const [buildingPlansUrl, setBuildingPlansUrl] = useState('');
  const [supportingDocsUrls, setSupportingDocsUrls] = useState<string[]>(['']);

  // Page 11 — Review
  const [tosAccepted, setTosAccepted] = useState(false);

  // Refs
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin?callbackUrl=/form/submit-venue');
    }
  }, [status, router]);

  // Debounced PCN dedup check
  useEffect(() => {
    if (!parcelControlNumber.trim()) {
      setPcnConflict(null);
      return;
    }
    const handle = setTimeout(() => {
      setPcnChecking(true);
      axios
        .get('/api/venues/check-parcel', {
          params: { pcn: parcelControlNumber.trim(), unit: parcelUnit.trim() },
        })
        .then((res) => {
          if (res.data?.data?.exists) {
            setPcnConflict(res.data.data.existing);
          } else {
            setPcnConflict(null);
          }
        })
        .catch(() => {
          setPcnConflict(null);
        })
        .finally(() => setPcnChecking(false));
    }, 500);
    return () => clearTimeout(handle);
  }, [parcelControlNumber, parcelUnit]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">{t('loading')}</p>
      </div>
    );
  }
  if (status !== 'authenticated' && activePage < TOTAL_PAGES + 1) {
    return null;
  }

  // Gate: panaVerified
  const panaVerified = session?.user?.panaVerified;
  if (!panaVerified && activePage < TOTAL_PAGES + 1) {
    return (
      <div className="flex min-h-screen flex-col py-8 md:py-16">
        <div className="container mx-auto max-w-2xl px-4">
          <Card>
            <CardContent className="p-6 md:p-8">
              <h1 className="mb-4 text-2xl font-bold">{t('title')}</h1>
              <p>{t('panaRequired')}</p>
              <div className="mt-6">
                <Link href="/venues">
                  <Button variant="outline">{t('returnToVenues')}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const scrollToPage = (pageNum: number) => {
    pageRefs.current[pageNum]?.scrollIntoView({ behavior: 'smooth' });
  };

  const progress =
    activePage <= TOTAL_PAGES
      ? Math.trunc((activePage / TOTAL_PAGES) * 100)
      : 100;

  const toggleAvTag = (tag: string) => {
    setAvTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const validatePage = (page: number): boolean => {
    if (page === 1) {
      if (!name.trim() || name.trim().length < 2) {
        toast({
          variant: 'destructive',
          title: tToast('error'),
          description: t('pages.identity.nameRequired'),
        });
        return false;
      }
    }
    if (page === 2) {
      if (!address.trim()) {
        toast({
          variant: 'destructive',
          title: tToast('error'),
          description: t('pages.location.addressRequired'),
        });
        return false;
      }
      if (!city.trim()) {
        toast({
          variant: 'destructive',
          title: tToast('error'),
          description: t('pages.location.cityRequired'),
        });
        return false;
      }
      if (!state.trim()) {
        toast({
          variant: 'destructive',
          title: tToast('error'),
          description: t('pages.location.stateRequired'),
        });
        return false;
      }
      if (pcnConflict) {
        toast({
          variant: 'destructive',
          title: tToast('error'),
          description: t('pages.location.pcnConflict', {
            name: pcnConflict.name,
            status: pcnConflict.status,
          }),
        });
        return false;
      }
    }
    if (page === 4) {
      const fc = parseInt(fireCapacity, 10);
      if (!Number.isFinite(fc) || fc <= 0) {
        toast({
          variant: 'destructive',
          title: tToast('error'),
          description: t('pages.capacity.fireCapacityRequired'),
        });
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validatePage(activePage)) return;
    const next = activePage + 1;
    setActivePage(next);
    scrollToPage(next);
  };

  const goPrev = () => {
    const prev = activePage - 1;
    setActivePage(prev);
    scrollToPage(prev);
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim() || 'US',
      postalCode: postalCode.trim() || undefined,
      fireCapacity: parseInt(fireCapacity, 10),
      capacity: capacity ? parseInt(capacity, 10) : undefined,
      parcelControlNumber: parcelControlNumber.trim() || undefined,
      parcelUnit: parcelUnit.trim() || undefined,
      venueType: venueType || undefined,
      venueEnvironment: environment || undefined,
      venueUsage: usage || undefined,
      venueOwnership: ownership,
      adaAccessibility,
      parkingOptions,
      parkingInstructions: parkingInstructions.trim() || undefined,
      accessibilityNotes: accessibilityNotes.trim() || undefined,
      website: website.trim() || undefined,
      hasLiquorLicense,
      houseRules: houseRules.trim() || undefined,
      buildingPlansUrl: buildingPlansUrl.trim() || undefined,
      supportingDocsUrls: supportingDocsUrls
        .map((u) => u.trim())
        .filter((u) => u.length > 0),
      avInfrastructure: Array.from(avTags),
      isFree,
      rentalModel: rentalModel || undefined,
      bookingInstructions: bookingInstructions.trim() || undefined,
      insuranceCoiUrl: insuranceCoiUrl.trim() || undefined,
      insuranceCoiExpiresAt: insuranceCoiExpiresAt || undefined,
      insuranceNotes: insuranceNotes.trim() || undefined,
    };

    const ownerContact: Record<string, string> = {};
    if (ownerName.trim()) ownerContact.name = ownerName.trim();
    if (ownerRole.trim()) ownerContact.role = ownerRole.trim();
    if (ownerEmail.trim()) ownerContact.email = ownerEmail.trim();
    if (ownerPhone.trim()) ownerContact.phone = ownerPhone.trim();
    if (Object.keys(ownerContact).length > 0)
      payload.ownerContact = ownerContact;

    const safetyContact: Record<string, string> = {};
    if (safetyContactName.trim()) safetyContact.name = safetyContactName.trim();
    if (safetyContactPhone.trim())
      safetyContact.phone = safetyContactPhone.trim();
    if (Object.keys(safetyContact).length > 0)
      payload.safetyContact = safetyContact;

    const safety: Record<string, unknown> = {};
    if (exitCount) safety.exitCount = parseInt(exitCount, 10);
    if (aedOnSite) safety.aedOnSite = true;
    if (firstAidKit) safety.firstAidKit = true;
    if (fireExtinguishersAccessible) safety.fireExtinguishersAccessible = true;
    if (severeWeatherShelter) safety.severeWeatherShelter = true;
    if (securityStaffed) safety.securityStaffed = true;
    if (evacuationPlanUrl.trim())
      safety.evacuationPlanUrl = evacuationPlanUrl.trim();
    if (safetyPlanUrl.trim()) safety.safetyPlanUrl = safetyPlanUrl.trim();
    if (safetyNotes.trim()) safety.notes = safetyNotes.trim();
    if (Object.keys(safety).length > 0) payload.safety = safety;

    const rentalPricing: Record<string, unknown> = { currency: 'USD' };
    if (hourlyRate) rentalPricing.hourlyRate = parseFloat(hourlyRate);
    if (flatRate) rentalPricing.flatRate = parseFloat(flatRate);
    if (minimumHours) rentalPricing.minimumHours = parseInt(minimumHours, 10);
    if (pricingNotes.trim()) rentalPricing.notes = pricingNotes.trim();
    if (Object.keys(rentalPricing).length > 1)
      payload.rentalPricing = rentalPricing;

    return payload;
  };

  const handleSubmit = async () => {
    if (!tosAccepted) return;
    setIsSubmitting(true);
    try {
      const payload = buildPayload();
      const res = await axios.post('/api/venues', payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.data?.success) {
        setCreatedSlug(res.data.data.slug);
        setActivePage(TOTAL_PAGES + 1);
        scrollToPage(TOTAL_PAGES + 1);
      } else {
        throw new Error(res.data?.error || t('errors.submitFailed'));
      }
    } catch (err) {
      let message = t('errors.submitFailed');
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.code === 'PARCEL_DUPLICATE') {
          message = t('errors.parcelDuplicate');
        } else if (err.response?.data?.error) {
          message = err.response.data.error;
        }
      }
      toast({
        variant: 'destructive',
        title: tToast('error'),
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const setPageRef = (idx: number) => (el: HTMLDivElement | null) => {
    pageRefs.current[idx] = el;
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex min-h-screen flex-col py-8 md:py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl space-y-8">
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
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-center">{t('subtitle')}</p>

          <Card>
            <CardContent className="p-6 md:p-8">
              {activePage <= TOTAL_PAGES && (
                <div className="mb-6">
                  <Progress value={progress} className="h-2" />
                  <p className="text-muted-foreground mt-2 text-xs">
                    {activePage} / {TOTAL_PAGES} · {t('hint')}
                  </p>
                </div>
              )}

              {/* Page 1 — Identity */}
              {activePage === 1 && (
                <div ref={setPageRef(1)} className="space-y-6">
                  <h2 className="text-2xl font-bold">
                    {t('pages.identity.heading')}
                  </h2>

                  <div className="space-y-2">
                    <Label htmlFor="name">{t('pages.identity.name')} *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('pages.identity.namePlaceholder')}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">
                      {t('pages.identity.website')}
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder={t('pages.identity.websitePlaceholder')}
                    />
                  </div>

                  <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="font-semibold">
                      {t('pages.identity.ownerHeading')}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="ownerName">
                          {t('pages.identity.ownerName')}
                        </Label>
                        <Input
                          id="ownerName"
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ownerRole">
                          {t('pages.identity.ownerRole')}
                        </Label>
                        <Input
                          id="ownerRole"
                          value={ownerRole}
                          onChange={(e) => setOwnerRole(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ownerEmail">
                          {t('pages.identity.ownerEmail')}
                        </Label>
                        <Input
                          id="ownerEmail"
                          type="email"
                          value={ownerEmail}
                          onChange={(e) => setOwnerEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ownerPhone">
                          {t('pages.identity.ownerPhone')}
                        </Label>
                        <Input
                          id="ownerPhone"
                          type="tel"
                          value={ownerPhone}
                          onChange={(e) => setOwnerPhone(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <NavRow onNext={goNext} showBack={false} t={t} />
                </div>
              )}

              {/* Page 2 — Location */}
              {activePage === 2 && (
                <div ref={setPageRef(2)} className="space-y-6">
                  <h2 className="text-2xl font-bold">
                    {t('pages.location.heading')}
                  </h2>

                  <div className="space-y-2">
                    <Label htmlFor="address">
                      {t('pages.location.address')} *
                    </Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="city">{t('pages.location.city')} *</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">
                        {t('pages.location.state')} *
                      </Label>
                      <Input
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        maxLength={2}
                        placeholder="FL"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">
                        {t('pages.location.postalCode')}
                      </Label>
                      <Input
                        id="postalCode"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">
                        {t('pages.location.country')}
                      </Label>
                      <Input
                        id="country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-lg border p-4">
                    <div>
                      <h3 className="font-semibold">
                        {t('pages.location.parcelHeading')}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {t('pages.location.parcelHint')}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="pcn">{t('pages.location.pcn')}</Label>
                        <Input
                          id="pcn"
                          value={parcelControlNumber}
                          onChange={(e) =>
                            setParcelControlNumber(e.target.value)
                          }
                          placeholder={t('pages.location.pcnPlaceholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pcnUnit">
                          {t('pages.location.pcnUnit')}
                        </Label>
                        <Input
                          id="pcnUnit"
                          value={parcelUnit}
                          onChange={(e) => setParcelUnit(e.target.value)}
                        />
                      </div>
                    </div>
                    {pcnChecking && (
                      <p className="text-muted-foreground text-sm">
                        {t('pages.location.pcnCheckInProgress')}
                      </p>
                    )}
                    {pcnConflict && (
                      <p className="text-sm text-red-600">
                        {t('pages.location.pcnConflict', {
                          name: pcnConflict.name,
                          status: pcnConflict.status,
                        })}
                      </p>
                    )}
                  </div>

                  <NavRow onNext={goNext} onPrev={goPrev} t={t} />
                </div>
              )}

              {/* Page 3 — Type */}
              {activePage === 3 && (
                <div ref={setPageRef(3)} className="space-y-6">
                  <h2 className="text-2xl font-bold">
                    {t('pages.type.heading')}
                  </h2>

                  <div className="space-y-2">
                    <Label>{t('pages.type.type')}</Label>
                    <Select
                      value={venueType}
                      onValueChange={(v) => setVenueType(v as VenueType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VENUE_TYPES.map((vt) => (
                          <SelectItem key={vt} value={vt}>
                            {t(`pages.type.types.${vt}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('pages.type.environment')}</Label>
                    <RadioGroup
                      value={environment}
                      onValueChange={(v) => setEnvironment(v as Env)}
                      className="grid grid-cols-1 gap-2 md:grid-cols-3"
                    >
                      {ENVIRONMENTS.map((env) => (
                        <label
                          key={env}
                          className="flex items-center gap-2 rounded border p-3"
                        >
                          <RadioGroupItem value={env} id={`env-${env}`} />
                          <span>{t(`pages.type.environments.${env}`)}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('pages.type.usage')}</Label>
                    <RadioGroup
                      value={usage}
                      onValueChange={(v) => setUsage(v as Usage)}
                      className="space-y-2"
                    >
                      {USAGES.map((u) => (
                        <label
                          key={u}
                          className="flex items-center gap-2 rounded border p-3"
                        >
                          <RadioGroupItem value={u} id={`usage-${u}`} />
                          <span>{t(`pages.type.usages.${u}`)}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('pages.type.ownership')}</Label>
                    <RadioGroup
                      value={ownership}
                      onValueChange={(v) => setOwnership(v as Ownership)}
                      className="space-y-2"
                    >
                      {OWNERSHIPS.map((o) => (
                        <label
                          key={o}
                          className="flex items-center gap-2 rounded border p-3"
                        >
                          <RadioGroupItem value={o} id={`ownership-${o}`} />
                          <span>{t(`pages.type.ownerships.${o}`)}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  <NavRow onNext={goNext} onPrev={goPrev} t={t} />
                </div>
              )}

              {/* Page 4 — Capacity */}
              {activePage === 4 && (
                <div ref={setPageRef(4)} className="space-y-6">
                  <h2 className="text-2xl font-bold">
                    {t('pages.capacity.heading')}
                  </h2>

                  <div className="space-y-2">
                    <Label htmlFor="fireCapacity">
                      {t('pages.capacity.fireCapacity')} *
                    </Label>
                    <Input
                      id="fireCapacity"
                      type="number"
                      min={1}
                      value={fireCapacity}
                      onChange={(e) => setFireCapacity(e.target.value)}
                      required
                    />
                    <p className="text-muted-foreground text-sm">
                      {t('pages.capacity.fireCapacityHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="capacity">
                      {t('pages.capacity.capacity')}
                    </Label>
                    <Input
                      id="capacity"
                      type="number"
                      min={1}
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                    />
                    <p className="text-muted-foreground text-sm">
                      {t('pages.capacity.capacityHint')}
                    </p>
                  </div>

                  <NavRow onNext={goNext} onPrev={goPrev} t={t} />
                </div>
              )}

              {/* Page 5 — AV */}
              {activePage === 5 && (
                <div ref={setPageRef(5)} className="space-y-6">
                  <h2 className="text-2xl font-bold">
                    {t('pages.av.heading')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('pages.av.subheading')}
                  </p>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {AV_TAGS.map((tag) => (
                      <label
                        key={tag}
                        className="flex items-center gap-3 rounded border p-3"
                      >
                        <Checkbox
                          checked={avTags.has(tag)}
                          onCheckedChange={() => toggleAvTag(tag)}
                        />
                        <span>{t(`pages.av.tags.${tag}`)}</span>
                      </label>
                    ))}
                  </div>

                  <NavRow onNext={goNext} onPrev={goPrev} t={t} />
                </div>
              )}

              {/* Page 6 — Accessibility & Parking */}
              {activePage === 6 && (
                <div ref={setPageRef(6)} className="space-y-6">
                  <h2 className="text-2xl font-bold">
                    {t('pages.accessibility.heading')}
                  </h2>

                  <div className="space-y-3">
                    <h3 className="font-semibold">
                      {t('pages.accessibility.adaHeading')}
                    </h3>
                    <Label>{t('pages.accessibility.adaQuestion')}</Label>
                    <RadioGroup
                      value={adaAccessibility}
                      onValueChange={(v) => setAdaAccessibility(v as Ada)}
                      className="space-y-2"
                    >
                      {ADA_VALUES.map((v) => (
                        <label
                          key={v}
                          className="flex items-center gap-2 rounded border p-3"
                        >
                          <RadioGroupItem value={v} id={`ada-${v}`} />
                          <span>{t(`pages.accessibility.ada.${v}`)}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    <div className="space-y-2">
                      <Label htmlFor="accessibilityNotes">
                        {t('pages.accessibility.accessibilityNotes')}
                      </Label>
                      <Textarea
                        id="accessibilityNotes"
                        value={accessibilityNotes}
                        onChange={(e) => setAccessibilityNotes(e.target.value)}
                        placeholder={t(
                          'pages.accessibility.accessibilityNotesPlaceholder'
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-6">
                    <h3 className="font-semibold">
                      {t('pages.accessibility.parkingHeading')}
                    </h3>
                    <Label>{t('pages.accessibility.parkingQuestion')}</Label>
                    <RadioGroup
                      value={parkingOptions}
                      onValueChange={(v) => setParkingOptions(v as Parking)}
                      className="space-y-2"
                    >
                      {PARKING_VALUES.map((v) => (
                        <label
                          key={v}
                          className="flex items-center gap-2 rounded border p-3"
                        >
                          <RadioGroupItem value={v} id={`parking-${v}`} />
                          <span>{t(`pages.accessibility.parking.${v}`)}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    <div className="space-y-2">
                      <Label htmlFor="parkingInstructions">
                        {t('pages.accessibility.parkingInstructions')}
                      </Label>
                      <Textarea
                        id="parkingInstructions"
                        value={parkingInstructions}
                        onChange={(e) => setParkingInstructions(e.target.value)}
                        placeholder={t(
                          'pages.accessibility.parkingInstructionsPlaceholder'
                        )}
                      />
                    </div>
                  </div>

                  <NavRow onNext={goNext} onPrev={goPrev} t={t} />
                </div>
              )}

              {/* Page 7 — Safety */}
              {activePage === 7 && (
                <div ref={setPageRef(7)} className="space-y-6">
                  <h2 className="text-2xl font-bold">
                    {t('pages.safety.heading')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('pages.safety.subheading')}
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="exitCount">
                      {t('pages.safety.exitCount')}
                    </Label>
                    <Input
                      id="exitCount"
                      type="number"
                      min={0}
                      value={exitCount}
                      onChange={(e) => setExitCount(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <SafetyCheckbox
                      label={t('pages.safety.aedOnSite')}
                      checked={aedOnSite}
                      onChange={setAedOnSite}
                    />
                    <SafetyCheckbox
                      label={t('pages.safety.firstAidKit')}
                      checked={firstAidKit}
                      onChange={setFirstAidKit}
                    />
                    <SafetyCheckbox
                      label={t('pages.safety.fireExtinguishersAccessible')}
                      checked={fireExtinguishersAccessible}
                      onChange={setFireExtinguishersAccessible}
                    />
                    <SafetyCheckbox
                      label={t('pages.safety.severeWeatherShelter')}
                      checked={severeWeatherShelter}
                      onChange={setSevereWeatherShelter}
                    />
                    <SafetyCheckbox
                      label={t('pages.safety.securityStaffed')}
                      checked={securityStaffed}
                      onChange={setSecurityStaffed}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="evacuationPlanUrl">
                        {t('pages.safety.evacuationPlanUrl')}
                      </Label>
                      <Input
                        id="evacuationPlanUrl"
                        type="url"
                        value={evacuationPlanUrl}
                        onChange={(e) => setEvacuationPlanUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="safetyPlanUrl">
                        {t('pages.safety.safetyPlanUrl')}
                      </Label>
                      <Input
                        id="safetyPlanUrl"
                        type="url"
                        value={safetyPlanUrl}
                        onChange={(e) => setSafetyPlanUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="safetyNotes">
                      {t('pages.safety.notes')}
                    </Label>
                    <Textarea
                      id="safetyNotes"
                      value={safetyNotes}
                      onChange={(e) => setSafetyNotes(e.target.value)}
                    />
                  </div>

                  <div className="space-y-4 border-t pt-6">
                    <h3 className="font-semibold">
                      {t('pages.safety.safetyContactHeading')}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="safetyContactName">
                          {t('pages.safety.safetyContactName')}
                        </Label>
                        <Input
                          id="safetyContactName"
                          value={safetyContactName}
                          onChange={(e) => setSafetyContactName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="safetyContactPhone">
                          {t('pages.safety.safetyContactPhone')}
                        </Label>
                        <Input
                          id="safetyContactPhone"
                          type="tel"
                          value={safetyContactPhone}
                          onChange={(e) =>
                            setSafetyContactPhone(e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <NavRow onNext={goNext} onPrev={goPrev} t={t} />
                </div>
              )}

              {/* Page 8 — Insurance */}
              {activePage === 8 && (
                <div ref={setPageRef(8)} className="space-y-6">
                  <h2 className="text-2xl font-bold">
                    {t('pages.insurance.heading')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('pages.insurance.subheading')}
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="coiUrl">
                      {t('pages.insurance.coiUrl')}
                    </Label>
                    <Input
                      id="coiUrl"
                      type="url"
                      value={insuranceCoiUrl}
                      onChange={(e) => setInsuranceCoiUrl(e.target.value)}
                      placeholder={t('pages.insurance.coiUrlPlaceholder')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="coiExpires">
                      {t('pages.insurance.coiExpires')}
                    </Label>
                    <Input
                      id="coiExpires"
                      type="date"
                      value={insuranceCoiExpiresAt}
                      onChange={(e) => setInsuranceCoiExpiresAt(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="insuranceNotes">
                      {t('pages.insurance.notes')}
                    </Label>
                    <Textarea
                      id="insuranceNotes"
                      value={insuranceNotes}
                      onChange={(e) => setInsuranceNotes(e.target.value)}
                      placeholder={t('pages.insurance.notesPlaceholder')}
                    />
                  </div>

                  <NavRow onNext={goNext} onPrev={goPrev} t={t} />
                </div>
              )}

              {/* Page 9 — Rental & Booking */}
              {activePage === 9 && (
                <div ref={setPageRef(9)} className="space-y-6">
                  <h2 className="text-2xl font-bold">
                    {t('pages.rental.heading')}
                  </h2>

                  <label className="flex items-center gap-3 rounded border p-3">
                    <Checkbox
                      checked={isFree}
                      onCheckedChange={(v) => {
                        const checked = v === true;
                        setIsFree(checked);
                        if (checked) setRentalModel('free');
                      }}
                    />
                    <span>{t('pages.rental.isFree')}</span>
                  </label>

                  {!isFree && (
                    <>
                      <div className="space-y-2">
                        <Label>{t('pages.rental.modelQuestion')}</Label>
                        <Select
                          value={rentalModel}
                          onValueChange={(v) =>
                            setRentalModel(v as RentalModel)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RENTAL_MODELS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {t(`pages.rental.models.${m}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="hourlyRate">
                            {t('pages.rental.hourlyRate')}
                          </Label>
                          <Input
                            id="hourlyRate"
                            type="number"
                            min={0}
                            step="0.01"
                            value={hourlyRate}
                            onChange={(e) => setHourlyRate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="flatRate">
                            {t('pages.rental.flatRate')}
                          </Label>
                          <Input
                            id="flatRate"
                            type="number"
                            min={0}
                            step="0.01"
                            value={flatRate}
                            onChange={(e) => setFlatRate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="minimumHours">
                            {t('pages.rental.minimumHours')}
                          </Label>
                          <Input
                            id="minimumHours"
                            type="number"
                            min={0}
                            value={minimumHours}
                            onChange={(e) => setMinimumHours(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pricingNotes">
                          {t('pages.rental.pricingNotes')}
                        </Label>
                        <Textarea
                          id="pricingNotes"
                          value={pricingNotes}
                          onChange={(e) => setPricingNotes(e.target.value)}
                          placeholder={t(
                            'pages.rental.pricingNotesPlaceholder'
                          )}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="bookingInstructions">
                      {t('pages.rental.bookingInstructions')}
                    </Label>
                    <Textarea
                      id="bookingInstructions"
                      value={bookingInstructions}
                      onChange={(e) => setBookingInstructions(e.target.value)}
                      placeholder={t(
                        'pages.rental.bookingInstructionsPlaceholder'
                      )}
                    />
                  </div>

                  <NavRow onNext={goNext} onPrev={goPrev} t={t} />
                </div>
              )}

              {/* Page 10 — Licensing & Rules */}
              {activePage === 10 && (
                <div ref={setPageRef(10)} className="space-y-6">
                  <h2 className="text-2xl font-bold">
                    {t('pages.licensing.heading')}
                  </h2>

                  <label className="flex items-center gap-3 rounded border p-3">
                    <Checkbox
                      checked={hasLiquorLicense}
                      onCheckedChange={(v) => setHasLiquorLicense(v === true)}
                    />
                    <span>{t('pages.licensing.hasLiquorLicense')}</span>
                  </label>

                  <div className="space-y-2">
                    <Label htmlFor="houseRules">
                      {t('pages.licensing.houseRules')}
                    </Label>
                    <Textarea
                      id="houseRules"
                      rows={5}
                      value={houseRules}
                      onChange={(e) => setHouseRules(e.target.value)}
                      placeholder={t('pages.licensing.houseRulesPlaceholder')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="buildingPlansUrl">
                      {t('pages.licensing.buildingPlansUrl')}
                    </Label>
                    <Input
                      id="buildingPlansUrl"
                      type="url"
                      value={buildingPlansUrl}
                      onChange={(e) => setBuildingPlansUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('pages.licensing.supportingDocs')}</Label>
                    <p className="text-muted-foreground text-sm">
                      {t('pages.licensing.supportingDocsHint')}
                    </p>
                    {supportingDocsUrls.map((url, idx) => (
                      <Input
                        key={idx}
                        type="url"
                        value={url}
                        onChange={(e) => {
                          const next = [...supportingDocsUrls];
                          next[idx] = e.target.value;
                          setSupportingDocsUrls(next);
                        }}
                        placeholder="https://..."
                      />
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSupportingDocsUrls([...supportingDocsUrls, ''])
                      }
                    >
                      + {t('pages.licensing.addDoc')}
                    </Button>
                  </div>

                  <NavRow onNext={goNext} onPrev={goPrev} t={t} />
                </div>
              )}

              {/* Page 11 — Review */}
              {activePage === 11 && (
                <div ref={setPageRef(11)} className="space-y-6">
                  <h2 className="text-2xl font-bold">
                    {t('pages.review.heading')}
                  </h2>
                  <p>{t('pages.review.summaryIntro')}</p>

                  <div className="space-y-2 rounded-lg border p-4 text-sm">
                    <div>
                      <strong>{name}</strong>
                    </div>
                    <div>
                      {address}, {city}, {state} {postalCode} {country}
                    </div>
                    {venueType && (
                      <div>
                        {t('pages.type.heading')}:{' '}
                        {t(`pages.type.types.${venueType}`)}
                      </div>
                    )}
                    <div>
                      {t('pages.capacity.fireCapacity')}: {fireCapacity}
                    </div>
                    {isFree ? (
                      <div>{t('pages.rental.isFree')}</div>
                    ) : rentalModel ? (
                      <div>
                        {t('pages.rental.modelQuestion')}:{' '}
                        {t(`pages.rental.models.${rentalModel}`)}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                    {t('pages.review.pendingNotice')}
                  </div>

                  <label className="flex items-start gap-3 rounded border p-3">
                    <Checkbox
                      checked={tosAccepted}
                      onCheckedChange={(v) => setTosAccepted(v === true)}
                    />
                    <span>{t('pages.review.tos')}</span>
                  </label>

                  <div className="flex justify-between pt-6">
                    <Button
                      variant="outline"
                      onClick={goPrev}
                      disabled={isSubmitting}
                    >
                      {t('buttons.back')}
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!tosAccepted || isSubmitting}
                      className="min-w-[180px]"
                    >
                      {isSubmitting
                        ? t('buttons.submitting')
                        : t('buttons.submit')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Confirmation */}
              {activePage === TOTAL_PAGES + 1 && (
                <div className="space-y-6 text-center">
                  <h2 className="text-2xl font-bold">
                    {t('pages.confirmation.heading')}
                  </h2>
                  <p className="text-muted-foreground">
                    {t('pages.confirmation.body')}
                  </p>
                  <div className="flex justify-center gap-4 pt-4">
                    {createdSlug && (
                      <Link href={`/venues/${createdSlug}`}>
                        <Button>{t('pages.confirmation.viewVenue')}</Button>
                      </Link>
                    )}
                    <Link href="/venues">
                      <Button variant="outline">
                        {t('pages.confirmation.backToVenues')}
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
