'use client';

import { useToast } from '@/hooks/use-toast';

/**
 * Hook for guarding features that require a completed profile.
 * Shows a toast notification prompting the user to complete their profile.
 */
export function useProfileGuard() {
  const { toast } = useToast();

  /**
   * Check if user has a profile and show toast if not.
   * @param hasProfile - Whether the user has a profile
   * @param featureName - Description of the feature (e.g., "write articles")
   * @returns true if user has profile, false otherwise
   */
  const requireProfile = (
    hasProfile: boolean | null,
    featureName: string
  ): boolean => {
    if (hasProfile === false) {
      toast({
        title: 'Complete Your Profile',
        description: `Please complete your profile to ${featureName}.`,
        variant: 'default',
      });
      return false;
    }
    return hasProfile === true;
  };

  return { requireProfile };
}
