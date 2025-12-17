'use client';

import { useEffect, useRef } from 'react';

interface AudioPlayerProps {
  isMuted: boolean;
}

export function AudioPlayer({ isMuted }: AudioPlayerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastPlayTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isMuted) return;

    // Create audio context
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();
    audioContextRef.current = audioContext;

    const playNote = (frequency: number, duration: number = 0.15) => {
      if (!audioContext || isMuted) return;

      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'triangle'; // Triangle wave for softer, harp-like tone

      // Harp-like envelope: quick attack, gentle decay
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.04, now + 0.005); // Softer volume, faster attack
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration * 1.5); // Longer, gentler decay

      oscillator.start(now);
      oscillator.stop(now + duration * 1.5);
    };

    const playChord = (frequencies: number[]) => {
      frequencies.forEach((freq) => playNote(freq, 0.2));
    };

    // Throttle function to prevent too many sounds
    const throttle = (callback: () => void, delay: number) => {
      const now = Date.now();
      if (now - lastPlayTimeRef.current >= delay) {
        lastPlayTimeRef.current = now;
        callback();
      }
    };

    // Musical scales for different events
    const notes = {
      C5: 523.25,
      D5: 587.33,
      E5: 659.25,
      F5: 698.46,
      G5: 783.99,
      A5: 880.0,
      B5: 987.77,
    };

    // Click handler - play a cheerful chord
    const handleClick = (e: MouseEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('button')) {
        playChord([notes.C5, notes.E5, notes.G5]); // C major chord
      } else {
        playNote(notes.E5); // Single note for other clicks
      }
    };

    // Scroll handler - play gentle harp strum
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      throttle(() => {
        const currentScrollY = window.scrollY;
        const scrollingDown = currentScrollY > lastScrollY;

        // Gentle harp strum: play 2-3 notes with slight delay for arpeggio effect
        if (scrollingDown) {
          // Descending arpeggio for scrolling down
          playNote(notes.E5, 0.3);
          setTimeout(() => playNote(notes.C5, 0.3), 30);
        } else {
          // Ascending arpeggio for scrolling up
          playNote(notes.C5, 0.3);
          setTimeout(() => playNote(notes.E5, 0.3), 30);
        }

        lastScrollY = currentScrollY;
      }, 250); // Increased throttle for gentler feel
    };

    // Mouse move handler - occasional ambient notes
    const handleMouseMove = () => {
      throttle(() => {
        const randomNote = [notes.C5, notes.E5, notes.G5, notes.A5][
          Math.floor(Math.random() * 4)
        ];
        playNote(randomNote, 0.1);
      }, 1000); // Very throttled - once per second max
    };

    // Add event listeners
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousemove', handleMouseMove);

      if (audioContext) {
        audioContext.close();
      }
    };
  }, [isMuted]);

  return null;
}
