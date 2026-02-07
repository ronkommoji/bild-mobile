import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ChatMessage } from '../types/database';

type ChatMessageWithProfile = ChatMessage & {
  profile?: { full_name: string } | null;
};

export function useChat(projectId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessageWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    const { data } = await supabase
      .from('chat_messages')
      .select('*, profile:profiles(full_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .limit(100);

    setMessages((data as any) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages
    if (projectId) {
      const channel = supabase
        .channel(`chat-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `project_id=eq.${projectId}`,
          },
          async (payload) => {
            // Fetch the new message with profile
            const { data } = await supabase
              .from('chat_messages')
              .select('*, profile:profiles(full_name)')
              .eq('id', payload.new.id)
              .single();
            if (data) {
              setMessages((prev) => [...prev, data as any]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchMessages, projectId]);

  const sendMessage = async (
    userId: string,
    content: string,
    messageType: 'text' | 'voice' = 'text',
    voiceUrl?: string
  ) => {
    if (!projectId) return { error: new Error('No project selected') };

    const { error } = await supabase.from('chat_messages').insert({
      project_id: projectId,
      user_id: userId,
      content,
      message_type: messageType,
      voice_url: voiceUrl,
    });

    return { error };
  };

  return {
    messages,
    loading,
    sendMessage,
    refreshMessages: fetchMessages,
  };
}
