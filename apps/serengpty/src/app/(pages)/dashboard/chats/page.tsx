'use client';

import { useSearchParams } from 'next/navigation';
import { ChatInterface } from '../../../components/chat/ChatInterface';
import { ChatProvider } from '../../../components/chat/ChatProvider';
import { ChatUserProvider } from '../../../components/chat/ChatUserContext';

const ChatsPage = () => {
  const searchParams = useSearchParams();
  const userId = searchParams?.get('userId');

  return (
    <div className="w-full h-full">
      <ChatUserProvider>
        <ChatProvider>
          <ChatInterface initialConversationId={userId || undefined} />
        </ChatProvider>
      </ChatUserProvider>
    </div>
  );
};

export default ChatsPage;
