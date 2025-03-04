'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChatUser } from './ChatUserContext';
import { getChatService } from '../../services/chatService';
import { sendMessage } from '../../actions/chatActions';

export const useStartChat = () => {
  const [isStarting, setIsStarting] = useState(false);
  const router = useRouter();
  const { user } = useChatUser();

  const startChat = async (userId: string, userName: string) => {
    if (!user) {
      router.push('/login');
      return;
    }

    try {
      setIsStarting(true);

      // Get chat service
      const chatService = getChatService();
      
      // Check if there are existing messages
      const existingMessages = await chatService.getMessages(userId);
      
      if (existingMessages.length === 0) {
        // Create a first message to start the conversation
        // We use the server action directly to ensure it gets created on the server
        await sendMessage(userId, `Hello, I'd like to chat with you!`);
      }

      // Navigate to chat page
      router.push(`/dashboard/chats?userId=${userId}`);
    } catch (error) {
      console.error('Error starting chat:', error);
    } finally {
      setIsStarting(false);
    }
  };

  return { startChat, isStarting };
};

export default useStartChat;