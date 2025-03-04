'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendMessage, getMessages } from '../../actions/chatActions';

export const useStartChat = () => {
  const [isStarting, setIsStarting] = useState(false);
  const router = useRouter();

  const startChat = async (userId: string, userName: string) => {
    try {
      setIsStarting(true);

      // Check if there are existing messages using server action
      const existingMessages = await getMessages(userId);

      if (existingMessages.length === 0) {
        // Create a first message to start the conversation
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
