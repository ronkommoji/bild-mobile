import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { BlueprintRoom, BlueprintPin, Task } from '../types/database';

export function useBlueprint(projectId: string | undefined) {
  const [blueprintImageUrl, setBlueprintImageUrl] = useState<string | null>(null);
  const [rooms, setRooms] = useState<BlueprintRoom[]>([]);
  const [pins, setPins] = useState<BlueprintPin[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!projectId) {
      setBlueprintImageUrl(null);
      setRooms([]);
      setPins([]);
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [projectRes, roomsRes, pinsRes, tasksRes] = await Promise.all([
      supabase.from('projects').select('id, name, blueprint_file_id').eq('id', projectId).single(),
      supabase.from('project_blueprint_rooms').select('id, name, points').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('project_blueprint_pins').select('id, task_id, room_id, x, y').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('tasks').select('*').eq('project_id', projectId).order('priority', { ascending: true }).order('created_at', { ascending: false }),
    ]);

    const project = projectRes.data;
    const blueprintFileId = project?.blueprint_file_id ?? null;

    let imageUrl: string | null = null;
    if (blueprintFileId) {
      const { data: file } = await supabase.from('project_files').select('file_path').eq('id', blueprintFileId).single();
      const filePath = file?.file_path;
      if (filePath) {
        const { data: signed } = await supabase.storage.from('project-files').createSignedUrl(filePath, 3600);
        imageUrl = signed?.signedUrl ?? null;
      }
    }
    setBlueprintImageUrl(imageUrl);

    setRooms(
      (roomsRes.data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        points: (r.points as { x: number; y: number }[]) ?? [],
      }))
    );

    setPins(
      (pinsRes.data ?? []).map((p) => ({
        id: p.id,
        taskId: p.task_id,
        roomId: p.room_id,
        x: p.x,
        y: p.y,
      }))
    );

    setTasks((tasksRes.data ?? []) as Task[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    blueprintImageUrl,
    rooms,
    pins,
    tasks,
    loading,
    refresh: fetch,
  };
}
