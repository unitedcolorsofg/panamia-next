import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface ProfileHeaderProps {
  profile: {
    name: string;
    five_words: string;
    details: string;
    background?: string;
    images?: {
      primaryCDN?: string;
    };
  };
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Profile Image */}
          <div className="flex-shrink-0">
            <Avatar className="h-48 w-48">
              <AvatarImage
                src={profile.images?.primaryCDN || '/img/bg_coconut_blue.jpg'}
                alt={profile.name}
              />
              <AvatarFallback className="text-4xl">
                {profile.name[0]}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Profile Info */}
          <div className="flex-1 space-y-3">
            <h1 className="text-3xl font-bold">{profile.name}</h1>

            {profile.five_words && (
              <Badge variant="secondary" className="text-sm">
                {profile.five_words}
              </Badge>
            )}

            {profile.details && (
              <p className="text-gray-700 dark:text-gray-300">
                {profile.details}
              </p>
            )}

            {profile.background && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
                  Background
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {profile.background}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
