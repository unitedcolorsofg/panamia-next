/**
 * ArticleMastodonSettings Component
 *
 * Allows article authors to link a Mastodon toot for comments.
 * Only shown to the primary author of published articles.
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings,
  MessageCircle,
  Loader2,
  Check,
  ExternalLink,
  X,
} from 'lucide-react';

interface ArticleMastodonSettingsProps {
  slug: string;
  authorId: string;
}

export default function ArticleMastodonSettings({
  slug,
  authorId,
}: ArticleMastodonSettingsProps) {
  const { data: session } = useSession();
  const [isAuthor, setIsAuthor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tootUrl, setTootUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Check if current user is the author
  useEffect(() => {
    async function checkAuthor() {
      if (!session?.user?.email) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/user/me');
        const data = await res.json();
        if (data.success && data.data._id === authorId) {
          setIsAuthor(true);
          // Fetch current toot URL
          const settingsRes = await fetch(`/api/articles/${slug}/mastodon`);
          const settingsData = await settingsRes.json();
          if (settingsData.success && settingsData.data.mastodonTootUrl) {
            setSavedUrl(settingsData.data.mastodonTootUrl);
            setTootUrl(settingsData.data.mastodonTootUrl);
          }
        }
      } catch (err) {
        console.error('Failed to check author status:', err);
      } finally {
        setLoading(false);
      }
    }

    checkAuthor();
  }, [session, authorId, slug]);

  async function handleSave() {
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const res = await fetch(`/api/articles/${slug}/mastodon`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mastodonTootUrl: tootUrl || null }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setSavedUrl(data.data.mastodonTootUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setTootUrl('');
  }

  // Don't show anything if not the author
  if (loading || !isAuthor) {
    return null;
  }

  return (
    <div className="mt-8 border-t border-gray-200 pt-8 dark:border-gray-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-800"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-500" />
          <span className="font-medium">Author Settings</span>
          {savedUrl && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <MessageCircle className="h-4 w-4" />
              Comments enabled
            </span>
          )}
        </div>
        <span className="text-sm text-gray-500">
          {expanded ? 'Hide' : 'Show'}
        </span>
      </button>

      {expanded && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5" />
              Mastodon Comments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Enable comments by linking a Mastodon toot that announces this
              article. Replies to your toot will appear as comments below your
              article.
            </p>

            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
              <h4 className="mb-2 font-medium text-blue-900 dark:text-blue-100">
                How to enable comments:
              </h4>
              <ol className="list-inside list-decimal space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <li>Share this article on your Mastodon account</li>
                <li>Copy the URL of your toot</li>
                <li>Paste it below and save</li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tootUrl">Mastodon Toot URL</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="tootUrl"
                    type="url"
                    value={tootUrl}
                    onChange={(e) => setTootUrl(e.target.value)}
                    placeholder="https://mastodon.social/@you/123456789"
                    className="pr-8"
                  />
                  {tootUrl && (
                    <button
                      onClick={handleClear}
                      className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : success ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : null}
                  {saving ? 'Saving...' : success ? 'Saved!' : 'Save'}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Supported formats: https://instance.tld/@user/123456789
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            {savedUrl && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="flex-1 text-sm text-green-700 dark:text-green-300">
                  Comments are enabled from your Mastodon post
                </span>
                <a
                  href={savedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 hover:underline dark:text-green-400"
                >
                  View toot
                  <ExternalLink className="ml-1 inline h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
