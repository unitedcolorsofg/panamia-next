'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useCreatePost } from '@/lib/query/social';
import type { PostVisibility } from '@/lib/utils/getVisibility';
import {
  AlertTriangle,
  Send,
  ChevronDown,
  Globe,
  Lock,
  Unlock,
  Check,
} from 'lucide-react';

interface PostComposerProps {
  inReplyTo?: string;
  replyVisibility?: PostVisibility;
  onSuccess?: () => void;
  placeholder?: string;
}

const MAX_LENGTH = 500;

const VISIBILITY_OPTIONS: {
  value: PostVisibility;
  icon: typeof Globe;
  label: string;
  description: string;
  buttonText: string;
  replyText: string;
}[] = [
  {
    value: 'unlisted',
    icon: Unlock,
    label: 'Visible to All Panas',
    description:
      'Shown to All Panas, Excluded from Public Timeline but still Publicly Accessible.',
    buttonText: 'Visible to All Panas',
    replyText: 'Reply to All Panas',
  },
  {
    value: 'private',
    icon: Lock,
    label: 'Followers only',
    description: 'Only visible to your followers',
    buttonText: 'Private Post',
    replyText: 'Reply Privately',
  },
  {
    value: 'public',
    icon: Globe,
    label: 'Public',
    description: 'Visible to everyone',
    buttonText: 'Public Post',
    replyText: 'Reply Publicly',
  },
];

export function PostComposer({
  inReplyTo,
  replyVisibility,
  onSuccess,
  placeholder = "What's on your mind?",
}: PostComposerProps) {
  const [content, setContent] = useState('');
  const [contentWarning, setContentWarning] = useState('');
  const [showCW, setShowCW] = useState(false);
  const [visibility, setVisibility] = useState<PostVisibility>('unlisted');

  const createPost = useCreatePost();

  const charCount = content.length;
  const isOverLimit = charCount > MAX_LENGTH;
  const isEmpty = content.trim().length === 0;

  // For replies, use parent visibility; for new posts, use selected visibility
  const effectiveVisibility = inReplyTo
    ? (replyVisibility ?? 'unlisted')
    : visibility;

  const currentOption =
    VISIBILITY_OPTIONS.find((o) => o.value === effectiveVisibility) ??
    VISIBILITY_OPTIONS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmpty || isOverLimit || createPost.isPending) return;

    try {
      await createPost.mutateAsync({
        content: content.trim(),
        contentWarning:
          showCW && contentWarning.trim() ? contentWarning.trim() : undefined,
        inReplyTo,
        visibility: effectiveVisibility,
      });
      setContent('');
      setContentWarning('');
      setShowCW(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };

  const isDisabled = isEmpty || isOverLimit || createPost.isPending;
  const isReply = !!inReplyTo;
  const Icon = currentOption.icon;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {showCW && (
        <div className="space-y-1">
          <Label htmlFor="cw" className="text-muted-foreground text-sm">
            Content Warning
          </Label>
          <Input
            id="cw"
            value={contentWarning}
            onChange={(e) => setContentWarning(e.target.value)}
            placeholder="Add a content warning..."
            maxLength={100}
          />
        </div>
      )}

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="resize-none"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowCW(!showCW)}
            className={showCW ? 'text-yellow-600' : ''}
          >
            <AlertTriangle className="mr-1 h-4 w-4" />
            CW
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-sm ${
              isOverLimit
                ? 'text-destructive font-medium'
                : charCount > MAX_LENGTH * 0.9
                  ? 'text-yellow-600'
                  : 'text-muted-foreground'
            }`}
          >
            {charCount}/{MAX_LENGTH}
          </span>

          {createPost.isPending ? (
            <Button type="button" disabled size="sm">
              Posting...
            </Button>
          ) : isReply ? (
            /* Replies: plain button with context-aware text, no dropdown */
            <Button type="submit" disabled={isDisabled} size="sm">
              <Send className="mr-1 h-4 w-4" />
              {currentOption.replyText}
            </Button>
          ) : (
            /* New posts: split-button with visibility dropdown */
            <div className="flex">
              <Button
                type="submit"
                disabled={isDisabled}
                size="sm"
                className="rounded-r-none"
              >
                <Icon className="mr-1 h-4 w-4" />
                {currentOption.buttonText}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    disabled={isDisabled}
                    size="sm"
                    className="rounded-l-none border-l px-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  {VISIBILITY_OPTIONS.map((option) => {
                    const OptionIcon = option.icon;
                    const selected = visibility === option.value;
                    return (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => setVisibility(option.value)}
                        className="flex cursor-pointer items-start gap-3 py-2"
                      >
                        <OptionIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{option.label}</span>
                            {selected && <Check className="h-4 w-4 shrink-0" />}
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {option.description}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
