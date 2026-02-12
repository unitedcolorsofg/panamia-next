'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';

interface MentorCardProps {
  mentor: {
    name: string;
    email: string;
    slug?: string;
    mentoring: {
      expertise: string[];
      languages: string[];
      bio: string;
      hourlyRate?: number;
    };
    images?: {
      avatar?: string;
    };
  };
}

export function MentorCard({ mentor }: MentorCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-4">
          <Avatar>
            <AvatarImage src={mentor.images?.avatar} alt={mentor.name} />
            <AvatarFallback>{mentor.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{mentor.name}</CardTitle>
            <p className="text-sm text-gray-500">
              {mentor.mentoring.hourlyRate === 0
                ? 'Free'
                : `$${mentor.mentoring.hourlyRate}/hr`}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-700">{mentor.mentoring.bio}</p>

        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500">Expertise</p>
          <div className="flex flex-wrap gap-2">
            {mentor.mentoring.expertise.map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500">Languages</p>
          <div className="flex flex-wrap gap-2">
            {mentor.mentoring.languages.map((lang) => (
              <Badge key={lang} variant="outline">
                {lang}
              </Badge>
            ))}
          </div>
        </div>

        <Link href={`/m/schedule/book?mentor=${mentor.email}`}>
          <Button className="w-full">Book Session</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
