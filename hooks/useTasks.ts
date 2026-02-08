import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Task } from '../types/database';

export function useTasks(projectId: string | undefined, userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [proofCountByTaskId, setProofCountByTaskId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!error) {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const sorted = (data || []).sort(
        (a, b) =>
          (priorityOrder[a.priority || 'medium'] || 1) -
          (priorityOrder[b.priority || 'medium'] || 1)
      );
      setTasks(sorted);
      const taskIds = sorted.map((t) => t.id);
      if (taskIds.length > 0) {
        const { data: proofRows } = await supabase.from('task_proofs').select('task_id').in('task_id', taskIds);
        const count: Record<string, number> = {};
        taskIds.forEach((id) => (count[id] = 0));
        (proofRows || []).forEach((r: { task_id: string }) => { count[r.task_id] = (count[r.task_id] || 0) + 1; });
        setProofCountByTaskId(count);
      } else {
        setProofCountByTaskId({});
      }
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchTasks();

    // Subscribe to realtime updates
    if (projectId) {
      const channel = supabase
        .channel(`tasks-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tasks',
            filter: `project_id=eq.${projectId}`,
          },
          () => {
            fetchTasks();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchTasks, projectId]);

  const updateTaskStatus = async (
    taskId: string,
    status: string,
    blockedReason?: string
  ) => {
    const updates: Partial<Task> = { status };
    if (status === 'blocked' && blockedReason) {
      updates.blocked_reason = blockedReason;
    }
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
    if (status === 'pending' || status === 'in_progress') {
      updates.completed_at = null;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId);

    if (!error && userId && projectId) {
      // Add to activity feed
      const actionMap: Record<string, string> = {
        in_progress: 'task_started',
        blocked: 'task_blocked',
        completed: 'task_completed',
      };
      if (actionMap[status]) {
        await supabase.from('activity_feed').insert({
          project_id: projectId,
          user_id: userId,
          action: actionMap[status],
          task_id: taskId,
          metadata: blockedReason ? { reason: blockedReason } : {},
        });
      }
      fetchTasks();
    }

    return { error };
  };

  const myTasks = tasks.filter((t) => t.assigned_to === userId);
  const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return {
    tasks,
    proofCountByTaskId,
    myTasks,
    pendingTasks,
    activeTasks,
    completedTasks,
    loading,
    updateTaskStatus,
    refreshTasks: fetchTasks,
  };
}
