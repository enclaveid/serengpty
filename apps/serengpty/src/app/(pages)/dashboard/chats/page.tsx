'use client';

import { useSearchParams } from 'next/navigation';
import { ChatInterface } from '../../../components/chat/ChatInterface';
import { ChatProvider } from '../../../components/chat/ChatProvider';

const ChatsPage = () => {
  const searchParams = useSearchParams();
  const userId = searchParams?.get('userId');

  return (
    <div className="w-full h-full">
      <ChatProvider>
        <ChatInterface initialConversationId={userId || undefined} />
      </ChatProvider>
    </div>
  );
};

export default ChatsPage;
