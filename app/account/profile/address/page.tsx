'use client';

import { useSession } from 'next-auth/react';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import axios from 'axios';
import { toast } from '@/hooks/use-toast';

import PageMeta from '@/components/PageMeta';
import { ProfileInterface } from '@/lib/interfaces';
import Status401_Unauthorized from '@/components/Page/Status401_Unauthorized';
import { useProfile, useMutateProfileAddress } from '@/lib/query/profile';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

export default function AccountProfileAddress() {
  const { data: session, status } = useSession();
  const mutation = useMutateProfileAddress();
  const { data, isLoading, isError } = useProfile();
  const profile = data as ProfileInterface;
  const [gettingCoords, setGettingCoords] = useState(false);

  const clickSetCoordsFromAddress = async () => {
    setGettingCoords(true);
    const form = document.getElementById('address_form') as HTMLFormElement;
    const formData = new FormData(form);

    const address = {
      street1: formData.get('street1'),
      street2: formData.get('street2'),
      city: formData.get('city'),
      state: formData.get('state'),
      zipcode: formData.get('zipcode'),
    };

    if (
      !(address.street1 && address.city && address.state && address.zipcode)
    ) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill out a Street, City, State and Zipcode',
        variant: 'destructive',
      });
      setGettingCoords(false);
      return false;
    }

    try {
      const response = await axios.post(
        '/api/geo/byAddress',
        { address },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      const coords = response.data.data[0];
      const latInput = document.getElementById('geo_lat') as HTMLInputElement;
      latInput.value = coords?.lat;
      const lngInput = document.getElementById('geo_lng') as HTMLInputElement;
      lngInput.value = coords?.lng;
      toast({
        title: 'Coordinates Set',
        description: 'Your Latitude and Longitude have been set, please save',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to get coordinates. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGettingCoords(false);
    }
  };

  const submitForm = (e: FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);

    const updates = {
      primary_address: {
        street1: formData.get('street1'),
        street2: formData.get('street2'),
        city: formData.get('city'),
        state: formData.get('state'),
        zipcode: formData.get('zipcode'),
        hours: formData.get('hours'),
        lat: formData.get('lat'),
        lng: formData.get('lng'),
      },
      counties: {
        palm_beach: formData.get('county_palmbeach') ? true : false,
        broward: formData.get('county_broward') ? true : false,
        miami_dade: formData.get('county_miamidade') ? true : false,
      },
    };

    mutation.mutate(updates);
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return <Status401_Unauthorized />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">No profile found</div>
      </div>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <PageMeta title="Address | Edit Profile" desc="" />

      <h2 className="mb-8 text-3xl font-bold">
        Profile - Edit Address and Geolocation
      </h2>

      <Card>
        <CardContent className="pt-6">
          <form id="address_form" onSubmit={submitForm} className="space-y-6">
            <div className="mb-6 flex justify-between gap-4">
              <Button variant="outline" asChild>
                <Link href="/account/profile/edit">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Link>
              </Button>
              <Button type="submit" disabled={isLoading || mutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {mutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>

            <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-900">
              Your Primary Address is your physical location and used for
              providing directions on your profile. You don't need to provide
              this information if your business is digital only or does not
              require patrons to visit a set address.
            </div>

            <div className="space-y-2">
              <Label htmlFor="street1">Street 1</Label>
              <Input
                id="street1"
                name="street1"
                type="text"
                defaultValue={profile.primary_address?.street1}
                placeholder="123 Main Street"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="street2">Street 2</Label>
              <Input
                id="street2"
                name="street2"
                type="text"
                defaultValue={profile.primary_address?.street2}
                placeholder="Suite 100 (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                type="text"
                defaultValue={profile.primary_address?.city}
                placeholder="Miami"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                name="state"
                type="text"
                defaultValue={profile.primary_address?.state}
                placeholder="FL"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipcode">Zip Code</Label>
              <Input
                id="zipcode"
                name="zipcode"
                type="text"
                defaultValue={profile.primary_address?.zipcode}
                placeholder="33101"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours">Hours</Label>
              <Textarea
                id="hours"
                name="hours"
                rows={4}
                maxLength={500}
                defaultValue={profile.primary_address?.hours}
                placeholder="Mon-Fri: 9am-5pm"
              />
            </div>

            <div className="border-t pt-6">
              <div className="mb-4 rounded-md bg-blue-50 p-4 text-sm text-blue-900">
                Your GeoLocation is used for mapping and showing users their
                distance away from you. If you operate out of multiple areas,
                choose a central point among those areas.
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={clickSetCoordsFromAddress}
                disabled={gettingCoords}
                className="mb-4"
              >
                {gettingCoords
                  ? 'Getting coordinates...'
                  : 'Get GeoLocation using my address'}
              </Button>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="geo_lat">Latitude</Label>
                  <Input
                    id="geo_lat"
                    name="lat"
                    type="text"
                    defaultValue={profile.primary_address?.lat}
                    placeholder="26.122582"
                  />
                  <p className="text-sm text-gray-500">Example: 26.122582</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="geo_lng">Longitude</Label>
                  <Input
                    id="geo_lng"
                    name="lng"
                    type="text"
                    defaultValue={profile.primary_address?.lng}
                    placeholder="-80.137139"
                  />
                  <p className="text-sm text-gray-500">Example: -80.137139</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="mb-4 rounded-md bg-blue-50 p-4 text-sm text-blue-900">
                Counties can be selected if you operate or service inside of
                these areas. If you're not sure, it is okay to select all
                counties.
              </div>

              <div className="space-y-4">
                <Label>Servicing Counties:</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="county_palmbeach"
                      name="county_palmbeach"
                      defaultChecked={
                        profile.counties?.palm_beach ? true : false
                      }
                    />
                    <Label
                      htmlFor="county_palmbeach"
                      className="cursor-pointer font-normal"
                    >
                      Palm Beach
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="county_broward"
                      name="county_broward"
                      defaultChecked={profile.counties?.broward ? true : false}
                    />
                    <Label
                      htmlFor="county_broward"
                      className="cursor-pointer font-normal"
                    >
                      Broward
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="county_miamidade"
                      name="county_miamidade"
                      defaultChecked={
                        profile.counties?.miami_dade ? true : false
                      }
                    />
                    <Label
                      htmlFor="county_miamidade"
                      className="cursor-pointer font-normal"
                    >
                      Miami-Dade
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {mutation.isError && (
              <div className="rounded-md bg-red-50 p-4 text-red-600">
                Failed to update profile. Please try again.
              </div>
            )}

            {mutation.isSuccess && (
              <div className="rounded-md bg-green-50 p-4 text-green-600">
                Profile updated successfully!
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
