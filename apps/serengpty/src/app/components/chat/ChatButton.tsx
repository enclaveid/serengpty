'use client';

import React from 'react';
import { Button } from '@enclaveid/ui/button';
import { useStartChat } from './useStartChat';

interface ChatButtonProps {
  userId: string;
  userName: string;
  variant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'link'
    | 'destructive';
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
  const { startChat, isStarting } = useStartChat();

  const handleStartChat = async () => {
    await startChat(userId, userName);
  };

  return (
    <Button
      onClick={handleStartChat}
      disabled={isStarting}
      variant={variant}
      size={size}
      className={className}
    >
      {isStarting ? 'Starting chat...' : `Chat with ${userName}`}
    </Button>
  );
};

export default ChatButton;
