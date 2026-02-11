import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProfileTagsProps {
  tags: string;
}

export function ProfileTags({ tags }: ProfileTagsProps) {
  const tagList = tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (tagList.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap gap-2">
          <span className="mr-2 text-sm font-semibold text-gray-500">
            Tags:
          </span>
          {tagList.map((tag, index) => (
            <Badge key={index} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
