'use client';

import { useState, useRef, useEffect } from 'react';
// Phase 3 consent infrastructure — notice for social timeline deletion policy
import { useModuleConsent } from '@/hooks/use-module-consent';
import { ConsentModal } from '@/components/legal/ConsentModal';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useCreatePost } from '@/lib/query/social';
import MultiMediaUpload, {
  type UploadedMedia,
} from '@/components/MultiMediaUpload';
import type { PostVisibility } from '@/lib/utils/getVisibility';
import {
  AlertTriangle,
  Send,
  ChevronDown,
  Globe,
  Lock,
  Users,
  Check,
  Eye,
} from 'lucide-react';
import {
  CCLicenseBadge,
  CCLicensePickerModal,
  type CCLicenseValue,
} from '@/components/legal/CCLicensePicker';
import { useDefaultCcLicense } from '@/lib/query/profile';

interface PostComposerProps {
  inReplyTo?: string;
  replyVisibility?: PostVisibility;
  onSuccess?: () => void;
  placeholder?: string;
  /** Viewer's avatar and display name. Supplied by the feed, omitted by the
   *  reply box: a reply already sits under the avatar of the thread it is in,
   *  so repeating the viewer's would add a row to the densest part of the
   *  page. Absent both, the prompt simply starts at the left edge. */
  avatarUrl?: string | null;
  avatarName?: string;
}

const MAX_LENGTH = 500;

const VISIBILITY_OPTIONS: {
  value: PostVisibility;
  icon: typeof Globe;
  label: string;
  description: string;
  buttonText: string;
  replyText: string;
  chipText: string;
}[] = [
  {
    value: 'unlisted',
    icon: Users,
    label: 'Visible to Local Panas',
    description: 'Visible to local Panas only. Not shared via federation.',
    buttonText: 'Visible to Local Panas',
    replyText: 'Reply to Local Panas',
    chipText: 'Local Panas',
  },
  {
    value: 'private',
    icon: Lock,
    label: 'Followers only',
    description: 'Only visible to your followers',
    buttonText: 'Private Post',
    replyText: 'Reply Privately',
    chipText: 'Followers',
  },
  {
    value: 'public',
    icon: Globe,
    label: 'Public',
    description: 'Visible to everyone',
    buttonText: 'Public Post',
    replyText: 'Reply Publicly',
    chipText: 'Everyone',
  },
];

export function PostComposer({
  inReplyTo,
  replyVisibility,
  onSuccess,
  placeholder = "What's on your mind?",
  avatarUrl,
  avatarName,
}: PostComposerProps) {
  const [content, setContent] = useState('');
  const [contentWarning, setContentWarning] = useState('');
  const [showCW, setShowCW] = useState(false);
  const [visibility, setVisibility] = useState<PostVisibility>('unlisted');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [attachments, setAttachments] = useState<UploadedMedia[]>([]);
  // Seed the license from the user's saved default, but stop tracking the
  // default once they explicitly pick one for this post (override).
  const defaultCcLicense = useDefaultCcLicense();
  const [ccLicense, setCcLicense] = useState<CCLicenseValue>(defaultCcLicense);
  const licenseTouched = useRef(false);
  useEffect(() => {
    if (!licenseTouched.current) setCcLicense(defaultCcLicense);
  }, [defaultCcLicense]);
  const handleLicenseChange = (license: CCLicenseValue) => {
    licenseTouched.current = true;
    setCcLicense(license);
  };
  const [showLicensePicker, setShowLicensePicker] = useState(false);
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

  // Phase 3 consent — social timeline deletion notice (soft notice, not a gate)
  // Social posts are always fully deletable regardless of age. This notice
  // informs the user of that policy on first use — it does NOT block posting.
  const { needsConsent: showSocialNotice, recordConsent: onSocialNotice } =
    useModuleConsent({ document: 'terms', module: 'social' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmpty || isOverLimit || createPost.isPending) return;

    try {
      const isPublicPost =
        effectiveVisibility === 'public' || effectiveVisibility === 'unlisted';
      await createPost.mutateAsync({
        content: content.trim(),
        contentWarning:
          showCW && contentWarning.trim() ? contentWarning.trim() : undefined,
        inReplyTo,
        visibility: effectiveVisibility,
        attachments: attachments.length > 0 ? attachments : undefined,
        ...(isPublicPost ? { ccLicense } : {}),
      });
      setContent('');
      setContentWarning('');
      setShowCW(false);
      setAttachments([]);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };

  const isDisabled = isEmpty || isOverLimit || createPost.isPending;
  const isReply = !!inReplyTo;
  const Icon = currentOption.icon;
  const showAvatar = !isReply && (!!avatarUrl || !!avatarName);
  // Same derivation as feed-rail.tsx, so the composer and the sidebar fall
  // back to the same two letters for a member with no picture.
  const initials = avatarName
    ? avatarName
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

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
            className="composer-surface"
          />
        </div>
      )}

      {/* Avatar beside the prompt rather than above it: it costs no vertical
          space there, and it answers "who am I posting as" on an account that
          can switch between a person and a business. */}
      <div className="flex items-start gap-3">
        {showAvatar && (
          <Avatar className="border-pana-ink/10 h-10 w-10 flex-none border-2">
            <AvatarImage src={avatarUrl || undefined} alt="" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1">
          {activeTab === 'write' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder}
              rows={isReply ? 2 : 3}
              aria-label={inReplyTo ? 'Write a reply' : 'Write a post'}
              className="composer-prompt"
            />
          ) : (
            <div className="composer-surface min-h-[76px]">
              {content.trim() ? (
                <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nothing to preview yet...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* One row of controls instead of three. Write/Preview used to be a
          segmented control on its own line above the prompt, and Media a
          button on its own line below it; as chips they share this row with
          everything else and read as one vocabulary. */}
      <div className="composer-actions" data-indent={showAvatar || undefined}>
        <MultiMediaUpload
          value={attachments}
          onChange={setAttachments}
          imageUploadEndpoint="/api/social/media"
          presignEndpoint="/api/social/media/upload"
          pathPrefix="social/media"
          wrapperClassName="composer-media"
          triggerClassName="composer-chip"
        />
        <button
          type="button"
          onClick={() => setShowCW(!showCW)}
          aria-pressed={showCW}
          className="composer-chip"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          CW
        </button>
        <button
          type="button"
          onClick={() =>
            setActiveTab(activeTab === 'preview' ? 'write' : 'preview')
          }
          aria-pressed={activeTab === 'preview'}
          className="composer-chip"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Preview
        </button>
        {(effectiveVisibility === 'public' ||
          effectiveVisibility === 'unlisted') && (
          <CCLicenseBadge
            value={ccLicense}
            onClick={() => setShowLicensePicker(true)}
            className="composer-chip"
          />
        )}

        <div className="composer-actions-end">
          {createPost.isPending ? (
            <Button
              type="button"
              disabled
              size="sm"
              className="bg-pana-indigo text-pana-cream rounded-full px-5 font-extrabold"
            >
              Posting...
            </Button>
          ) : isReply ? (
            <Button
              type="submit"
              disabled={isDisabled}
              size="sm"
              className="bg-pana-indigo text-pana-cream hover:bg-pana-indigo/90 rounded-full px-5 font-extrabold"
            >
              <Send className="mr-1 h-4 w-4" />
              {currentOption.replyText}
            </Button>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {/* Not disabled alongside the Post button: picking who a post
                      is for is a decision people make before typing, and the
                      split control used to lock it until the box had text. */}
                  <button type="button" className="composer-chip">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {currentOption.chipText}
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  </button>
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
              <Button
                type="submit"
                disabled={isDisabled}
                size="sm"
                className="bg-pana-indigo text-pana-cream hover:bg-pana-indigo/90 rounded-full px-5 font-extrabold"
              >
                Post
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Footnote row. The character count used to sit inline with the Post
          button at body size, which gave a number nobody reads until they are
          near the limit the same weight as the action. */}
      <p className="composer-foot" data-indent={showAvatar || undefined}>
        <span>
          **<strong>bold</strong>**, <em>_italic_</em>, [link
          text](example.com), # headers, - lists
        </span>
        <span
          className={
            isOverLimit
              ? 'text-destructive font-bold'
              : charCount > MAX_LENGTH * 0.9
                ? 'font-bold text-yellow-600'
                : undefined
          }
        >
          {charCount}/{MAX_LENGTH}
        </span>
      </p>

      {/* CC License Picker Modal */}
      <CCLicensePickerModal
        open={showLicensePicker}
        onOpenChange={setShowLicensePicker}
        value={ccLicense}
        onChange={handleLicenseChange}
      />

      {/* Phase 3: social timeline deletion notice (type="notice") */}
      <ConsentModal
        open={showSocialNotice}
        type="notice"
        module="social"
        title="Social Timeline"
        description="Your social posts (including replies and attachments) are always fully deletable, including on account deletion. An ActivityPub Delete activity is sent to federation peers (best-effort)."
        policyUrl="/legal/terms/modules/social"
        onConsent={onSocialNotice}
      />
    </form>
  );
}
