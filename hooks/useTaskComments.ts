import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { TaskComment } from '../types/database';

export type TaskCommentWithProfile = TaskComment & {
  profile?: { full_name: string } | null;
};

export function useTaskComments(taskId: string | undefined) {
  const [comments, setComments] = useState<TaskCommentWithProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    const { data } = await supabase
      .from('task_comments')
      .select('*, profile:profiles(full_name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    setComments((data as TaskCommentWithProfile[]) || []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    fetchComments();
    if (!taskId) return;
    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` }, () => fetchComments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [taskId, fetchComments]);

  const sendComment = async (userId: string, content: string, mentions: string[] = []) => {
    if (!taskId) return { error: new Error('No task') };
    const { error } = await supabase.from('task_comments').insert({
      task_id: taskId,
      user_id: userId,
      content: content.trim(),
      mentions: mentions.length ? mentions : [],
    });
    if (!error) fetchComments();
    return { error };
  };

  return { comments, loading, sendComment, refreshComments: fetchComments };
}
