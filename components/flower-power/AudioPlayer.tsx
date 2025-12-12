'use client';

import { useEffect, useRef } from 'react';

interface AudioPlayerProps {
  isMuted: boolean;
}

export function AudioPlayer({ isMuted }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element with a simple, royalty-free tune
    // For now, we'll use Web Audio API to generate a playful melody
    const audioContext = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    let isPlaying = false;

    const playNote = (
      frequency: number,
      duration: number,
      startTime: number
    ) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      // Envelope for smooth sound
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const playMelody = () => {
      if (!isPlaying || isMuted) return;

      const now = audioContext.currentTime;
      const noteLength = 0.2;

      // Simple, playful melody (C major scale pattern)
      const melody = [
        523.25, // C5
        587.33, // D5
        659.25, // E5
        698.46, // F5
        783.99, // G5
        659.25, // E5
        523.25, // C5
        587.33, // D5
      ];

      melody.forEach((freq, index) => {
        playNote(freq, noteLength, now + index * noteLength);
      });

      // Loop
      setTimeout(playMelody, melody.length * noteLength * 1000 + 1000);
    };

    if (!isMuted) {
      isPlaying = true;
      // Small delay before starting
      setTimeout(playMelody, 500);
    }

    return () => {
      isPlaying = false;
      audioContext.close();
    };
  }, [isMuted]);

  return null;
}
