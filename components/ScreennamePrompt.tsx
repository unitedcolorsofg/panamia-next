'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';

interface ScreennamePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (screenname: string) => void;
  title?: string;
  description?: string;
}

export default function ScreennamePrompt({
  open,
  onOpenChange,
  onSuccess,
  title = 'Choose Your Screenname',
  description = 'Your screenname will be displayed publicly on your contributions. Choose something unique that represents you.',
}: ScreennamePromptProps) {
  const [screenname, setScreenname] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkAvailability = useCallback(async (name: string) => {
    if (!name || name.length < 3) {
      setStatus('idle');
      setError('');
      return;
    }

    setStatus('checking');
    setError('');

    try {
      const response = await fetch(
        `/api/user/screenname/check?name=${encodeURIComponent(name)}`
      );
      const data = await response.json();

      if (data.available) {
        setStatus('available');
        setError('');
      } else {
        setStatus(data.error?.includes('taken') ? 'taken' : 'invalid');
        setError(data.error || 'Invalid screenname');
      }
    } catch {
      setStatus('idle');
      setError('Could not check availability');
    }
  }, []);

  // Debounce check
  useEffect(() => {
    const timer = setTimeout(() => {
      checkAvailability(screenname);
    }, 500);

    return () => clearTimeout(timer);
  }, [screenname, checkAvailability]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setScreenname('');
      setStatus('idle');
      setError('');
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (status !== 'available') {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/user/screenname/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenname }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(data.data.screenname);
        onOpenChange(false);
      } else {
        setError(data.error || 'Failed to set screenname');
        setStatus('invalid');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="prompt-screenname">Screenname</Label>
            <div className="relative">
              <Input
                id="prompt-screenname"
                type="text"
                value={screenname}
                maxLength={24}
                autoComplete="username"
                onChange={(e) => setScreenname(e.target.value)}
                className={
                  status === 'available'
                    ? 'border-green-500 pr-10'
                    : status === 'taken' || status === 'invalid'
                      ? 'border-red-500 pr-10'
                      : 'pr-10'
                }
                placeholder="Enter screenname"
                disabled={isSubmitting}
              />
              <div className="absolute top-1/2 right-3 -translate-y-1/2">
                {status === 'checking' && (
                  <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                )}
                {status === 'available' && (
                  <Check className="h-4 w-4 text-green-500" />
                )}
                {(status === 'taken' || status === 'invalid') && (
                  <X className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <p className="text-muted-foreground text-sm">
              3-24 characters. Letters, numbers, underscores, and hyphens only.
            </p>
          </div>

          <div className="bg-pana-butter/60 dark:bg-pana-indigo rounded-lg p-3">
            <p className="text-pana-ink dark:text-pana-cream text-sm">
              Your screenname and name (if set) will be publicly displayed. Your
              email address remains private.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-pana-flame text-pana-ink hover:bg-pana-burnt font-extrabold"
            disabled={status !== 'available' || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Screenname'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
