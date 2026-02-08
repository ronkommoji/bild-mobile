import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Project, ProjectMember } from '../types/database';

const CURRENT_PROJECT_ID_KEY = 'bild_current_project_id';

export function useProjects(userId: string | undefined) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<(ProjectMember & { profile?: { full_name: string; trade: string | null } })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data: memberRows } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId);

    if (memberRows && memberRows.length > 0) {
      const projectIds = memberRows.map((m) => m.project_id);
      const { data } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      setProjects(data || []);
      if (data && data.length > 0 && !currentProject) {
        const savedId = await AsyncStorage.getItem(CURRENT_PROJECT_ID_KEY);
        const preferred = savedId ? data.find((p) => p.id === savedId) : null;
        setCurrentProject(preferred || data[0]);
      }
    } else {
      setProjects([]);
    }
    setLoading(false);
  }, [userId]);

  const fetchMembers = useCallback(async () => {
    if (!currentProject) return;
    const { data } = await supabase
      .from('project_members')
      .select('*, profile:profiles(full_name, trade)')
      .eq('project_id', currentProject.id);
    setMembers((data as any) || []);
  }, [currentProject]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (currentProject) {
      fetchMembers();
    }
  }, [currentProject, fetchMembers]);

  const switchProject = (project: Project) => {
    setCurrentProject(project);
    AsyncStorage.setItem(CURRENT_PROJECT_ID_KEY, project.id);
  };

  const createProject = async (name: string, description?: string, address?: string) => {
    if (!userId) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('projects')
      .insert({ name, description, address, created_by: userId })
      .select()
      .single();

    if (!error && data) {
      // Add creator as supervisor
      await supabase.from('project_members').insert({
        project_id: data.id,
        user_id: userId,
        role: 'supervisor',
      });
      await fetchProjects();
      setCurrentProject(data);
      AsyncStorage.setItem(CURRENT_PROJECT_ID_KEY, data.id);
    }

    return { error, data };
  };

  const updateProject = async (projectId: string, updates: { name?: string; description?: string; address?: string }) => {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (!error && data) {
      await fetchProjects();
      if (currentProject?.id === projectId) {
        setCurrentProject(data);
      }
    }
    return { error, data };
  };

  const joinProjectByCode = async (code: string): Promise<{ error: Error | null; data?: Project }> => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { error: new Error('Enter a join code') };
    const { data: result, error } = await supabase.rpc('join_project_by_code', { p_join_code: trimmed });
    if (error) return { error: error instanceof Error ? error : new Error(error.message) };
    const parsed = result as { success: boolean; error?: string; project?: Project };
    if (!parsed.success) {
      return { error: new Error(parsed.error || 'Invalid code') };
    }
    if (parsed.project) {
      await fetchProjects();
      const proj = parsed.project as Project;
      setCurrentProject(proj);
      AsyncStorage.setItem(CURRENT_PROJECT_ID_KEY, proj.id);
    }
    return { error: null, data: parsed.project as Project };
  };

  const leaveProject = async (projectId: string): Promise<{ error: Error | null }> => {
    if (!userId) return { error: new Error('Not authenticated') };
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) return { error: error instanceof Error ? error : new Error(error.message) };
    if (currentProject?.id === projectId) {
      setCurrentProject(null);
      await AsyncStorage.removeItem(CURRENT_PROJECT_ID_KEY);
    }
    await fetchProjects();
    return { error: null };
  };

  return {
    projects,
    currentProject,
    members,
    loading,
    switchProject,
    createProject,
    updateProject,
    joinProjectByCode,
    leaveProject,
    refreshProjects: fetchProjects,
    refreshMembers: fetchMembers,
  };
}
