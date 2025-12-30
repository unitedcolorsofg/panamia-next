/**
 * ArticleEditor Component
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Markdown editor with live preview for article creation/editing
 */

'use client';

import { useState, useCallback } from 'react';
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
import { Save, Eye, Edit3, X, Loader2 } from 'lucide-react';

interface ArticleEditorProps {
  mode: 'create' | 'edit';
  initialData?: {
    slug?: string;
    title?: string;
    content?: string;
    articleType?: 'business_update' | 'community_commentary';
    tags?: string[];
    coverImage?: string;
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
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
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
    </div>
  );
}
