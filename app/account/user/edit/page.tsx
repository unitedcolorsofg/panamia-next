'use client';

import { useEffect, useState, FormEvent, useCallback } from 'react';
import { useSession } from 'next-auth/react';
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
import { getUserSession, saveUserSession } from '@/lib/user';
import { UserInterface } from '@/lib/interfaces';
import { Mail, AlertCircle, Check, X, Loader2 } from 'lucide-react';

export default function UserEditPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
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
  const [pendingScreennameChange, setPendingScreennameChange] = useState(false);

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
    setPendingScreennameChange(false);
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

  const handleEmailMigration = async () => {
    if (!newEmail || newEmail === sessionEmail) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a different email address.',
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
          title: 'Verification Email Sent',
          description: `Check your inbox at ${newEmail}. The link expires in 5 minutes.`,
        });
        setNewEmail('');
      } else {
        toast({
          title: 'Migration Failed',
          description: data.error || 'Failed to initiate email migration.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      console.error('Email migration error:', error);
    } finally {
      setIsMigrating(false);
    }
  };

  useEffect(() => {
    if (session) {
      setUserSession();
    }
  }, [session]);

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
              <AlertDialogContent>
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
            <Accordion type="single" collapsible>
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
                      <AlertDialogContent>
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
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
