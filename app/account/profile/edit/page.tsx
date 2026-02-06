'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Check,
  CheckSquare,
  ExternalLink,
  MapPin,
  Image as ImageIcon,
  User,
  UserCircle,
  Tag,
  BadgePercent,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import PageMeta from '@/components/PageMeta';
import { ProfileInterface } from '@/lib/interfaces';
import { displayPronouns, standardizeDateTime } from '@/lib/standardized';
import Status401_Unauthorized from '@/components/Page/Status401_Unauthorized';
import { listSelectedCategories } from '@/lib/profile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const SpanBlank = () => {
  return <span className="text-gray-400 italic">blank</span>;
};

const SpanUnselected = () => {
  return <span className="text-gray-400 italic">unselected</span>;
};

export default function AccountProfileEdit() {
  const { data: session, status } = useSession();
  const [hasProfile, setHasProfile] = useState(false);
  const [profileData, setProfileData] = useState({} as ProfileInterface);
  const [profileStatus, setProfileStatus] = useState('');
  const [profileStatusDate, setProfileStatusDate] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadProfile() {
    try {
      const profile = await axios.get('/api/getProfile', {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
      return profile;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      loadProfile().then((resp) => {
        const profile = resp?.data?.data as ProfileInterface;
        if (profile) {
          setHasProfile(true);
          setProfileData(profile);
          setProfileStatus('Submitted');
          setProfileStatusDate(standardizeDateTime(profile?.status?.submitted));
          if (profile?.status?.published && profile?.active) {
            setProfileStatus('Published');
            setProfileStatusDate(
              standardizeDateTime(profile?.status?.published)
            );
          }
        }
        setLoading(false);
      });
    }
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return <Status401_Unauthorized />;
  }

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <PageMeta title="Edit Profile" desc="" />

      <h2 className="mb-8 text-3xl font-bold">Your Pana Profile</h2>

      {/* Profile Status */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Profile Status
            </CardTitle>
            {profileData.screenname && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/profile/${profileData.screenname}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="font-medium">Status:</span>
            <span>
              {profileStatus} {profileStatusDate}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Contact Info
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/account/profile/contact">Edit</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="font-medium">Email:</span>{' '}
            <span>{profileData?.email}</span>
          </div>
          <div>
            <span className="font-medium">Phone Number:</span>{' '}
            <span>{profileData?.phone_number}</span>
          </div>
          <div>
            <span className="font-medium">Pronouns:</span>{' '}
            <span>{displayPronouns(profileData.pronouns)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Profile Descriptions */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Profile Descriptions
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/account/profile/desc">Edit</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="font-medium">Name:</span>{' '}
            <span>{profileData?.name}</span>
          </div>
          <div>
            <span className="font-medium">Five Words:</span>{' '}
            <span>{profileData?.five_words}</span>
          </div>
          <div>
            <span className="font-medium">Details:</span>{' '}
            <span>{profileData?.details}</span>
          </div>
          <div>
            <span className="font-medium">Background:</span>{' '}
            <span>{profileData?.background}</span>
          </div>
          <div>
            <span className="font-medium">Tags:</span>{' '}
            {(profileData?.tags && <span>{profileData?.tags}</span>) || (
              <SpanBlank />
            )}
          </div>
          {profileData?.screenname && (
            <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-800">
              <div className="font-medium">
                handle: /profile/{profileData.screenname}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                This is the URL for your profile
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Images */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Images
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/account/profile/images">Edit</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {profileData?.images?.primaryCDN && (
              <div className="space-y-2">
                <img
                  src={profileData.images.primaryCDN}
                  alt="Profile"
                  className="h-32 w-full rounded-md object-cover"
                />
                <small className="text-xs text-gray-600">Profile Image</small>
              </div>
            )}
            {profileData?.images?.gallery1CDN && (
              <div className="space-y-2">
                <img
                  src={profileData.images.gallery1CDN}
                  alt="Gallery 1"
                  className="h-32 w-full rounded-md object-cover"
                />
                <small className="text-xs text-gray-600">Gallery</small>
              </div>
            )}
            {profileData?.images?.gallery2CDN && (
              <div className="space-y-2">
                <img
                  src={profileData.images.gallery2CDN}
                  alt="Gallery 2"
                  className="h-32 w-full rounded-md object-cover"
                />
                <small className="text-xs text-gray-600">Gallery</small>
              </div>
            )}
            {profileData?.images?.gallery3CDN && (
              <div className="space-y-2">
                <img
                  src={profileData.images.gallery3CDN}
                  alt="Gallery 3"
                  className="h-32 w-full rounded-md object-cover"
                />
                <small className="text-xs text-gray-600">Gallery</small>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Links and Socials */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Links and Socials
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/account/profile/social">Edit</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Website:</span>{' '}
              {(profileData?.socials?.website && (
                <span>{profileData?.socials?.website}</span>
              )) || <SpanBlank />}
            </div>
            <div>
              <span className="font-medium">Instagram:</span>{' '}
              {(profileData?.socials?.instagram && (
                <span>{profileData?.socials?.instagram}</span>
              )) || <SpanBlank />}
            </div>
            <div>
              <span className="font-medium">Facebook:</span>{' '}
              {(profileData?.socials?.facebook && (
                <span>{profileData?.socials?.facebook}</span>
              )) || <SpanBlank />}
            </div>
            <div>
              <span className="font-medium">TikTok:</span>{' '}
              {(profileData?.socials?.tiktok && (
                <span>{profileData?.socials?.tiktok}</span>
              )) || <SpanBlank />}
            </div>
            <div>
              <span className="font-medium">Twitter:</span>{' '}
              {(profileData?.socials?.twitter && (
                <span>{profileData?.socials?.twitter}</span>
              )) || <SpanBlank />}
            </div>
            <div>
              <span className="font-medium">Spotify:</span>{' '}
              {(profileData?.socials?.spotify && (
                <span>{profileData?.socials?.spotify}</span>
              )) || <SpanBlank />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address and GeoLocation */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Address and GeoLocation
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/account/profile/address">Edit</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 font-medium">Primary Address:</div>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Street 1:</span>{' '}
                {(profileData?.primary_address?.street1 && (
                  <span>{profileData?.primary_address?.street1}</span>
                )) || <SpanBlank />}
              </div>
              <div>
                <span className="font-medium">Street 2:</span>{' '}
                {(profileData?.primary_address?.street2 && (
                  <span>{profileData?.primary_address?.street2}</span>
                )) || <SpanBlank />}
              </div>
              <div>
                <span className="font-medium">City:</span>{' '}
                {(profileData?.primary_address?.city && (
                  <span>{profileData?.primary_address?.city}</span>
                )) || <SpanBlank />}
              </div>
              <div>
                <span className="font-medium">State:</span>{' '}
                {(profileData?.primary_address?.state && (
                  <span>{profileData?.primary_address?.state}</span>
                )) || <SpanBlank />}
              </div>
              <div>
                <span className="font-medium">Zip Code:</span>{' '}
                {(profileData?.primary_address?.zipcode && (
                  <span>{profileData?.primary_address?.zipcode}</span>
                )) || <SpanBlank />}
              </div>
              <div>
                <span className="font-medium">Location Hours:</span>{' '}
                {(profileData?.primary_address?.hours && (
                  <span>{profileData?.primary_address?.hours}</span>
                )) || <SpanBlank />}
              </div>
            </div>
          </div>
          <div>
            <div className="mb-2 font-medium">Geo Coordinates:</div>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Latitude:</span>{' '}
                {(profileData?.primary_address?.lat && (
                  <span>{profileData?.primary_address?.lat}</span>
                )) || <SpanBlank />}
              </div>
              <div>
                <span className="font-medium">Longitude:</span>{' '}
                {(profileData?.primary_address?.lng && (
                  <span>{profileData?.primary_address?.lng}</span>
                )) || <SpanBlank />}
              </div>
            </div>
          </div>
          <div>
            <div className="mb-2 font-medium">Servicing Counties:</div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Palm Beach:</span>
                {profileData?.counties?.palm_beach ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <SpanUnselected />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Broward:</span>
                {profileData?.counties?.broward ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <SpanUnselected />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Miami-Dade:</span>
                {profileData?.counties?.miami_dade ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <SpanUnselected />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Categories
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/account/profile/categories">Edit</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 font-medium">Selected Categories:</div>
          <p>
            {(profileData?.categories &&
              listSelectedCategories(profileData?.categories)) || (
              <small className="text-gray-400 italic">None</small>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Gente dePana Offer */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BadgePercent className="h-5 w-5" />
              Gente dePana Offer
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/account/profile/gentedepana">Edit</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="font-medium">Discount Code:</span>{' '}
            {(profileData?.gentedepana?.code && (
              <span>{profileData.gentedepana.code}</span>
            )) || <SpanBlank />}
          </div>
          <div>
            <span className="font-medium">Percentage:</span>{' '}
            {(profileData?.gentedepana?.percentage && (
              <span>{profileData?.gentedepana?.percentage}</span>
            )) || <SpanBlank />}
          </div>
          <div>
            <span className="font-medium">Details:</span>{' '}
            {(profileData?.gentedepana?.details && (
              <span>{profileData.gentedepana.details}</span>
            )) || <SpanBlank />}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
