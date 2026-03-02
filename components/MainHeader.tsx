'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from '@/lib/auth-client';
import Link from 'next/link';
import axios from 'axios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Bell,
  ChevronDown,
  Home,
  Search,
  UserCircle,
  User,
  MessageCircle,
  Compass,
  Video,
  Users,
  Shield,
  Info,
  Gift,
  LogOut,
  PenLine,
  FileText,
} from 'lucide-react';

import styles from './MainHeader.module.css';
import CallToActionBar from './CallToActionBar';
import { ThemeToggle } from './theme-toggle';

// https://www.a11ymatters.com/pattern/mobile-nav/

export default function MainHeader({
  isProductionSite,
}: {
  isProductionSite: boolean;
}) {
  const { data: session, status } = useSession();
  const handleSignOut = () => signOut({ redirect: true, callbackUrl: '/' });
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  // Get admin status directly from session (no API call needed)
  const isAdmin = session?.user?.isAdmin || false;

  // Check if authenticated user has a profile
  useEffect(() => {
    if (session?.user) {
      axios
        .get('/api/getProfile')
        .then((res) => {
          // Profile exists if we get data back with an id
          // API returns { success: true, data: { id: ... } }
          setHasProfile(!!res.data?.data?.id);
        })
        .catch(() => {
          setHasProfile(false);
        });
    }
    // When session is null, hasProfile remains null (initial state)
    // The CTA bar only shows for authenticated users anyway
  }, [session]);

  return (
    <header className={styles.header}>
      {/* CTA bar: newsletter for unauthenticated, profile completion for authenticated without profile */}
      {status !== 'loading' && !session && (
        <div id="call-to-action-bar">
          <CallToActionBar isProductionSite={isProductionSite} />
        </div>
      )}
      {status !== 'loading' && session && hasProfile === false && (
        <div id="call-to-action-bar">
          <CallToActionBar
            variant="complete-profile"
            isProductionSite={isProductionSite}
          />
        </div>
      )}
      {/* Top-right navigation buttons */}
      <div className="fixed top-13 right-2 z-50 flex flex-wrap gap-2 md:top-4 md:right-4">
        {/* Unauthenticated users: Show Become a Pana and Sign In buttons */}
        {status !== 'loading' && !session && (
          <>
            <Button
              size="default"
              variant="outline"
              asChild
              className="h-10 px-4"
            >
              <Link href="/form/become-a-pana">
                <span className="hidden md:inline">Become a Pana</span>
                <span className="md:hidden">Sign Up</span>
              </Link>
            </Button>
            <Button
              size="default"
              variant="outline"
              asChild
              className="h-10 px-4"
            >
              <Link href="/api/auth/signin">Sign In</Link>
            </Button>
          </>
        )}

        {/* Authenticated users: Show Jump To dropdown */}
        {status !== 'loading' && session && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="default" variant="outline" data-no-wobble="true">
                Jump To
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Navigation</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/" className="flex cursor-pointer items-center">
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/updates"
                  className="flex cursor-pointer items-center"
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Updates
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/directory/search"
                  className="flex cursor-pointer items-center"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Directory Search
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  href="/account/profile/edit"
                  className="flex cursor-pointer items-center"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  My Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/account/user/edit"
                  className="flex cursor-pointer items-center"
                >
                  <User className="mr-2 h-4 w-4" />
                  Account Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/timeline"
                  className="flex cursor-pointer items-center"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Timeline Posts
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Mentoring</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  href="/m/discover"
                  className="flex cursor-pointer items-center"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Discover Mentors
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/m/profile/edit"
                  className="flex cursor-pointer items-center"
                >
                  <Compass className="mr-2 h-4 w-4" />
                  Mentor Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/m/schedule"
                  className="flex cursor-pointer items-center"
                >
                  <Video className="mr-2 h-4 w-4" />
                  My Sessions
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Articles</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/a" className="flex cursor-pointer items-center">
                  <FileText className="mr-2 h-4 w-4" />
                  Browse Articles
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/a/new"
                  className="flex cursor-pointer items-center"
                >
                  <PenLine className="mr-2 h-4 w-4" />
                  Write Article
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Community</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  href="/about-us"
                  className="flex cursor-pointer items-center"
                >
                  <Info className="mr-2 h-4 w-4" />
                  About Pana Mia
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/donate"
                  className="flex cursor-pointer items-center"
                >
                  <Gift className="mr-2 h-4 w-4" />
                  Support Us
                </Link>
              </DropdownMenuItem>

              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/account/admin/users"
                      className="flex cursor-pointer items-center"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="flex cursor-pointer items-center"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
