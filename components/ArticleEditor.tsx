/**
 * ArticleEditor Component
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Markdown editor with live preview for article creation/editing
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from '@/lib/auth-client';
// Phase 3 consent infrastructure — gate article publishing behind module consent
import { useModuleConsent } from '@/hooks/use-module-consent';
import { ConsentModal } from '@/components/legal/ConsentModal';
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
  Upload,
  Reply,
} from 'lucide-react';
import UserSearch from '@/components/UserSearch';
import ArticleSearch from '@/components/ArticleSearch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CCLicensePicker,
  CCBadge,
  type CCLicenseValue,
} from '@/components/legal/CCLicensePicker';
import { useDefaultCcLicense } from '@/lib/query/profile';

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

interface ReplyToArticle {
  _id: string;
  slug: string;
  title: string;
}

interface ArticleEditorProps {
  mode: 'create' | 'edit';
  initialData?: {
    slug?: string;
    title?: string;
    content?: string;
    articleType?: 'business_update' | 'community_commentary' | 'staff_update';
    tags?: string[];
    coverImage?: string;
    coverImageAlt?: string;
    coAuthors?: CoAuthorInfo[];
    reviewedBy?: ReviewerInfo;
    status?: string;
    inReplyTo?: ReplyToArticle;
    ccLicense?: CCLicenseValue;
  };
  onSave?: (data: Record<string, unknown>) => Promise<void>;
}

export default function ArticleEditor({
  mode,
  initialData = {},
  onSave,
}: ArticleEditorProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;
  const [title, setTitle] = useState(initialData.title || '');
  const [content, setContent] = useState(initialData.content || '');
  const [articleType, setArticleType] = useState<
    'business_update' | 'community_commentary' | 'staff_update'
  >(initialData.articleType || 'community_commentary');
  const [tags, setTags] = useState<string[]>(initialData.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [coverImage, setCoverImage] = useState(initialData.coverImage || '');
  const [coverImageAlt, setCoverImageAlt] = useState(
    initialData.coverImageAlt || ''
  );
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
  const [showPublishWarning, setShowPublishWarning] = useState(false);
  const [articleStatus, setArticleStatus] = useState(
    initialData.status || 'draft'
  );
  const [inReplyTo, setInReplyTo] = useState<ReplyToArticle | null>(
    initialData.inReplyTo || null
  );
  // New articles seed the license from the author's saved default; existing
  // articles keep their stored license. Once the author picks a license for
  // this article, stop tracking the default (per-article override).
  const defaultCcLicense = useDefaultCcLicense();
  const [ccLicense, setCcLicense] = useState<CCLicenseValue>(
    initialData.ccLicense || defaultCcLicense
  );
  const licenseTouched = useRef(false);
  useEffect(() => {
    if (
      mode === 'create' &&
      !initialData.ccLicense &&
      !licenseTouched.current
    ) {
      setCcLicense(defaultCcLicense);
    }
  }, [defaultCcLicense, mode, initialData.ccLicense]);
  const handleLicenseChange = (license: CCLicenseValue) => {
    licenseTouched.current = true;
    setCcLicense(license);
  };

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
    // Accept a single tag or a delimited list (e.g. a pasted
    // "food, miami; local") and split it into individual tags. Splits on
    // commas, semicolons, and newlines only — not spaces, so multi-word tags
    // like "little havana" survive. Deduped and capped at 5.
    const incoming = tagInput
      .split(/[,;\n]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (incoming.length === 0) return;
    setTags((prev) => {
      const next = [...prev];
      for (const tag of incoming) {
        if (next.length >= 5) break;
        if (!next.includes(tag)) next.push(tag);
      }
      return next;
    });
    setTagInput('');
  }, [tagInput]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
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
        coverImageAlt: coverImageAlt || undefined,
        inReplyTo: inReplyTo?._id || undefined,
        ccLicense,
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
          router.push(`/a/${result.data.slug}/edit`);
        }
      }
    } catch (err: unknown) {
      setError(
        (err instanceof Error ? err.message : null) || 'Failed to save article'
      );
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
    } catch (err: unknown) {
      setError(
        (err instanceof Error ? err.message : null) ||
          'Failed to invite co-author'
      );
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
    } catch (err: unknown) {
      setError(
        (err instanceof Error ? err.message : null) ||
          'Failed to request review'
      );
    } finally {
      setRequestingReview(false);
    }
  };

  // Phase 3 consent — archive threshold gate for articles
  // Articles become part of the community record after 3 months. Users must
  // consent to this before their first publish. The consent modal is a hard
  // gate (type="gate") — publishing is blocked until accepted.
  const { needsConsent: needsArticleConsent, recordConsent: onArticleConsent } =
    useModuleConsent({
      document: 'terms',
      module: 'articles',
      majorVersion: 0,
    });

  const handlePublish = async () => {
    if (!initialData.slug) return;

    setPublishing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/articles/${initialData.slug}/publish`,
        {
          method: 'POST',
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setArticleStatus('published');
      router.push(`/a/${initialData.slug}`);
    } catch (err: unknown) {
      setError(
        (err instanceof Error ? err.message : null) ||
          'Failed to publish article'
      );
    } finally {
      setPublishing(false);
    }
  };

  const isStaffUpdate = articleType === 'staff_update';

  // Check if article can be published. Staff updates are admin-authored and
  // skip the co-author/reviewer collaboration gate.
  const canPublish =
    mode === 'edit' &&
    articleStatus !== 'published' &&
    title.trim() &&
    content.trim() &&
    (isStaffUpdate
      ? isAdmin
      : coAuthors.some((ca) => ca.status === 'accepted') ||
        reviewer?.status === 'approved');

  // Pending invites are not credited on publish — only accepted co-authors and
  // an approved reviewer appear on the published article. Surfaced in the
  // "Pending Invitations" list and warned about before publishing.
  const pendingCoAuthors = coAuthors.filter((ca) => ca.status === 'pending');
  const pendingReviewer = reviewer?.status === 'pending' ? reviewer : null;
  const hasPendingInvites = pendingCoAuthors.length > 0 || !!pendingReviewer;

  // Gate publish behind a confirmation when invites are still pending.
  const requestPublish = () => {
    if (hasPendingInvites) {
      setShowPublishWarning(true);
    } else {
      handlePublish();
    }
  };

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
                <Button onClick={requestPublish} disabled={publishing}>
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
          {canPublish && (
            <p className="text-muted-foreground mt-2 text-xs">
              Publishing cross-posts this Article to the{' '}
              <a
                href="/features#resilience"
                className="hover:text-foreground underline underline-offset-2"
              >
                Pana Resilience Network
              </a>
              .
            </p>
          )}
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
                value:
                  'business_update' | 'community_commentary' | 'staff_update'
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
                {/* Staff updates are official Pana MIA posts — admins only. */}
                {(isAdmin || articleType === 'staff_update') && (
                  <SelectItem value="staff_update">Staff Update</SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              {articleType === 'business_update'
                ? 'Self-promotional content about your business, products, or services'
                : articleType === 'staff_update'
                  ? 'Official update from the Pana MIA team. No reviewer required and a co-author is optional.'
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
            {/* Alt text is a detail of the cover image, not a peer field —
                nest it under the URL with an indent and a lighter label so it
                reads as a sub-detail rather than its own top-level input. */}
            <div className="border-muted mt-1 space-y-1 border-l-2 pl-3">
              <Label
                htmlFor="coverImageAlt"
                className="text-muted-foreground text-xs font-normal"
              >
                Alt text (for screen readers)
              </Label>
              <Input
                id="coverImageAlt"
                value={coverImageAlt}
                onChange={(e) => setCoverImageAlt(e.target.value)}
                placeholder="Describe the cover image"
              />
            </div>
          </div>

          {/* In Reply To */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Reply className="h-4 w-4" />
              In Reply To (optional)
            </Label>
            {inReplyTo ? (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 font-medium">
                    {inReplyTo.title}
                  </div>
                  <a
                    href={`/a/${inReplyTo.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View article
                  </a>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setInReplyTo(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <ArticleSearch
                onSelect={(article) =>
                  setInReplyTo({
                    _id: article._id,
                    slug: article.slug,
                    title: article.title,
                  })
                }
                excludeSlug={initialData.slug}
                placeholder="Search for an article to reply to..."
              />
            )}
            <p className="text-sm text-gray-500">
              If this article is a response to another article, select the
              original here.
            </p>
          </div>

          {/* CC License */}
          <div className="space-y-2">
            <Label>License</Label>
            <CCLicensePicker value={ccLicense} onChange={handleLicenseChange} />
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
              {isStaffUpdate
                ? 'Staff updates are official Pana MIA posts. No reviewer is required and a co-author is optional — an admin can publish directly.'
                : 'Before you can publish, your article must have at least one accepted co-author OR be approved by a reviewer. This ensures collaborative quality and accountability.'}
            </p>
            {mode === 'create' && (
              <p className="mt-2 text-sm text-blue-800 dark:text-blue-200">
                Save this draft first — the collaboration tools for inviting a
                co-author or requesting a review appear once the draft exists.
              </p>
            )}
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
                <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
                  By accepting, a co-author agrees to publish under this
                  article&rsquo;s license (<CCBadge license={ccLicense} />
                  ). They can decline the invitation instead.
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

            {/* Reviewers do not apply to staff updates */}
            {!isStaffUpdate && (
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
                        The reviewer has requested revisions. Please address
                        their comments and save your changes. You can view
                        comments on the review page.
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
            )}

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

      {/* Pending Invitations — collaborators who haven't accepted/approved yet.
          Sourced from the article's saved state, so an empty list here means no
          invite is actually recorded (useful for spotting a failed invite). */}
      {mode === 'edit' && initialData.slug && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasPendingInvites ? (
              <ul className="space-y-2">
                {pendingCoAuthors.map((ca) => (
                  <li
                    key={`pending-ca-${ca.userId}`}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <span className="font-medium">
                      @{ca.screenname || 'Unknown'}
                    </span>
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <UserPlus className="h-3 w-3" />
                      Co-author · Pending
                    </Badge>
                  </li>
                ))}
                {pendingReviewer && (
                  <li
                    key={`pending-rv-${pendingReviewer.userId}`}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <span className="font-medium">
                      @{pendingReviewer.screenname || 'Unknown'}
                    </span>
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <ClipboardCheck className="h-3 w-3" />
                      Reviewer · Pending
                    </Badge>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                No pending invitations. Invites you send appear here until the
                recipient accepts or declines.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Warn before publishing while invites are still pending — pending
          collaborators are not credited on the published article. */}
      <AlertDialog
        open={showPublishWarning}
        onOpenChange={setShowPublishWarning}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Publish with pending invitations?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  These invitations are still pending and will{' '}
                  <strong>not</strong> appear as co-authors or reviewers on the
                  published article:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {pendingCoAuthors.map((ca) => (
                    <li key={`warn-ca-${ca.userId}`}>
                      @{ca.screenname || 'Unknown'} — co-author
                    </li>
                  ))}
                  {pendingReviewer && (
                    <li key={`warn-rv-${pendingReviewer.userId}`}>
                      @{pendingReviewer.screenname || 'Unknown'} — reviewer
                    </li>
                  )}
                </ul>
                <p className="mt-2">
                  You can wait for them to respond, or publish now without them.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep waiting</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowPublishWarning(false);
                handlePublish();
              }}
            >
              Publish anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Phase 3: archive threshold consent gate for articles */}
      <ConsentModal
        open={needsArticleConsent}
        type="gate"
        module="articles"
        title="Articles Terms"
        description="Articles are published under a CC license and become part of the community record 3 months after publication. After that threshold, deletion requests are not honored — you may choose to keep attribution or anonymize."
        policyUrl="/legal/terms/modules/articles"
        onConsent={onArticleConsent}
      />
    </div>
  );
}
