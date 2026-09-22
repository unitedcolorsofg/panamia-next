'use client';

import Image from 'next/image';
import { ImagePlus, Pencil } from 'lucide-react';
import type { BusinessProfile } from '../_data';

interface ProfileGalleryProps {
  profile: BusinessProfile;
  /** True when the signed-in pana owns this listing. Adds the upload tile. */
  isOwner: boolean;
}

/**
 * The photo gallery.
 *
 * The current profile supports exactly three gallery slots rendered as equal
 * thumbnails. This is an open grid instead: the first photo runs double-width
 * so a business has somewhere to put its best shot, and the upload tile is
 * part of the grid rather than a separate admin screen, so an owner adds a
 * photo from the page the photo appears on.
 *
 * Visitors never see the upload tile — for them the grid is just the photos.
 */
export function ProfileGallery({ profile, isOwner }: ProfileGalleryProps) {
  return (
    <div
      className="mt-16 border-t-2 border-[rgb(17_13_13_/_0.1)] pt-16 md:mt-24 md:pt-24 dark:border-[hsl(var(--border))]"
      data-rv
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="section-eyebrow">Photos</span>
          <h2 className="bizprofile-h2 mt-4">The place itself</h2>
        </div>
        {isOwner && (
          <button type="button" className="bizprofile-linkchip">
            <Pencil className="h-4 w-4 opacity-70" aria-hidden="true" />
            Manage photos
          </button>
        )}
      </div>

      <div className="grid auto-rows-[10rem] grid-cols-2 gap-4 md:auto-rows-[13rem] md:grid-cols-4">
        {profile.gallery.map((image, index) => (
          <div
            key={image.src}
            className={
              index === 0
                ? 'bizprofile-gallery-tile col-span-2 row-span-2'
                : 'bizprofile-gallery-tile'
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

        {isOwner && (
          // Spans the full grid width rather than taking a single cell. With five
          // photos the grid is already full, so a one-cell tile would start a
          // lonely third row and read like a sixth photo failed to load.
          <button type="button" className="bizprofile-addphoto col-span-2 md:col-span-4">
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
            Add photos
          </button>
        )}
      </div>
    </div>
  );
}
