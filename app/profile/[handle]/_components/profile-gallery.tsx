'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
} from '@/components/ui/dialog';

interface ProfileGalleryProps {
  images: {
    gallery1CDN?: string;
    gallery2CDN?: string;
    gallery3CDN?: string;
  };
}

export function ProfileGallery({ images }: ProfileGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const galleryImages = [
    images.gallery1CDN,
    images.gallery2CDN,
    images.gallery3CDN,
  ].filter(Boolean) as string[];

  if (galleryImages.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Gallery</CardTitle>
          <p className="text-sm text-muted-foreground">
            Click to see full-size image
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {galleryImages.map((imgUrl, index) => (
              <div
                key={index}
                className="relative aspect-square cursor-pointer overflow-hidden rounded-lg border transition-colors hover:border-gray-400"
                onClick={() => setSelectedImage(imgUrl)}
              >
                <img
                  src={imgUrl}
                  alt={`Gallery image ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full-size Image Dialog */}
      <Dialog
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogDescription className="text-sm text-muted-foreground">
              Click outside to dismiss
            </DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <div className="relative w-full">
              <img
                src={selectedImage}
                alt="Full size gallery image"
                className="h-auto w-full rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
