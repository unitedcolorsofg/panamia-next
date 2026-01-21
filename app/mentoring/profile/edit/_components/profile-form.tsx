'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  mentoringProfileSchema,
  type MentoringProfileData,
} from '@/lib/validations/mentoring-profile';

interface ProfileFormProps {
  initialData?: Partial<MentoringProfileData>;
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const router = useRouter();
  const [expertise, setExpertise] = useState<string[]>(
    initialData?.expertise || []
  );
  const [languages, setLanguages] = useState<string[]>(
    initialData?.languages || []
  );
  const [expertiseInput, setExpertiseInput] = useState('');
  const [languageInput, setLanguageInput] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MentoringProfileData>({
    resolver: zodResolver(mentoringProfileSchema),
    defaultValues: {
      enabled: initialData?.enabled || false,
      expertise: initialData?.expertise || [],
      languages: initialData?.languages || [],
      bio: initialData?.bio || '',
      videoIntroUrl: initialData?.videoIntroUrl || '',
      goals: initialData?.goals || '',
      hourlyRate: initialData?.hourlyRate || 0,
    },
  });

  const addExpertise = () => {
    if (expertiseInput.trim() && !expertise.includes(expertiseInput.trim())) {
      const newExpertise = [...expertise, expertiseInput.trim()];
      setExpertise(newExpertise);
      setValue('expertise', newExpertise);
      setExpertiseInput('');
    }
  };

  const removeExpertise = (item: string) => {
    const newExpertise = expertise.filter((e) => e !== item);
    setExpertise(newExpertise);
    setValue('expertise', newExpertise);
  };

  const addLanguage = () => {
    if (languageInput.trim() && !languages.includes(languageInput.trim())) {
      const newLanguages = [...languages, languageInput.trim()];
      setLanguages(newLanguages);
      setValue('languages', newLanguages);
      setLanguageInput('');
    }
  };

  const removeLanguage = (item: string) => {
    const newLanguages = languages.filter((l) => l !== item);
    setLanguages(newLanguages);
    setValue('languages', newLanguages);
  };

  const onSubmit = async (data: MentoringProfileData) => {
    try {
      const response = await fetch('/api/mentoring/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, expertise, languages }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to update profile');
      }

      router.push('/mentoring/profile');
      router.refresh();
    } catch (error) {
      console.error('Error updating profile:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Error',
        description: `Failed to save profile: ${errorMessage}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Enable Mentoring Toggle */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="enabled"
            {...register('enabled')}
            className="h-4 w-4"
          />
          <label htmlFor="enabled" className="font-semibold">
            Enable mentoring profile
          </label>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          When enabled, others can discover you as a mentor and book sessions.
        </p>
      </div>

      {/* Bio */}
      <div className="bg-card space-y-3 rounded-lg border p-6">
        <label className="block font-semibold">Mentoring Bio</label>
        <Textarea
          {...register('bio')}
          placeholder="Describe your mentoring approach and what you can help with..."
          className="min-h-32"
        />
        {errors.bio && (
          <p className="text-sm text-red-600">{errors.bio.message}</p>
        )}
      </div>

      {/* Expertise */}
      <div className="bg-card space-y-3 rounded-lg border p-6">
        <label className="block font-semibold">Areas of Expertise</label>
        <div className="flex space-x-2">
          <Input
            value={expertiseInput}
            onChange={(e) => setExpertiseInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && (e.preventDefault(), addExpertise())
            }
            placeholder="e.g., JavaScript, Career Advice"
          />
          <Button type="button" onClick={addExpertise}>
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {expertise.map((item) => (
            <span
              key={item}
              className="flex items-center space-x-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => removeExpertise(item)}
                className="text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {expertise.length === 0 && (
          <p className="text-sm text-gray-500">
            Add at least one expertise area
          </p>
        )}
        {errors.expertise && (
          <p className="text-sm text-red-600">{errors.expertise.message}</p>
        )}
      </div>

      {/* Languages */}
      <div className="bg-card space-y-3 rounded-lg border p-6">
        <label className="block font-semibold">Languages</label>
        <div className="flex space-x-2">
          <Input
            value={languageInput}
            onChange={(e) => setLanguageInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && (e.preventDefault(), addLanguage())
            }
            placeholder="e.g., English, Spanish"
          />
          <Button type="button" onClick={addLanguage}>
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {languages.map((item) => (
            <span
              key={item}
              className="flex items-center space-x-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800"
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => removeLanguage(item)}
                className="text-gray-600 hover:text-gray-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {languages.length === 0 && (
          <p className="text-sm text-gray-500">Add at least one language</p>
        )}
        {errors.languages && (
          <p className="text-sm text-red-600">{errors.languages.message}</p>
        )}
      </div>

      {/* Video Introduction URL */}
      <div className="bg-card space-y-3 rounded-lg border p-6">
        <label className="block font-semibold">
          Video Introduction URL (Optional)
        </label>
        <Input
          {...register('videoIntroUrl')}
          type="url"
          placeholder="https://example.com/intro-video.mp4"
        />
        {errors.videoIntroUrl && (
          <p className="text-sm text-red-600">{errors.videoIntroUrl.message}</p>
        )}
      </div>

      {/* Goals */}
      <div className="bg-card space-y-3 rounded-lg border p-6">
        <label className="block font-semibold">
          Mentoring Goals (Optional)
        </label>
        <Textarea
          {...register('goals')}
          placeholder="What you hope to achieve through mentoring..."
        />
        {errors.goals && (
          <p className="text-sm text-red-600">{errors.goals.message}</p>
        )}
      </div>

      {/* Hourly Rate */}
      <div className="bg-card space-y-3 rounded-lg border p-6">
        <label className="block font-semibold">Hourly Rate (USD)</label>
        <Input
          {...register('hourlyRate', { valueAsNumber: true })}
          type="number"
          min="0"
          step="1"
          placeholder="0 for free as in hugs"
        />
        {errors.hourlyRate && (
          <p className="text-sm text-red-600">{errors.hourlyRate.message}</p>
        )}
        <p className="text-sm text-gray-500">Set to 0 for free as in hugs</p>
      </div>

      {/* Submit */}
      <div className="flex space-x-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Profile'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
