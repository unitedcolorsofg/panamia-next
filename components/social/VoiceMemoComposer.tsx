'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useCreatePost } from '@/lib/query/social';
import { useToast } from '@/hooks/use-toast';
import {
  Mic,
  Square,
  Send,
  Trash2,
  Loader2,
  X,
  UserCircle,
  MapPin,
} from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { extractPeaks, WaveformPlayer } from './WaveformPlayer';

const MAX_DURATION_SECONDS = 60;
const MAX_RECIPIENTS = 8;

interface Recipient {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  uri: string;
}

interface VoiceMemoComposerProps {
  /** Pre-fill recipient (e.g., from profile page) */
  initialRecipient?: Recipient;
  onSuccess?: () => void;
  onClose?: () => void;
}

export function VoiceMemoComposer({
  initialRecipient,
  onSuccess,
  onClose,
}: VoiceMemoComposerProps) {
  // Recipients
  const [recipients, setRecipients] = useState<Recipient[]>(
    initialRecipient ? [initialRecipient] : []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Recipient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Content
  const [content, setContent] = useState('');

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPeaks, setAudioPeaks] = useState<number[] | null>(null);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [extractingPeaks, setExtractingPeaks] = useState(false);

  // Geolocation
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const createPost = useCreatePost();
  const { toast } = useToast();
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Search for actors when query changes
  useEffect(() => {
    if (debouncedQuery.length < 1) {
      setSearchResults([]);
      return;
    }

    const searchActors = async () => {
      setIsSearching(true);
      try {
        const res = await axios.get('/api/social/actors/search', {
          params: { q: debouncedQuery, limit: 10 },
        });
        if (res.data?.success) {
          // Filter out already-selected recipients
          const selectedIds = new Set(recipients.map((r) => r.id));
          setSearchResults(
            res.data.data.filter((r: Recipient) => !selectedIds.has(r.id))
          );
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchActors();
  }, [debouncedQuery, recipients]);

  const addRecipient = useCallback((recipient: Recipient) => {
    setRecipients((prev) => {
      if (prev.length >= MAX_RECIPIENTS) return prev;
      if (prev.some((r) => r.id === recipient.id)) return prev;
      return [...prev, recipient];
    });
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  }, []);

  const removeRecipient = useCallback((id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());

        // Extract waveform peaks for visualization
        setExtractingPeaks(true);
        try {
          const peaks = await extractPeaks(blob, 100);
          setAudioPeaks(peaks);
        } catch (err) {
          console.error('Failed to extract peaks:', err);
          // Continue without peaks - will fall back to basic player
        } finally {
          setExtractingPeaks(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= MAX_DURATION_SECONDS - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access to record voice memos.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const discardRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioPeaks(null);
    setDuration(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const requestLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation not supported',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setIsGettingLocation(false);
        toast({
          title: 'Location added',
          description: 'Your location has been attached to this message.',
        });
      },
      (error) => {
        setIsGettingLocation(false);
        let message = 'Unable to get your location.';
        if (error.code === error.PERMISSION_DENIED) {
          message =
            'Location access was denied. Please enable it in your browser settings.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Location information is unavailable.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out.';
        }
        toast({
          title: 'Location error',
          description: message,
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const removeLocation = () => {
    setLocation(null);
  };

  const handleSubmit = async () => {
    if (recipients.length === 0) {
      toast({
        title: 'No recipients',
        description: 'Please add at least one recipient.',
        variant: 'destructive',
      });
      return;
    }

    // Must have either content or voice memo
    const hasContent = content.trim().length > 0;
    const hasVoiceMemo = audioBlob !== null;

    if (!hasContent && !hasVoiceMemo) {
      toast({
        title: 'Empty message',
        description: 'Please record a voice memo or write a message.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      let attachment = null;

      // Upload voice memo if present
      if (audioBlob) {
        const formData = new FormData();
        const file = new File([audioBlob], 'voice-memo.webm', {
          type: 'audio/webm',
        });
        formData.append('file', file);

        // Include peaks for waveform visualization
        if (audioPeaks) {
          formData.append('peaks', JSON.stringify(audioPeaks));
        }

        const uploadRes = await axios.post('/api/social/media', formData);
        if (!uploadRes.data?.success) {
          throw new Error(uploadRes.data?.error || 'Upload failed');
        }
        attachment = uploadRes.data.data;
      }

      // Create the direct message
      await createPost.mutateAsync({
        content: hasContent ? content.trim() : '🎙️',
        visibility: 'direct',
        recipientActorIds: recipients.map((r) => r.id),
        attachments: attachment ? [attachment] : undefined,
        location: location || undefined,
      });

      // Reset state
      setContent('');
      discardRecording();
      setLocation(null);
      if (!initialRecipient) {
        setRecipients([]);
      }
      onSuccess?.();

      toast({
        title: 'Message sent',
        description: `Your ${hasVoiceMemo ? 'voice memo' : 'message'} has been sent.`,
      });
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Failed to send message. Please try again.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const isSubmitting = uploading || createPost.isPending;
  const canSend =
    recipients.length > 0 && (content.trim().length > 0 || audioBlob);

  return (
    <div className="space-y-4">
      {/* Recipient selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">To:</label>
        <div className="flex flex-wrap gap-2">
          {recipients.map((r) => (
            <div
              key={r.id}
              className="bg-secondary flex items-center gap-1.5 rounded-full py-1 pr-2 pl-1"
            >
              {r.avatarUrl ? (
                <Image
                  src={r.avatarUrl}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <UserCircle className="h-5 w-5" />
              )}
              <span className="text-sm">@{r.username}</span>
              <button
                type="button"
                onClick={() => removeRecipient(r.id)}
                className="text-muted-foreground hover:text-foreground ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {recipients.length < MAX_RECIPIENTS && (
            <div className="relative min-w-[150px] flex-1">
              <Input
                ref={searchInputRef}
                type="text"
                placeholder={
                  recipients.length === 0 ? '@username' : 'Add another...'
                }
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value.replace(/^@/, ''));
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                className="h-8"
              />
              {showResults && (searchResults.length > 0 || isSearching) && (
                <div className="bg-popover absolute top-full left-0 z-10 mt-1 w-full rounded-md border shadow-lg">
                  {isSearching ? (
                    <div className="flex items-center justify-center p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    searchResults.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="hover:bg-accent flex w-full items-center gap-2 p-2 text-left"
                        onMouseDown={() => addRecipient(r)}
                      >
                        {r.avatarUrl ? (
                          <Image
                            src={r.avatarUrl}
                            alt=""
                            width={24}
                            height={24}
                            className="h-6 w-6 rounded-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <UserCircle className="h-6 w-6" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {r.displayName}
                          </div>
                          <div className="text-muted-foreground truncate text-xs">
                            @{r.username}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Message content */}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Voice memos, not voicemail you know the drill ~BEEEP~"
        rows={3}
        className="resize-y font-mono"
      />

      {/* Recording controls and location */}
      <div className="space-y-3">
        {!audioBlob ? (
          <div className="flex items-center gap-3">
            {isRecording ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={stopRecording}
                >
                  <Square className="mr-1 h-4 w-4" />
                  Stop
                </Button>
                <span className="text-muted-foreground flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  Recording {formatDuration(duration)} /{' '}
                  {formatDuration(MAX_DURATION_SECONDS)}
                </span>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startRecording}
                >
                  <Mic className="mr-1 h-4 w-4" />
                  Record Voice Memo
                </Button>
                {!location ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={requestLocation}
                    disabled={isGettingLocation}
                  >
                    {isGettingLocation ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="mr-1 h-4 w-4" />
                    )}
                    Add Location
                  </Button>
                ) : (
                  <div className="bg-secondary flex items-center gap-1.5 rounded-full py-1 pr-2 pl-2 text-sm">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="text-muted-foreground">
                      {location.latitude.toFixed(4)},{' '}
                      {location.longitude.toFixed(4)}
                    </span>
                    <button
                      type="button"
                      onClick={removeLocation}
                      className="text-muted-foreground hover:text-foreground ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              {extractingPeaks ? (
                <div className="bg-muted flex items-center justify-center gap-2 rounded-lg border p-6">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-muted-foreground text-sm">
                    Generating waveform...
                  </span>
                </div>
              ) : audioPeaks && audioUrl ? (
                <WaveformPlayer
                  url={audioUrl}
                  peaks={audioPeaks}
                  mediaType="audio/webm"
                />
              ) : (
                <div className="bg-muted flex items-center gap-3 rounded-lg border p-3">
                  <audio controls className="h-8 flex-1" preload="metadata">
                    <source src={audioUrl!} type="audio/webm" />
                  </audio>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={discardRecording}
                disabled={isSubmitting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {/* Location controls when audio is recorded */}
            <div className="flex items-center gap-2">
              {!location ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={requestLocation}
                  disabled={isGettingLocation || isSubmitting}
                >
                  {isGettingLocation ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="mr-1 h-4 w-4" />
                  )}
                  Add Location
                </Button>
              ) : (
                <div className="bg-secondary flex items-center gap-1.5 rounded-full py-1 pr-2 pl-2 text-sm">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span className="text-muted-foreground">
                    {location.latitude.toFixed(4)},{' '}
                    {location.longitude.toFixed(4)}
                  </span>
                  <button
                    type="button"
                    onClick={removeLocation}
                    className="text-muted-foreground hover:text-foreground ml-1"
                    disabled={isSubmitting}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {onClose && (
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!canSend || isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1 h-4 w-4" />
          )}
          {isSubmitting ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
