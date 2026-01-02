/**
 * ArticleEditor Component
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Markdown editor with live preview for article creation/editing
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  Eye,
  Edit3,
  X,
  Loader2,
  UserPlus,
  ClipboardCheck,
  Users,
  Clock,
  Check,
  XCircle,
  Send,
  Upload,
} from 'lucide-react';
import UserSearch from '@/components/UserSearch';

interface CoAuthorInfo {
  userId: string;
  screenname?: string;
  status: 'pending' | 'accepted' | 'declined';
}

interface ReviewerInfo {
  userId: string;
  screenname?: string;
  status: 'pending' | 'approved' | 'revision_needed';
}

interface ArticleEditorProps {
  mode: 'create' | 'edit';
  initialData?: {
    slug?: string;
    title?: string;
    content?: string;
    articleType?: 'business_update' | 'community_commentary';
    tags?: string[];
    coverImage?: string;
    coAuthors?: CoAuthorInfo[];
    reviewedBy?: ReviewerInfo;
    status?: string;
  };
  onSave?: (data: any) => Promise<void>;
}

export default function ArticleEditor({
  mode,
  initialData = {},
  onSave,
}: ArticleEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData.title || '');
  const [content, setContent] = useState(initialData.content || '');
  const [articleType, setArticleType] = useState<
    'business_update' | 'community_commentary'
  >(initialData.articleType || 'community_commentary');
  const [tags, setTags] = useState<string[]>(initialData.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [coverImage, setCoverImage] = useState(initialData.coverImage || '');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collaboration state
  const [coAuthors, setCoAuthors] = useState<CoAuthorInfo[]>(
    initialData.coAuthors || []
  );
  const [reviewer, setReviewer] = useState<ReviewerInfo | null>(
    initialData.reviewedBy || null
  );
  const [invitationMessage, setInvitationMessage] = useState('');
  const [inviting, setInviting] = useState(false);
  const [requestingReview, setRequestingReview] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [articleStatus, setArticleStatus] = useState(
    initialData.status || 'draft'
  );

  // Fetch current user ID for excluding from search
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const res = await fetch('/api/user/me');
        const data = await res.json();
        if (data.success) {
          setCurrentUserId(data.data._id);
        }
      } catch (err) {
        console.error('Failed to fetch current user:', err);
      }
    }
    if (mode === 'edit') {
      fetchCurrentUser();
    }
  }, [mode]);

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  const handleSave = async () => {
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);

    try {
      const data = {
        title: title.trim(),
        content,
        articleType,
        tags,
        coverImage: coverImage || undefined,
      };

      if (onSave) {
        await onSave(data);
      } else {
        // Default save behavior
        const url =
          mode === 'create'
            ? '/api/articles'
            : `/api/articles/${initialData.slug}`;
        const method = mode === 'create' ? 'POST' : 'PATCH';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to save article');
        }

        // Redirect to edit page for new articles, or stay on page for edits
        if (mode === 'create') {
          router.push(`/articles/${result.data.slug}/edit`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const handleInviteCoAuthor = async (user: {
    _id: string;
    screenname: string;
  }) => {
    if (!initialData.slug) return;

    setInviting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/articles/${initialData.slug}/coauthors/invite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user._id,
            message: invitationMessage || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setCoAuthors([
        ...coAuthors,
        { userId: user._id, screenname: user.screenname, status: 'pending' },
      ]);
      setInvitationMessage('');
    } catch (err: any) {
      setError(err.message || 'Failed to invite co-author');
    } finally {
      setInviting(false);
    }
  };

  const handleRequestReview = async (user: {
    _id: string;
    screenname: string;
  }) => {
    if (!initialData.slug) return;

    setRequestingReview(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/articles/${initialData.slug}/review/request`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewerId: user._id }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setReviewer({
        userId: user._id,
        screenname: user.screenname,
        status: 'pending',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to request review');
    } finally {
      setRequestingReview(false);
    }
  };

  const handlePublish = async () => {
    if (!initialData.slug) return;

    setPublishing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/articles/${initialData.slug}/publish`,
        { method: 'POST' }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setArticleStatus('published');
      router.push(`/articles/${initialData.slug}`);
    } catch (err: any) {
      setError(err.message || 'Failed to publish article');
    } finally {
      setPublishing(false);
    }
  };

  // Check if article can be published
  const canPublish =
    mode === 'edit' &&
    articleStatus !== 'published' &&
    title.trim() &&
    content.trim() &&
    (coAuthors.some((ca) => ca.status === 'accepted') ||
      reviewer?.status === 'approved');

  // IDs to exclude from user search (current user, existing co-authors, reviewer)
  const excludedUserIds = [
    currentUserId,
    ...coAuthors.map((ca) => ca.userId),
    reviewer?.userId,
  ].filter(Boolean) as string[];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'accepted':
      case 'approved':
        return <Check className="h-3 w-3 text-green-500" />;
      case 'declined':
      case 'revision_needed':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'accepted':
        return 'Accepted';
      case 'approved':
        return 'Approved';
      case 'declined':
        return 'Declined';
      case 'revision_needed':
        return 'Revision Needed';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{mode === 'create' ? 'New Article' : 'Edit Article'}</span>
            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={saving} variant="outline">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              {canPublish && (
                <Button onClick={handlePublish} disabled={publishing}>
                  {publishing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {publishing ? 'Publishing...' : 'Publish'}
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter article title..."
              maxLength={200}
            />
          </div>

          {/* Article Type */}
          <div className="space-y-2">
            <Label htmlFor="articleType">Article Type</Label>
            <Select
              value={articleType}
              onValueChange={(
                value: 'business_update' | 'community_commentary'
              ) => setArticleType(value)}
            >
              <SelectTrigger id="articleType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="community_commentary">
                  Community Commentary
                </SelectItem>
                <SelectItem value="business_update">Business Update</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              {articleType === 'business_update'
                ? 'Self-promotional content about your business, products, or services'
                : 'Opinion, analysis, or local interest content'}
            </p>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (up to 5)</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag..."
                disabled={tags.length >= 5}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddTag}
                disabled={tags.length >= 5 || !tagInput.trim()}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <Label htmlFor="coverImage">Cover Image URL (optional)</Label>
            <Input
              id="coverImage"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>

          {/* Content Editor with Preview */}
          <div className="space-y-2">
            <Label>Content (Markdown)</Label>
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'write' | 'preview')}
            >
              <TabsList>
                <TabsTrigger value="write">
                  <Edit3 className="mr-2 h-4 w-4" />
                  Write
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </TabsTrigger>
              </TabsList>
              <TabsContent value="write" className="mt-2">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your article content in Markdown..."
                  className="min-h-[400px] font-mono"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Supports Markdown: **bold**, *italic*, [links](url), #
                  headers, - lists, etc.
                </p>
              </TabsContent>
              <TabsContent value="preview" className="mt-2">
                <div className="min-h-[400px] rounded-md border bg-white p-4 dark:bg-gray-950">
                  {content ? (
                    <article className="prose dark:prose-invert max-w-none">
                      <ReactMarkdown>{content}</ReactMarkdown>
                    </article>
                  ) : (
                    <p className="text-gray-400">Nothing to preview yet...</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Publishing Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-950">
            <h3 className="font-medium text-blue-900 dark:text-blue-100">
              Publishing Requirements
            </h3>
            <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
              Before you can publish, your article must have at least one
              accepted co-author OR be approved by a reviewer. This ensures
              collaborative quality and accountability.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Collaboration Panel - Only in edit mode */}
      {mode === 'edit' && initialData.slug && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Collaboration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Co-Authors Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                <h3 className="font-medium">Co-Authors</h3>
              </div>

              {/* Current Co-Authors */}
              {coAuthors.length > 0 && (
                <div className="space-y-2">
                  {coAuthors.map((ca) => (
                    <div
                      key={ca.userId}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <span className="font-medium">
                        @{ca.screenname || 'Unknown'}
                      </span>
                      <Badge
                        variant={
                          ca.status === 'accepted'
                            ? 'default'
                            : ca.status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                        }
                        className="flex items-center gap-1"
                      >
                        {getStatusIcon(ca.status)}
                        {getStatusLabel(ca.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Invite Co-Author */}
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Invite someone to collaborate on this article:
                </p>
                <UserSearch
                  onSelect={handleInviteCoAuthor}
                  excludeIds={excludedUserIds}
                  placeholder="Search for a user to invite..."
                />
                <Textarea
                  value={invitationMessage}
                  onChange={(e) => setInvitationMessage(e.target.value)}
                  placeholder="Add a personal message (optional)..."
                  className="min-h-[60px]"
                />
                {inviting && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending invitation...
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              {/* Reviewer Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  <h3 className="font-medium">Review</h3>
                </div>

                {/* Current Reviewer */}
                {reviewer ? (
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <span className="font-medium">
                      @{reviewer.screenname || 'Unknown'}
                    </span>
                    <Badge
                      variant={
                        reviewer.status === 'approved'
                          ? 'default'
                          : reviewer.status === 'pending'
                            ? 'secondary'
                            : 'destructive'
                      }
                      className="flex items-center gap-1"
                    >
                      {getStatusIcon(reviewer.status)}
                      {getStatusLabel(reviewer.status)}
                    </Badge>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">
                      Request a review from another community member:
                    </p>
                    <UserSearch
                      onSelect={handleRequestReview}
                      excludeIds={excludedUserIds}
                      placeholder="Search for a reviewer..."
                    />
                    {requestingReview && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Requesting review...
                      </div>
                    )}
                  </>
                )}

                {/* Review status info */}
                {reviewer?.status === 'revision_needed' && (
                  <div className="rounded-md bg-yellow-50 p-3 dark:bg-yellow-950">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      The reviewer has requested revisions. Please address their
                      comments and save your changes. You can view comments on
                      the review page.
                    </p>
                  </div>
                )}

                {reviewer?.status === 'approved' && (
                  <div className="rounded-md bg-green-50 p-3 dark:bg-green-950">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Your article has been approved! You can now publish it.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Publishing Status Summary */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2">
                {coAuthors.some((ca) => ca.status === 'accepted') ||
                reviewer?.status === 'approved' ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      Ready to publish
                    </span>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Waiting for co-author acceptance or reviewer approval
                    </span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
