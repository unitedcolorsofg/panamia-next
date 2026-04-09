'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Scale } from 'lucide-react';

export type CCLicenseValue = 'cc-by-4' | 'cc-by-sa-4';

interface CCLicensePickerProps {
  value: CCLicenseValue;
  onChange: (license: CCLicenseValue) => void;
  compact?: boolean;
  disabled?: boolean;
}

const LICENSE_OPTIONS: {
  value: CCLicenseValue;
  label: string;
  spdx: string;
  description: string;
  deedUrl: string;
  badgeUrl: string;
}[] = [
  {
    value: 'cc-by-sa-4',
    label: 'CC BY-SA 4.0',
    spdx: 'CC-BY-SA-4.0',
    description:
      'Anyone may share and adapt your work with attribution. Adaptations must use the same license.',
    deedUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    badgeUrl: 'https://licensebuttons.net/l/by-sa/4.0/88x31.png',
  },
  {
    value: 'cc-by-4',
    label: 'CC BY 4.0',
    spdx: 'CC-BY-4.0',
    description:
      'Anyone may share and adapt your work with attribution. No restrictions on derivative licenses.',
    deedUrl: 'https://creativecommons.org/licenses/by/4.0/',
    badgeUrl: 'https://licensebuttons.net/l/by/4.0/88x31.png',
  },
];

/**
 * Inline badge showing the selected CC license.
 * Clicking opens the full picker modal (handled by parent via onOpenPicker).
 */
export function CCLicenseBadge({
  value,
  onClick,
  disabled,
}: {
  value: CCLicenseValue;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const option = LICENSE_OPTIONS.find((o) => o.value === value)!;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="hover:bg-accent inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
    >
      <Scale className="h-3 w-3" />
      {option.label}
    </button>
  );
}

/**
 * Modal for selecting a CC license. Follows the same Dialog pattern
 * as LocationPickerModal.
 */
export function CCLicensePickerModal({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: CCLicenseValue;
  onChange: (license: CCLicenseValue) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white sm:max-w-md dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Content License
          </DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">
          All content on Panamia Club is Creative Commons licensed. Choose your
          license:
        </p>

        <div className="space-y-3 py-2">
          {LICENSE_OPTIONS.map((option) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  onOpenChange(false);
                }}
                className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                  selected ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                }`}
              >
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {selected && <Check className="text-primary h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.label}</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {option.description}
                  </p>
                  <a
                    href={option.deedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Read full license
                  </a>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-muted-foreground text-xs">
          CC licenses are irrevocable. Once published, the license grant cannot
          be withdrawn.
        </p>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Combined picker: inline badge + modal. Drop-in for editors/composers.
 */
export function CCLicensePicker({
  value,
  onChange,
  compact = false,
  disabled = false,
}: CCLicensePickerProps) {
  const [open, setOpen] = useState(false);

  if (compact) {
    return (
      <>
        <CCLicenseBadge
          value={value}
          onClick={() => !disabled && setOpen(true)}
          disabled={disabled}
        />
        <CCLicensePickerModal
          open={open}
          onOpenChange={setOpen}
          value={value}
          onChange={onChange}
        />
      </>
    );
  }

  const option = LICENSE_OPTIONS.find((o) => o.value === value)!;

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className="hover:bg-accent flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-50"
      >
        <Scale className="h-5 w-5 shrink-0 text-green-600" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{option.label}</div>
          <div className="text-muted-foreground text-xs">
            {option.description}
          </div>
        </div>
      </button>
      <CCLicensePickerModal
        open={open}
        onOpenChange={setOpen}
        value={value}
        onChange={onChange}
      />
    </>
  );
}

/**
 * Read-only CC badge for display on public content pages.
 * Minimal: just the SPDX identifier linking to the deed.
 */
export function CCBadge({ license }: { license: CCLicenseValue }) {
  const option = LICENSE_OPTIONS.find((o) => o.value === license);
  if (!option) return null;

  return (
    <a
      href={option.deedUrl}
      target="_blank"
      rel="noopener noreferrer license"
      className="text-muted-foreground text-xs hover:underline"
    >
      {option.label}
    </a>
  );
}

/**
 * Utility: get SPDX identifier and deed URL for a license value.
 */
export function getLicenseMetadata(license: CCLicenseValue) {
  const option = LICENSE_OPTIONS.find((o) => o.value === license)!;
  return {
    spdx: option.spdx,
    deedUrl: option.deedUrl,
    label: option.label,
  };
}
