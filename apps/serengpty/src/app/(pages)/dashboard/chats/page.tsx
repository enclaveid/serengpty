'use client';

import React, { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatInterface } from '../../../components/chat/ChatInterface';
import { ChatProvider } from '../../../components/chat/ChatProvider';
import { auth } from '../../../services/auth';
import { ChatUserProvider } from '../../../components/chat/ChatUserContext';
import { redirect } from 'next/navigation';

const ChatsPage = () => {
  const searchParams = useSearchParams();
  const userId = searchParams?.get('userId');
  const { data: session } = auth();

  // Redirect to dashboard if not authenticated
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="w-full h-full">
      <ChatUserProvider session={session}>
        <ChatProvider>
          <ChatInterface initialConversationId={userId || undefined} />
        </ChatProvider>
      </ChatUserProvider>
    </div>
  );
};

export default ChatsPage;