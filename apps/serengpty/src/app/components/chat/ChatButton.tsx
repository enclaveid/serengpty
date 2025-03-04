'use client';

import React from 'react';
import { Button } from '@enclaveid/ui/button';
import { useRouter } from 'next/navigation';
import { useStartChat } from './useStartChat';
import { useChatUser } from './ChatUserContext';

interface ChatButtonProps {
  userId: string;
  userName: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const ChatButton: React.FC<ChatButtonProps> = ({
  userId,
  userName,
  variant = 'default',
  size = 'default',
  className,
}) => {
  const router = useRouter();
  const { user } = useChatUser();
  const { startChat, isStarting } = useStartChat();

  const handleStartChat = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Don't allow chatting with yourself
    if (user.id === userId) {
      return;
    }

    await startChat(userId, userName);
  };

  return (
    <Button
      onClick={handleStartChat}
      disabled={isStarting || (user?.id === userId)}
      variant={variant}
      size={size}
      className={className}
    >
      {isStarting ? 'Starting chat...' : 'Chat'}
    </Button>
  );
};

export default ChatButton;