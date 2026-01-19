import { profileCategoryList } from '@/lib/lists';
import {
  CategoryInterface,
  ProfileDescriptions,
  ProfileMentoring,
} from './interfaces';

export const listSelectedCategories = (categories: CategoryInterface) => {
  let listText = '';
  type keyType = keyof CategoryInterface; //  "name" | "age"
  Object.keys(categories).forEach((key) => {
    const listObj = profileCategoryList.find((obj) => {
      return obj.value == key;
    });
    if (listObj) {
      listText =
        listText.length === 0 ? listObj.desc : `${listText}, ${listObj.desc}`;
    }
  });
  return listText;
};

/**
 * Extract safe-for-public fields from a profile.
 */
export const unguardProfile = (profile: any) => {
  // Get descriptions from JSONB or legacy fields
  const descriptions = profile.descriptions as ProfileDescriptions | null;

  // Build primary address from columns or legacy object
  const primaryAddress = profile.primary_address || {
    name: profile.addressName,
    line1: profile.addressLine1,
    line2: profile.addressLine2,
    line3: profile.addressLine3,
    locality: profile.addressLocality,
    region: profile.addressRegion,
    postalCode: profile.addressPostalCode,
    country: profile.addressCountry,
    lat: profile.addressLat,
    lng: profile.addressLng,
    googlePlaceId: profile.addressGooglePlaceId,
    hours: profile.addressHours,
  };

  // Build images from columns/JSONB or legacy object
  const images = profile.images || {
    primary: profile.primaryImageId,
    primaryCDN: profile.primaryImageCdn,
    ...(profile.galleryImages || {}),
  };

  // only send safe for public fields
  const publicProfile: any = {
    _id: profile._id || profile.id,
    id: profile.id || profile._id,
    slug: profile.slug,
    name: profile.name,
    details: descriptions?.details || profile.details,
    background: descriptions?.background || profile.background,
    socials: profile.socials,
    five_words: descriptions?.fiveWords || profile.five_words,
    tags: descriptions?.tags || profile.tags,
    categories: profile.categories,
    primary_address: primaryAddress,
    counties: profile.counties,
    geo: profile.geo,
    images: images,
    linked_profiles: profile.linkedProfiles || profile.linked_profiles,
  };

  // Include mentoring data if enabled
  const mentoring = profile.mentoring as ProfileMentoring | null;
  if (mentoring?.enabled) {
    publicProfile.mentoring = {
      enabled: mentoring.enabled,
      expertise: mentoring.expertise,
      languages: mentoring.languages,
      bio: mentoring.bio,
      videoIntroUrl: mentoring.videoIntroUrl,
      hourlyRate: mentoring.hourlyRate,
    };
  }

  return publicProfile;
};
