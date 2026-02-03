'use client';

import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import axios from 'axios';
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
import type { PostVisibility } from '@/lib/utils/getVisibility';
import {
  AlertTriangle,
  Send,
  ChevronDown,
  Globe,
  Lock,
  Unlock,
  Check,
  Pencil,
  Eye,
  ImagePlus,
  X,
  Volume2,
  Loader2,
} from 'lucide-react';

interface PostComposerProps {
  inReplyTo?: string;
  replyVisibility?: PostVisibility;
  onSuccess?: () => void;
  placeholder?: string;
}

const MAX_LENGTH = 500;
const MAX_ATTACHMENTS = 4;
const ACCEPTED_FILE_TYPES =
  'image/jpeg,image/png,image/webp,image/gif,audio/webm';

interface UploadedMedia {
  type: string;
  mediaType: string;
  url: string;
  name: string;
}

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
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [attachments, setAttachments] = useState<UploadedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createPost = useCreatePost();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const available = MAX_ATTACHMENTS - attachments.length;
    if (available <= 0) return;

    const filesToUpload = Array.from(files).slice(0, available);
    setUploading(true);

    for (const file of filesToUpload) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post('/api/social/media', formData);
        if (res.data?.success) {
          setAttachments((prev) => [...prev, res.data.data]);
        }
      } catch (error) {
        console.error('Failed to upload media:', error);
      }
    }

    setUploading(false);
    // Reset file input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

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
        attachments: attachments.length > 0 ? attachments : undefined,
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
        <TabsContent value="write" className="mt-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="resize-none font-mono"
          />
          <p className="text-muted-foreground mt-1.5 text-xs">
            Supports Markdown: **bold**, *italic*, [links](url), # headers, -
            lists
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

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div key={i} className="group relative">
              {att.type === 'image' ? (
                <Image
                  src={att.url}
                  alt={att.name || ''}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-md border object-cover"
                  unoptimized
                />
              ) : (
                <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-md border">
                  <Volume2 className="text-muted-foreground h-6 w-6" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="bg-destructive text-destructive-foreground absolute -top-1.5 -right-1.5 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

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
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={attachments.length >= MAX_ATTACHMENTS || uploading}
          >
            {uploading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="mr-1 h-4 w-4" />
            )}
            {attachments.length > 0
              ? `${attachments.length}/${MAX_ATTACHMENTS}`
              : 'Media'}
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
