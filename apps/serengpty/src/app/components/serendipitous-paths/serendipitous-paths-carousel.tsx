'use client';

import { useState, useEffect } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@enclaveid/ui/carousel';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@enclaveid/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@enclaveid/ui/avatar';
import { Badge } from '@enclaveid/ui/badge';
import { Skeleton } from '@enclaveid/ui/skeleton';
import { Button } from '@enclaveid/ui/button';
import { cn } from '@enclaveid/ui-utils';
import { ChatButton } from '../chat/ChatButton';

interface SerendipitousPathsCarouselProps {
  initialData?: SerendipitousPathsResponse[];
  initialError?: string | null;
}

export function SerendipitousPathsCarousel({
  initialData = [],
  initialError = null,
}: SerendipitousPathsCarouselProps) {
  const [loading, setLoading] = useState(!initialData.length && !initialError);
  const [error, setError] = useState<string | null>(initialError);
  const [data, setData] = useState<SerendipitousPathsResponse[]>(initialData);
  const [selectedPathIndex, setSelectedPathIndex] = useState(0);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (data.length === 0) {
    return <EmptyState />;
  }

  const handleUserSelect = (index: number) => {
    setSelectedPathIndex(index);
  };

  return (
    <div className="w-full px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">
        Your Serendipitous Connections
      </h2>

      {/* User Carousel (horizontal) */}
      <Carousel className="w-full mb-8">
        <CarouselContent>
          {data.map((item, index) => (
            <CarouselItem
              key={item.connectedUser.id}
              className="md:basis-1/2 lg:basis-1/3"
            >
              <UserCard
                user={item.connectedUser}
                pathSummary={item.path.summary}
                isActive={index === selectedPathIndex}
                onClick={() => handleUserSelect(index)}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2" />
        <CarouselNext className="right-2" />
      </Carousel>

      {/* Path Details */}
      <div className="mt-10">
        <h3 className="text-xl font-semibold mb-4">
          Connection with{' '}
          <span className="text-primary">
            {data[selectedPathIndex].connectedUser.username}
          </span>
        </h3>

        <PathDetailsCarousel pathData={data[selectedPathIndex]} />
      </div>
    </div>
  );
}

// Path Details Carousel - Vertical swipe between common and unique conversations
function PathDetailsCarousel({
  pathData,
}: {
  pathData: SerendipitousPathsResponse;
}) {
  // Update the component when pathData changes
  useEffect(() => {
    // Reset carousel position or perform any other updates when pathData changes
  }, [pathData]);

  return (
    <div className="bg-card border rounded-xl p-4 shadow-sm">
      <div className="mb-4">
        <h4 className="text-lg font-medium">Connection Summary</h4>
        <p className="text-muted-foreground">{pathData.path.summary}</p>
      </div>

      <Carousel orientation="vertical" className="w-full h-96">
        <CarouselContent className="h-full">
          <CarouselItem>
            <Card className="border-none shadow-none">
              <CardHeader>
                <CardTitle>Common Interests</CardTitle>
                <CardDescription>
                  Topics you both have discussed
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pathData.commonConversations.length > 0 ? (
                  <ul className="space-y-3">
                    {pathData.commonConversations.map((convo) => (
                      <li key={convo.id} className="p-3 bg-muted rounded-lg">
                        <div className="font-medium">{convo.summary}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(convo.datetime).toLocaleDateString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center p-4 text-muted-foreground">
                    No common conversations found
                  </div>
                )}
              </CardContent>
            </Card>
          </CarouselItem>

          <CarouselItem>
            <Card className="border-none shadow-none">
              <CardHeader>
                <CardTitle>Your Unique Interests</CardTitle>
                <CardDescription>Topics specific to you</CardDescription>
              </CardHeader>
              <CardContent>
                {pathData.currentUserUniqueConversations.length > 0 ? (
                  <ul className="space-y-3">
                    {pathData.currentUserUniqueConversations.map((convo) => (
                      <li key={convo.id} className="p-3 bg-muted rounded-lg">
                        <div className="font-medium">{convo.summary}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(convo.datetime).toLocaleDateString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center p-4 text-muted-foreground">
                    No unique conversations found
                  </div>
                )}
              </CardContent>
            </Card>
          </CarouselItem>

          <CarouselItem>
            <Card className="border-none shadow-none">
              <CardHeader>
                <CardTitle>Their Unique Interests</CardTitle>
                <CardDescription>
                  Topics specific to {pathData.connectedUser.username}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pathData.connectedUserUniqueConversations.length > 0 ? (
                  <ul className="space-y-3">
                    {pathData.connectedUserUniqueConversations.map((convo) => (
                      <li key={convo.id} className="p-3 bg-muted rounded-lg">
                        <div className="font-medium">{convo.summary}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(convo.datetime).toLocaleDateString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center p-4 text-muted-foreground">
                    No unique conversations found for{' '}
                    {pathData.connectedUser.username}
                  </div>
                )}
              </CardContent>
            </Card>
          </CarouselItem>
        </CarouselContent>
        <div className="flex justify-center mt-2">
          <Badge variant="outline">Swipe for more details</Badge>
        </div>
        <CarouselPrevious className="-top-12 left-1/2" />
        <CarouselNext className="-bottom-12 left-1/2" />
      </Carousel>
    </div>
  );
}

// User Card Component

function UserCard({
  user,
  pathSummary,
  isActive = false,
  onClick,
}: {
  user: SerendipitousPathsResponse['connectedUser'];
  pathSummary: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Only trigger the card click if the click was not on the chat button
    if (!(e.target as HTMLElement).closest('button')) {
      onClick?.();
    }
  };

  return (
    <Card
      className={cn(
        'h-full transition-all cursor-pointer hover:border-primary',
        isActive && 'border-primary ring-2 ring-primary ring-opacity-50'
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar className={cn('h-16 w-16', isActive && 'ring-2 ring-primary')}>
          <AvatarImage src={user.image || undefined} alt={user.name} />
          <AvatarFallback>
            {user.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>{user.country}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground mb-2">
          Connected through:
        </div>
        <p className="font-medium">{pathSummary}</p>
      </CardContent>
      <CardFooter className="flex justify-end">
        <ChatButton
          userId={user.id}
          userName={user.name}
          variant={isActive ? 'default' : 'outline'}
          size="sm"
        />
      </CardFooter>
    </Card>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="w-full px-4 py-8">
      <Skeleton className="h-8 w-64 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <Card key={i} className="h-64">
              <CardHeader className="flex flex-row items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}

// Error State
function ErrorState({ error }: { error: string }) {
  return (
    <div className="w-full px-4 py-8">
      <div className="bg-destructive/10 p-6 rounded-xl text-center">
        <h3 className="text-xl font-bold text-destructive mb-2">
          Error Loading Connections
        </h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    </div>
  );
}

// Empty State
function EmptyState() {
  return (
    <div className="w-full px-4 py-8">
      <div className="bg-muted p-8 rounded-xl text-center">
        <h3 className="text-xl font-bold mb-2">No Connections Found</h3>
        <p className="text-muted-foreground mb-6">
          You don't have any serendipitous connections yet. Keep using the
          platform to discover people with similar interests.
        </p>
        <Button variant="default">Explore Topics</Button>
      </div>
    </div>
  );
}
