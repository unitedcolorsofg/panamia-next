'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Pencil } from 'lucide-react';
import type { ProfileView } from '../_lib/profile-view';
import { useProfileViewer } from './profile-viewer';

interface ProfileGalleryProps {
  profile: ProfileView;
}

/**
 * The photo gallery.
 *
 * `profiles` has exactly three gallery slots, and the page this replaces
 * rendered them as three equal thumbnails. This is an open grid instead: the
 * first photo runs double-width so a business has somewhere to put its best
 * shot.
 *
 * The upload affordance is part of the grid rather than tucked away in an
 * admin screen, so an owner adds a photo from the page the photo appears on.
 * It links to the dashboard because that is where the upload pipeline lives.
 *
 * Visitors never see it; for them the grid is just the photos.
 *
 * Ownership comes from the viewer context rather than a prop because this page
 * is edge-cached — the server render is shared by everyone, so it cannot know
 * who is looking. @see profile-viewer.tsx
 */
export function ProfileGallery({ profile }: ProfileGalleryProps) {
  const { t } = useTranslation('profile');
  const { isOwner } = useProfileViewer();
  const { gallery } = profile;

  // Nothing to show and no way to add: the heading alone would read as a
  // section that failed to load.
  if (gallery.length === 0 && !isOwner) return null;

  const full = gallery.length >= 3;

  return (
    <div
      className="mt-16 border-t-2 border-[rgb(17_13_13_/_0.1)] pt-16 md:mt-24 md:pt-24 dark:border-[hsl(var(--border))]"
      data-rv
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="section-eyebrow">{t('gallery.eyebrow')}</span>
          <h2 className="bizprofile-h2 mt-4">{t('gallery.heading')}</h2>
        </div>
        {isOwner && gallery.length > 0 && (
          <Link href="/dashboard/profile" className="bizprofile-linkchip">
            <Pencil className="h-4 w-4 opacity-70" aria-hidden="true" />
            {t('gallery.addPhotos')}
          </Link>
        )}
      </div>

      {gallery.length > 0 && (
        // The tile spans are count-aware because the grid otherwise leaves a
        // hole. gallery_images holds at most three slots, so a three-image
        // gallery is the fullest one possible — with a 2x2 lead tile in a
        // four-column grid that left two empty cells on every complete
        // gallery. Three images now tile a 4x2 block exactly; one and two
        // images use a grid sized to fit them.
        <div
          className={`grid auto-rows-[10rem] gap-4 md:auto-rows-[13rem] ${
            gallery.length === 1
              ? 'grid-cols-1'
              : gallery.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-2 md:grid-cols-4'
          }`}
        >
          {gallery.map((image, index) => (
            <div
              key={image.src}
              className={
                gallery.length < 3
                  ? 'bizprofile-gallery-tile'
                  : index === 0
                    ? 'bizprofile-gallery-tile col-span-2 row-span-2'
                    : 'bizprofile-gallery-tile md:col-span-2'
              }
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(min-width: 768px) 25vw, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {isOwner && !full && (
        <>
          <Link
            href="/dashboard/profile"
            className="bizprofile-addphoto mt-4 w-full"
          >
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
            {t('gallery.addPhotos')}
          </Link>
          <span className="bizprofile-addphoto-hint">
            {t('gallery.addPhotosHint')}
          </span>
        </>
      )}
    </div>
  );
}
