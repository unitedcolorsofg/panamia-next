'use client';

import { useState, useRef, useEffect } from 'react';
// Phase 3 consent infrastructure — notice for social timeline deletion policy
import { useModuleConsent } from '@/hooks/use-module-consent';
import { ConsentModal } from '@/components/legal/ConsentModal';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Pencil,
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
    icon: Users,
    label: 'Visible to Local Panas',
    description: 'Visible to local Panas only. Not shared via federation.',
    buttonText: 'Visible to Local Panas',
    replyText: 'Reply to Local Panas',
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
    useModuleConsent({ document: 'terms', module: 'social', majorVersion: 0 });

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

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'write' | 'preview')}
      >
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="write" className="flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Write
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Preview
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1">
            {(effectiveVisibility === 'public' ||
              effectiveVisibility === 'unlisted') && (
              <CCLicenseBadge
                value={ccLicense}
                onClick={() => setShowLicensePicker(true)}
              />
            )}
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
        </div>
        <TabsContent value="write" className="mt-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="resize-y font-mono"
          />
          <p className="text-muted-foreground mt-1.5 text-xs">
            **<strong>bold</strong>**, <em>_italic_</em>, [link
            text](example.com), # headers, - lists
          </p>
        </TabsContent>
        <TabsContent value="preview" className="mt-2">
          <div className="min-h-[106px] rounded-md border p-3">
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
        </TabsContent>
      </Tabs>

      <MultiMediaUpload
        value={attachments}
        onChange={setAttachments}
        imageUploadEndpoint="/api/social/media"
        presignEndpoint="/api/social/media/upload"
        pathPrefix="social/media"
      />

      <div className="flex items-center justify-end gap-3">
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
          <Button type="submit" disabled={isDisabled} size="sm">
            <Send className="mr-1 h-4 w-4" />
            {currentOption.replyText}
          </Button>
        ) : (
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
