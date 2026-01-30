'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreatePost } from '@/lib/query/social';
import { AlertTriangle, Send } from 'lucide-react';

interface PostComposerProps {
  inReplyTo?: string;
  onSuccess?: () => void;
  placeholder?: string;
}

const MAX_LENGTH = 500;

export function PostComposer({
  inReplyTo,
  onSuccess,
  placeholder = "What's on your mind?",
}: PostComposerProps) {
  const [content, setContent] = useState('');
  const [contentWarning, setContentWarning] = useState('');
  const [showCW, setShowCW] = useState(false);

  const createPost = useCreatePost();

  const charCount = content.length;
  const isOverLimit = charCount > MAX_LENGTH;
  const isEmpty = content.trim().length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmpty || isOverLimit || createPost.isPending) return;

    try {
      await createPost.mutateAsync({
        content: content.trim(),
        contentWarning:
          showCW && contentWarning.trim() ? contentWarning.trim() : undefined,
        inReplyTo,
      });
      setContent('');
      setContentWarning('');
      setShowCW(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };

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
          <Button
            type="submit"
            disabled={isEmpty || isOverLimit || createPost.isPending}
            size="sm"
          >
            {createPost.isPending ? (
              'Posting...'
            ) : (
              <>
                <Send className="mr-1 h-4 w-4" />
                {inReplyTo ? 'Reply' : 'Post'}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
