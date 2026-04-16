'use client';

import { useEffect, useState, FormEvent, useCallback } from 'react';

interface GhlContactData {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: string;
  tags?: string[];
  dnd?: boolean;
}
import { useSession } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { getUserSession, saveUserSession } from '@/lib/user';
import { UserInterface } from '@/lib/interfaces';
import { Mail, AlertCircle, Check, X, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function UserEditPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { t } = useTranslation('toast');
  const [sessionEmail, setSessionEmail] = useState('');
  const [sessionZipCode, setSessionZipCode] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [userData, setUserData] = useState({} as UserInterface);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [sessionScreenname, setSessionScreenname] = useState('');
  const [screennameStatus, setScreennameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [screennameError, setScreennameError] = useState('');

  const setUserSession = async () => {
    const userSession = await getUserSession();
    if (userSession) {
      setSessionEmail(userSession.email == null ? '' : userSession.email);
      setSessionZipCode(
        userSession.zip_code == null ? '' : userSession.zip_code
      );
      setSessionName(userSession.name == null ? '' : userSession.name);
      setSessionScreenname(
        userSession.screenname == null ? '' : userSession.screenname
      );
      setUserData(userSession);
    }
  };

  const checkScreennameAvailability = useCallback(async (name: string) => {
    if (!name || name.length < 3) {
      setScreennameStatus('idle');
      setScreennameError('');
      return;
    }

    setScreennameStatus('checking');
    setScreennameError('');

    try {
      const response = await fetch(
        `/api/user/screenname/check?name=${encodeURIComponent(name)}`
      );
      const data = await response.json();

      if (data.available) {
        setScreennameStatus('available');
        setScreennameError('');
      } else {
        setScreennameStatus(
          data.error?.includes('taken') ? 'taken' : 'invalid'
        );
        setScreennameError(data.error || 'Invalid screenname');
      }
    } catch {
      setScreennameStatus('idle');
      setScreennameError('Could not check availability');
    }
  }, []);

  // Debounce screenname check
  useEffect(() => {
    // Skip check if screenname matches the current saved value
    if (sessionScreenname === userData?.screenname) {
      setScreennameStatus('idle');
      setScreennameError('');
      return;
    }

    const timer = setTimeout(() => {
      checkScreennameAvailability(sessionScreenname);
    }, 500);

    return () => clearTimeout(timer);
  }, [sessionScreenname, userData?.screenname, checkScreennameAvailability]);

  const [showScreennameConfirmDialog, setShowScreennameConfirmDialog] =
    useState(false);

  const [ghlContact, setGhlContact] = useState<GhlContactData | null | 'empty'>(
    null
  );
  const [ghlLoading, setGhlLoading] = useState(false);
  const [ghlActionLoading, setGhlActionLoading] = useState<string | null>(null);
  const [showDeleteContactDialog, setShowDeleteContactDialog] = useState(false);
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);

  // Check if screenname is actually changing
  const isScreennameChanging =
    sessionScreenname &&
    userData?.screenname &&
    sessionScreenname.toLowerCase() !== userData.screenname.toLowerCase();

  const updateUserSession = async (skipScreennameConfirm = false) => {
    // Validate screenname before saving if it changed
    if (
      sessionScreenname &&
      sessionScreenname !== userData?.screenname &&
      screennameStatus !== 'available'
    ) {
      setMessage('Please choose an available screenname before saving.');
      return;
    }

    // Show confirmation dialog if changing screenname (and user has existing one)
    if (isScreennameChanging && !skipScreennameConfirm) {
      setShowScreennameConfirmDialog(true);
      return;
    }

    setIsLoading(true);
    setMessage('');
    try {
      const response = await saveUserSession({
        name: sessionName,
        zip_code: sessionZipCode,
        screenname: sessionScreenname || undefined,
      });
      console.log('updateUserSession:response', response);
      setMessage('Settings updated successfully!');
      // Update userData to reflect saved screenname
      if (response) {
        setUserData(response);
      }
    } catch (error: unknown) {
      // Check if it's a rate limit error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('You can change your screenname again on')) {
        setMessage(errorMessage);
      } else {
        setMessage('Failed to update settings. Please try again.');
      }
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmScreennameChange = () => {
    setShowScreennameConfirmDialog(false);
    updateUserSession(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateUserSession();
  };

  const fetchGhlContact = async () => {
    if (ghlContact !== null) return;
    setGhlLoading(true);
    try {
      const res = await fetch('/api/crm/contact');
      const data = await res.json();
      setGhlContact(res.ok ? (data.data ?? 'empty') : 'empty');
      if (!res.ok) {
        toast({
          title: 'Error',
          description: 'Could not reach HighLevel, please try again later.',
          variant: 'destructive',
        });
      }
    } catch {
      setGhlContact('empty');
      toast({
        title: 'Error',
        description: 'Could not reach HighLevel, please try again later.',
        variant: 'destructive',
      });
    } finally {
      setGhlLoading(false);
    }
  };

  const handleGhlUnsubscribe = async () => {
    setShowUnsubscribeDialog(false);
    setGhlActionLoading('unsubscribe');
    try {
      const res = await fetch('/api/crm/contact/unsubscribe', {
        method: 'POST',
      });
      if (res.ok) {
        setGhlContact((prev) =>
          prev && prev !== 'empty' ? { ...prev, dnd: true } : prev
        );
        toast({
          title: 'Unsubscribed',
          description:
            'You have been removed from all HighLevel communications.',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Could not reach HighLevel, please try again later.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Could not reach HighLevel, please try again later.',
        variant: 'destructive',
      });
    } finally {
      setGhlActionLoading(null);
    }
  };

  const handleGhlSubscribe = async () => {
    setGhlActionLoading('subscribe');
    try {
      const res = await fetch('/api/crm/contact/subscribe', {
        method: 'POST',
      });
      if (res.ok) {
        setGhlContact((prev) =>
          prev && prev !== 'empty' ? { ...prev, dnd: false } : prev
        );
        toast({
          title: 'Subscribed',
          description: 'You will once again receive Panamia communications.',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Could not reach HighLevel, please try again later.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Could not reach HighLevel, please try again later.',
        variant: 'destructive',
      });
    } finally {
      setGhlActionLoading(null);
    }
  };

  const handleGhlDeleteContact = async () => {
    setShowDeleteContactDialog(false);
    setGhlActionLoading('delete');
    try {
      const res = await fetch('/api/crm/contact', { method: 'DELETE' });
      if (res.ok) {
        setGhlContact('empty');
        toast({
          title: 'Marketing data deleted',
          description: 'Your marketing record has been removed.',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Could not reach HighLevel, please try again later.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Could not reach HighLevel, please try again later.',
        variant: 'destructive',
      });
    } finally {
      setGhlActionLoading(null);
    }
  };

  const handleGhlTriggerTestWorkflow = async () => {
    setGhlActionLoading('test-workflow');
    try {
      const res = await fetch('/api/crm/contact/enroll', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Workflow triggered',
          description: `Enrolled in workflow ${data.workflowId}.`,
        });
      } else {
        toast({
          title: 'Error',
          description:
            data.error || 'Could not reach HighLevel, please try again later.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Could not reach HighLevel, please try again later.',
        variant: 'destructive',
      });
    } finally {
      setGhlActionLoading(null);
    }
  };

  const handleGhlCopyField = async (field: 'name' | 'phone') => {
    setGhlActionLoading(`copy-${field}`);
    try {
      const res = await fetch('/api/crm/contact/copy-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Copied',
          description: `${field === 'name' ? 'Name' : 'Phone'} copied to your profile.`,
        });
      } else {
        toast({
          title: 'Error',
          description:
            data.error || 'Could not reach HighLevel, please try again later.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Could not reach HighLevel, please try again later.',
        variant: 'destructive',
      });
    } finally {
      setGhlActionLoading(null);
    }
  };

  const handleEmailMigration = async () => {
    if (!newEmail || newEmail === sessionEmail) {
      toast({
        title: t('invalidEmail'),
        description: t('invalidEmailDiffDesc'),
        variant: 'destructive',
      });
      return;
    }

    setIsMigrating(true);
    setShowMigrationDialog(false);

    try {
      const response = await fetch('/api/user/request-email-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: t('verificationEmailSent'),
          description: t('verificationEmailSentDesc', { email: newEmail }),
        });
        setNewEmail('');
      } else {
        toast({
          title: t('migrationFailed'),
          description: data.error || t('migrationFailedDefault'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: t('unexpectedError'),
        variant: 'destructive',
      });
      console.error('Email migration error:', error);
    } finally {
      setIsMigrating(false);
    }
  };

  // Depend on the user id, not the session object — even with the memoized
  // useSession() shim, narrowing to a primitive prevents accidental re-fires
  // if the shim is ever changed.
  const sessionUserId = session?.user?.id;
  useEffect(() => {
    if (sessionUserId) {
      setUserSession();
    }
  }, [sessionUserId]);

  if (!session) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Unauthorized</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                You must be logged in to view this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Update Your Account Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="text"
                  value={sessionEmail}
                  readOnly
                  disabled
                  className="bg-gray-100 dark:bg-gray-800"
                />
                <p className="text-sm text-gray-500">
                  Email verified. Sign out to use a different account.
                </p>
              </div>

              {/* Name/Nickname */}
              <div className="space-y-2">
                <Label htmlFor="name">Name/Nickname</Label>
                <Input
                  id="name"
                  type="text"
                  value={sessionName}
                  maxLength={60}
                  autoComplete="name"
                  onChange={(e) => setSessionName(e.target.value)}
                />
                <p className="text-sm text-gray-500">
                  Optional. Displayed publicly alongside your screenname on
                  contributions.
                </p>
              </div>

              {/* Screenname */}
              <div className="space-y-2">
                <Label htmlFor="screenname">Screenname</Label>
                <div className="relative">
                  <Input
                    id="screenname"
                    type="text"
                    value={sessionScreenname}
                    maxLength={24}
                    autoComplete="username"
                    onChange={(e) => setSessionScreenname(e.target.value)}
                    className={
                      screennameStatus === 'available'
                        ? 'border-green-500 pr-10'
                        : screennameStatus === 'taken' ||
                            screennameStatus === 'invalid'
                          ? 'border-red-500 pr-10'
                          : 'pr-10'
                    }
                    placeholder="Choose a unique screenname"
                  />
                  <div className="absolute top-1/2 right-3 -translate-y-1/2">
                    {screennameStatus === 'checking' && (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    )}
                    {screennameStatus === 'available' && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    {(screennameStatus === 'taken' ||
                      screennameStatus === 'invalid') && (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
                {screennameError && (
                  <p className="text-sm text-red-500">{screennameError}</p>
                )}
                <p className="text-sm text-gray-500">
                  Required for contributions. 3-24 characters, letters, numbers,
                  underscores, and hyphens only.
                </p>
              </div>

              {/* Privacy Notice */}
              <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Your screenname and name (if provided) will be publicly
                  displayed on your contributions. Your email address is private
                  and will not be shown to other users.
                </p>
              </div>

              {/* Zip Code */}
              <div className="space-y-2">
                <Label htmlFor="zipcode">Zip Code</Label>
                <Input
                  id="zipcode"
                  type="text"
                  value={sessionZipCode}
                  maxLength={10}
                  autoComplete="postal-code"
                  onChange={(e) => setSessionZipCode(e.target.value)}
                />
                <p className="text-sm text-gray-500">
                  Used to personalize search results and site features.
                </p>
              </div>

              {message && (
                <p
                  className={`text-sm ${
                    message.includes('success')
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {message}
                </p>
              )}

              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update'}
              </Button>

              {userData?.affiliate?.code && (
                <div className="pt-4 text-sm text-gray-500" hidden>
                  Affiliate Code: {userData.affiliate.code}
                </div>
              )}
            </form>

            {/* Screenname Change Confirmation Dialog */}
            <AlertDialog
              open={showScreennameConfirmDialog}
              onOpenChange={setShowScreennameConfirmDialog}
            >
              <AlertDialogContent className="bg-white dark:bg-zinc-900">
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Screenname Change</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <p>
                      <strong>Current screenname:</strong> @
                      {userData?.screenname}
                    </p>
                    <p>
                      <strong>New screenname:</strong> @{sessionScreenname}
                    </p>
                    <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950">
                      <div className="flex gap-2">
                        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="space-y-2 text-sm">
                          <p className="font-semibold text-amber-800 dark:text-amber-200">
                            Important Information
                          </p>
                          <ul className="list-disc space-y-1 pl-5 text-amber-700 dark:text-amber-300">
                            <li>
                              <strong>
                                All timeline posts and direct messages will be
                                deleted.
                              </strong>
                            </li>
                            <li>
                              Contributed articles will be automatically updated
                              with your new screenname.
                            </li>
                            <li>
                              Your old screenname will be reserved and cannot be
                              claimed by others.
                            </li>
                            <li>
                              You can only change your screenname once every 90
                              days.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleConfirmScreennameChange}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    Confirm Change
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Email Migration Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Advanced Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion
              type="single"
              collapsible
              onValueChange={(v) => {
                if (v === 'marketing-data') fetchGhlContact();
              }}
            >
              <AccordionItem value="change-email">
                <AccordionTrigger>Change Email Address</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950">
                      <div className="flex gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        <div className="space-y-2 text-sm">
                          <p className="font-semibold text-amber-800 dark:text-amber-200">
                            Important Information
                          </p>
                          <ul className="list-disc space-y-1 pl-5 text-amber-700 dark:text-amber-300">
                            <li>
                              You will receive a verification link at your new
                              email address
                            </li>
                            <li>The verification link expires in 5 minutes</li>
                            <li>
                              You will be signed out of all devices when the
                              migration completes
                            </li>
                            <li>
                              A confirmation will be sent to your current email
                              address
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-email">New Email Address</Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter new email address"
                        disabled={isMigrating}
                      />
                    </div>

                    <AlertDialog
                      open={showMigrationDialog}
                      onOpenChange={setShowMigrationDialog}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={!newEmail || isMigrating}
                        >
                          {isMigrating
                            ? 'Sending Verification...'
                            : 'Change Email'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-white dark:bg-zinc-900">
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Confirm Email Migration
                          </AlertDialogTitle>
                          <AlertDialogDescription className="space-y-3">
                            <p>
                              <strong>Current email:</strong> {sessionEmail}
                            </p>
                            <p>
                              <strong>New email:</strong> {newEmail}
                            </p>
                            <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950">
                              <p className="mb-2 font-semibold text-amber-900 dark:text-amber-100">
                                What happens next:
                              </p>
                              <ol className="list-decimal space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-200">
                                <li>
                                  We'll send a verification link to{' '}
                                  <strong>{newEmail}</strong>
                                </li>
                                <li>You must click it within 5 minutes</li>
                                <li>You'll be signed out of all devices</li>
                                <li>
                                  A confirmation will be sent to{' '}
                                  <strong>{sessionEmail}</strong>
                                </li>
                              </ol>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleEmailMigration}>
                            Send Verification Link
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="marketing-data">
                <AccordionTrigger>Marketing Data (HighLevel)</AccordionTrigger>
                <AccordionContent>
                  {ghlLoading || ghlContact === null ? (
                    <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  ) : ghlContact === 'empty' ? (
                    <p className="text-muted-foreground py-4 text-sm">
                      No marketing data on file.
                    </p>
                  ) : (
                    <div className="space-y-4 pt-2">
                      <dl className="space-y-2 text-sm">
                        {(ghlContact.firstName || ghlContact.lastName) && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Name</dt>
                            <dd>
                              {[ghlContact.firstName, ghlContact.lastName]
                                .filter(Boolean)
                                .join(' ')}
                            </dd>
                          </div>
                        )}
                        {ghlContact.email && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Email</dt>
                            <dd>{ghlContact.email}</dd>
                          </div>
                        )}
                        {ghlContact.phone && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Phone</dt>
                            <dd>{ghlContact.phone}</dd>
                          </div>
                        )}
                        {ghlContact.source && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">
                              Lead source
                            </dt>
                            <dd>{ghlContact.source}</dd>
                          </div>
                        )}
                        {ghlContact.tags && ghlContact.tags.length > 0 && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Tags</dt>
                            <dd className="text-right">
                              {ghlContact.tags.join(', ')}
                            </dd>
                          </div>
                        )}
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted-foreground">
                            Marketing emails
                          </dt>
                          <dd>
                            {ghlContact.dnd ? 'Unsubscribed' : 'Subscribed'}
                          </dd>
                        </div>
                      </dl>
                      <p className="text-muted-foreground text-xs">
                        Changes may take up to 24 hours to become effective. See
                        our{' '}
                        <Link
                          href="/legal/privacy#sharing"
                          className="underline"
                        >
                          Privacy Policy
                        </Link>{' '}
                        for details on how marketing data is shared.
                      </p>
                      <div className="flex flex-wrap gap-2 border-t pt-4">
                        {(ghlContact.firstName || ghlContact.lastName) && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!!ghlActionLoading}
                            onClick={() => handleGhlCopyField('name')}
                          >
                            {ghlActionLoading === 'copy-name' && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            Copy name to profile
                          </Button>
                        )}
                        {ghlContact.phone && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!!ghlActionLoading}
                            onClick={() => handleGhlCopyField('phone')}
                          >
                            {ghlActionLoading === 'copy-phone' && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            Copy phone to profile
                          </Button>
                        )}
                        {ghlContact.dnd ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!!ghlActionLoading}
                            onClick={handleGhlSubscribe}
                          >
                            {ghlActionLoading === 'subscribe' && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            Subscribe
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!!ghlActionLoading}
                            onClick={() => setShowUnsubscribeDialog(true)}
                          >
                            {ghlActionLoading === 'unsubscribe' && (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            Unsubscribe
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!!ghlActionLoading}
                          onClick={handleGhlTriggerTestWorkflow}
                        >
                          {ghlActionLoading === 'test-workflow' && (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          )}
                          Trigger test workflow
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={!!ghlActionLoading}
                          onClick={() => setShowDeleteContactDialog(true)}
                        >
                          {ghlActionLoading === 'delete' && (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          )}
                          Delete marketing data
                        </Button>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <AlertDialog
              open={showUnsubscribeDialog}
              onOpenChange={setShowUnsubscribeDialog}
            >
              {/* Explicit bg-white / dark:bg-zinc-900 — bg-background can appear
                  transparent due to CSS layer specificity (see ConsentModal.tsx) */}
              <AlertDialogContent className="bg-white dark:bg-zinc-900">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Unsubscribe from All Marketing
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This is a complete opt-out of <strong>all</strong> Panamia
                    messages — including announcements, newsletters, and
                    communications about non-website projects — across email,
                    SMS, WhatsApp, and calls. The only messages you&apos;ll
                    still receive are email sign-in links you request yourself.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGhlUnsubscribe}>
                    Unsubscribe
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
              open={showDeleteContactDialog}
              onOpenChange={setShowDeleteContactDialog}
            >
              <AlertDialogContent className="bg-white dark:bg-zinc-900">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Marketing Data</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes your contact record from HighLevel.
                    You will no longer receive marketing emails from Panamia.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleGhlDeleteContact}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
