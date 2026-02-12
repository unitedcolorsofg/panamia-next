'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createSessionSchema,
  type CreateSessionData,
} from '@/lib/validations/session';

export function BookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mentorEmail = searchParams?.get('mentor') || null;

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Omit<CreateSessionData, 'mentorEmail' | 'scheduledAt'>>({
    resolver: zodResolver(
      createSessionSchema.omit({ mentorEmail: true, scheduledAt: true })
    ),
    defaultValues: {
      duration: 60,
      topic: '',
    },
  });

  const onSubmit = async (
    data: Omit<CreateSessionData, 'mentorEmail' | 'scheduledAt'>
  ) => {
    if (!mentorEmail) {
      toast({
        title: 'Error',
        description: 'Mentor email is required',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedDate || !selectedTime) {
      toast({
        title: 'Missing Selection',
        description: 'Please select a date and time',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Combine date and time into ISO 8601 format
      const [hours, minutes] = selectedTime.split(':');
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const response = await fetch('/api/mentoring/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mentorEmail,
          scheduledAt: scheduledDateTime.toISOString(),
          duration: data.duration,
          topic: data.topic,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create session');
      }

      const result = await response.json();
      router.push('/m/schedule');
      router.refresh();
    } catch (error) {
      console.error('Error booking session:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to book session',
        variant: 'destructive',
      });
    }
  };

  // Generate time slots (9 AM to 5 PM in 30-minute intervals)
  const timeSlots = [];
  for (let hour = 9; hour <= 17; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 17 && minute > 0) break; // Stop at 5:00 PM
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeSlots.push(time);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Mentor Info */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="mb-2 text-lg font-semibold">Booking with</h2>
        <p className="text-gray-700">{mentorEmail}</p>
      </div>

      {/* Date Selection */}
      <div className="bg-card space-y-3 rounded-lg border p-6">
        <label className="block font-semibold">Select Date</label>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          disabled={(date) => date < new Date()}
          className="rounded-md border"
        />
      </div>

      {/* Time Selection */}
      <div className="bg-card space-y-3 rounded-lg border p-6">
        <label className="block font-semibold">Select Time</label>
        <div className="grid grid-cols-4 gap-2">
          {timeSlots.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => setSelectedTime(time)}
              className={`rounded border px-3 py-2 text-sm ${
                selectedTime === time
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'bg-card hover:border-primary border'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
        {!selectedTime && (
          <p className="text-sm text-gray-500">Select a time slot</p>
        )}
      </div>

      {/* Duration */}
      <div className="bg-card space-y-3 rounded-lg border p-6">
        <label className="block font-semibold">Duration (minutes)</label>
        <select
          {...register('duration', { valueAsNumber: true })}
          className="w-full rounded border px-3 py-2"
        >
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={60}>60 minutes</option>
          <option value={90}>90 minutes</option>
          <option value={120}>120 minutes</option>
        </select>
        {errors.duration && (
          <p className="text-sm text-red-600">{errors.duration.message}</p>
        )}
      </div>

      {/* Topic */}
      <div className="bg-card space-y-3 rounded-lg border p-6">
        <label className="block font-semibold">Session Topic</label>
        <Textarea
          {...register('topic')}
          placeholder="What would you like to discuss in this session?"
          className="min-h-24"
        />
        {errors.topic && (
          <p className="text-sm text-red-600">{errors.topic.message}</p>
        )}
      </div>

      {/* Submit */}
      <div className="flex space-x-4">
        <Button
          type="submit"
          disabled={isSubmitting || !selectedDate || !selectedTime}
        >
          {isSubmitting ? 'Booking...' : 'Book Session'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
