'use client';

import { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@enclaveid/ui/avatar';
import { Skeleton } from '@enclaveid/ui/skeleton';
import { Button } from '@enclaveid/ui/button';
import { cn } from '@enclaveid/ui-utils';
import { ScrollArea } from '@enclaveid/ui/scroll-area';
import { Separator } from '@enclaveid/ui/separator';
import { ChatButton } from '../chat/ChatButton';
import { SerendipitousPathsResponse } from '../../types/serendipitous-paths';
import { ScoreCircle } from './score-circle';
import { getIdenticon } from '../../utils/getIdenticon';
import { getCountryFlag } from '../../utils/getCountryFlag';

interface VerticalSerendipitousPathsProps {
  initialData?: SerendipitousPathsResponse[];
  initialError?: string | null;
}

export function VerticalSerendipitousPaths({
  initialData = [],
  initialError = null,
}: VerticalSerendipitousPathsProps) {
  const [loading, setLoading] = useState(!initialData.length && !initialError);
  const [error, setError] = useState<string | null>(initialError);
  const [data, setData] = useState<SerendipitousPathsResponse[]>(initialData);
  const [selectedUserIndex, setSelectedUserIndex] = useState(0);
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
    setSelectedUserIndex(index);
    // Find the first path index for this user
    const firstPathIndex = data.findIndex(
      (item) => item.connectedUser.id === data[index].connectedUser.id
    );
    // Set to the first path for this user
    setSelectedPathIndex(firstPathIndex !== -1 ? firstPathIndex : 0);
  };

  const handlePathSelect = (index: number) => {
    setSelectedPathIndex(index);
  };

  const selectedUser = data[selectedUserIndex].connectedUser;
  const selectedPathData = data[selectedPathIndex];

  return (
    <div className="flex h-full">
      {/* First Section - Users List */}
      <div className="w-1/4 border-r">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Serendipitous Connections</h2>
        </div>
        <ScrollArea className="h-[calc(100%-56px)]">
          <div className="p-2 space-y-2">
            {/* Group data by user to prevent duplicates */}
            {Array.from(
              new Map(
                data.map((item) => [item.connectedUser.id, item])
              ).values()
            ).map((item, index) => (
              <UserCard
                key={item.connectedUser.id}
                user={item.connectedUser}
                score={item.averageUserScore}
                totalPaths={item.totalUserPaths}
                isActive={
                  data[selectedUserIndex].connectedUser.id ===
                  item.connectedUser.id
                }
                onClick={() =>
                  handleUserSelect(
                    data.findIndex(
                      (d) => d.connectedUser.id === item.connectedUser.id
                    )
                  )
                }
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Second Section - Path Summaries */}
      <div className="w-1/3 border-r">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">
            {selectedPathData.totalUserPaths > 1
              ? `Paths with ${selectedUser.name}`
              : `Path with ${selectedUser.name}`}
          </h2>
        </div>
        <ScrollArea className="h-[calc(100%-56px)]">
          <div className="p-2 space-y-2">
            {/* Find all paths for the selected user */}
            {data
              .filter((item) => item.connectedUser.id === selectedUser.id)
              .map((pathData, index) => {
                // Get the actual index in the full data array
                const dataIndex = data.findIndex(
                  (d) =>
                    d.path.id === pathData.path.id &&
                    d.connectedUser.id === selectedUser.id
                );

                return (
                  <PathSummaryCard
                    key={pathData.path.id}
                    path={pathData.path}
                    isActive={selectedPathIndex === dataIndex}
                    onClick={() => handlePathSelect(dataIndex)}
                  />
                );
              })}
          </div>
        </ScrollArea>
      </div>

      {/* Third Section - Path Details */}
      <div className="w-5/12">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">Path Details</h2>
          <ChatButton
            userId={selectedUser.id}
            userName={selectedUser.name}
            variant="outline"
            size="sm"
            className="flex items-center"
          ></ChatButton>
        </div>
        <ScrollArea className="h-[calc(100%-56px)] p-4">
          <PathDetails pathData={selectedPathData} />
        </ScrollArea>
      </div>
    </div>
  );
}

// User Card Component
function UserCard({
  user,
  score,
  totalPaths = 1,
  isActive = false,
  onClick,
}: {
  user: SerendipitousPathsResponse['connectedUser'];
  score: number;
  totalPaths?: number;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors',
        isActive && 'bg-muted'
      )}
      onClick={onClick}
    >
      <Avatar className={cn('h-10 w-10', isActive && 'ring-2 ring-primary')}>
        <AvatarImage
          src={user.image || getIdenticon(user.name)}
          alt={user.name}
        />
        <AvatarFallback>
          {user.name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <div className="font-medium truncate">{user.name}</div>
        <div className="flex items-center gap-1">
          <div className="text-xs text-muted-foreground">
            <span className="mr-1">{getCountryFlag(user.country)}</span>
            {user.country}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center">
        <ScoreCircle percentage={score} size="md" label="Match" />
        <div className="text-xs text-muted-foreground mt-1">Match</div>
      </div>
    </div>
  );
}

// Path Summary Card Component
function PathSummaryCard({
  path,
  isActive = false,
  onClick,
}: {
  path: SerendipitousPathsResponse['path'];
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors',
        isActive && 'bg-muted'
      )}
      onClick={onClick}
    >
      <div className="font-medium mb-1">Connection</div>
      <div className="text-sm text-muted-foreground">{path.summary}</div>
    </div>
  );
}

// Path Details Component
function PathDetails({ pathData }: { pathData: SerendipitousPathsResponse }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Connection Summary</h3>
        <p className="text-muted-foreground">{pathData.path.summary}</p>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">Common Interests</h3>
        <div className="space-y-3">
          {pathData.commonConversations.length > 0 ? (
            pathData.commonConversations.map((convo) => (
              <ConversationCard key={convo.id} conversation={convo} />
            ))
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              No common conversations found
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium mb-2">Your Unique Interests</h3>
        <div className="space-y-3">
          {pathData.currentUserUniqueConversations.length > 0 ? (
            pathData.currentUserUniqueConversations.map((convo) => (
              <ConversationCard key={convo.id} conversation={convo} />
            ))
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              No unique conversations found
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium mb-2">
          {pathData.connectedUser.name}'s Unique Interests
        </h3>
        <div className="space-y-3">
          {pathData.connectedUserUniqueConversations.length > 0 ? (
            pathData.connectedUserUniqueConversations.map((convo) => (
              <ConversationCard key={convo.id} conversation={convo} />
            ))
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              No unique conversations found for {pathData.connectedUser.name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Conversation Card Component
function ConversationCard({ conversation }: { conversation: any }) {
  return (
    <div className="p-3 bg-muted rounded-lg">
      <div className="font-medium">{conversation.summary}</div>
      <div className="text-sm text-muted-foreground">
        {new Date(conversation.datetime).toLocaleDateString()}
      </div>
    </div>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="flex h-full">
      {/* First column loading */}
      <div className="w-1/4 border-r">
        <div className="p-4 border-b">
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="p-4 space-y-4">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Second column loading */}
      <div className="w-1/3 border-r">
        <div className="p-4 border-b">
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="p-4 space-y-4">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
        </div>
      </div>

      {/* Third column loading */}
      <div className="w-5/12">
        <div className="p-4 border-b">
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="p-4 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            {Array(2)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Error State
function ErrorState({ error }: { error: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="bg-destructive/10 p-6 rounded-xl text-center max-w-md">
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
    <div className="w-full h-full flex items-center justify-center">
      <div className="bg-muted p-8 rounded-xl text-center max-w-md">
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
