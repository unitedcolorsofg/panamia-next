'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useId,
} from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WaveformPlayerProps {
  url: string;
  peaks: number[];
  mediaType?: string;
}

/**
 * Generate a smooth bezier path through peaks
 * Creates an artistic waveform with smooth curves
 */
function generateWaveformPath(
  peaks: number[],
  width: number,
  height: number,
  mirror: boolean = false
): string {
  if (peaks.length === 0) return '';

  const midY = height / 2;
  const amplitude = height * 0.35; // Same amplitude for both main and mirror
  const points: { x: number; y: number }[] = [];

  // Generate points from peaks
  peaks.forEach((peak, i) => {
    const x = (i / (peaks.length - 1)) * width;
    const peakValue = Math.max(0, Math.min(1, peak));
    const y = mirror
      ? midY + peakValue * amplitude
      : midY - peakValue * amplitude;
    points.push({ x, y });
  });

  if (points.length < 2) return '';

  // Build smooth bezier curve
  let path = `M ${points[0].x},${midY}`;
  path += ` L ${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Catmull-Rom to Bezier conversion for smooth curves
    const tension = 0.3;
    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 2;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 2;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 2;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 2;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  // Close path back to baseline
  path += ` L ${points[points.length - 1].x},${midY}`;
  path += ` L ${points[0].x},${midY}`;
  path += ' Z';

  return path;
}

/**
 * Artistic waveform player with smooth bezier curves and gradient reveal
 */
export function WaveformPlayer({ url, peaks, mediaType }: WaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const width = 300;
  const height = 80;
  const uniqueId = useId();
  const gradientId = `waveform-gradient${uniqueId}`;
  const maskId = `waveform-mask${uniqueId}`;

  // Generate paths
  const mainPath = useMemo(
    () => generateWaveformPath(peaks, width, height, false),
    [peaks]
  );
  const mirrorPath = useMemo(
    () => generateWaveformPath(peaks, width, height, true),
    [peaks]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration > 0 && isFinite(audio.duration)) {
        setProgress(audio.currentTime / audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    // Wait for audio to be ready if needed
    const audioDuration = audio.duration;
    if (!audioDuration || !isFinite(audioDuration)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const seekProgress = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = seekProgress * audioDuration;
  }, []);

  const playheadX = progress * width;

  return (
    <div className="rounded-xl border bg-gradient-to-b from-slate-50 to-slate-100 p-4 dark:from-slate-900 dark:to-slate-800">
      <audio ref={audioRef} preload="metadata">
        <source src={url} type={mediaType || 'audio/webm'} />
      </audio>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 hover:text-white"
          onClick={togglePlayback}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="ml-0.5 h-5 w-5" />
          )}
        </Button>

        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-16 w-full cursor-pointer"
            preserveAspectRatio="none"
            onMouseDown={handleSeek}
          >
            <defs>
              {/* Gradient for the waveform - warm to cool colors */}
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f97316" /> {/* orange-500 */}
                <stop offset="25%" stopColor="#ec4899" /> {/* pink-500 */}
                <stop offset="50%" stopColor="#a855f7" /> {/* purple-500 */}
                <stop offset="75%" stopColor="#6366f1" /> {/* indigo-500 */}
                <stop offset="100%" stopColor="#06b6d4" /> {/* cyan-500 */}
              </linearGradient>

              {/* Clip mask for revealing color with playhead */}
              <clipPath id={maskId}>
                <rect x="0" y="0" width={playheadX} height={height} />
              </clipPath>
            </defs>

            {/* Faded background waveform (unplayed portion) */}
            <path
              d={mainPath}
              fill="currentColor"
              className="text-slate-300 dark:text-slate-600"
              opacity="0.4"
            />

            {/* Colored revealed waveform (played portion) */}
            <g clipPath={`url(#${maskId})`}>
              <path d={mainPath} fill={`url(#${gradientId})`} />
            </g>

            {/* Mirror reflection - faded background (unplayed) */}
            <path
              d={mirrorPath}
              fill="currentColor"
              className="text-slate-300 dark:text-slate-600"
              opacity="0.4"
            />

            {/* Mirror reflection - colored revealed (played portion) */}
            <g clipPath={`url(#${maskId})`}>
              <path d={mirrorPath} fill={`url(#${gradientId})`} />
            </g>

            {/* Playhead line */}
            {progress > 0 && (
              <line
                x1={playheadX}
                y1={height * 0.1}
                x2={playheadX}
                y2={height * 0.9}
                stroke="currentColor"
                className="text-slate-400 dark:text-slate-500"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * Extract peaks from an audio blob using Web Audio API
 * Returns normalized amplitude values (0-1)
 */
export async function extractPeaks(
  audioBlob: Blob,
  numSamples: number = 100
): Promise<number[]> {
  const audioContext = new AudioContext();

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get the audio data from the first channel
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPeak = Math.floor(channelData.length / numSamples);
    const peaks: number[] = [];

    for (let i = 0; i < numSamples; i++) {
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, channelData.length);

      // Find max absolute value in this segment
      let max = 0;
      for (let j = start; j < end; j++) {
        const absValue = Math.abs(channelData[j]);
        if (absValue > max) {
          max = absValue;
        }
      }

      peaks.push(max);
    }

    // Normalize peaks to 0-1 range
    const maxPeak = Math.max(...peaks, 0.01);
    return peaks.map((p) => p / maxPeak);
  } finally {
    await audioContext.close();
  }
}
