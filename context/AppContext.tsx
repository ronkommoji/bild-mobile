import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProjects } from '../hooks/useProjects';
import { Session, User } from '@supabase/supabase-js';
import { Profile, Project, ProjectMember } from '../types/database';

interface AppContextType {
  // Auth
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  authLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, trade: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  refreshProfile: () => void;
  // Projects
  projects: Project[];
  currentProject: Project | null;
  members: (ProjectMember & { profile?: { full_name: string; trade: string | null } })[];
  projectsLoading: boolean;
  switchProject: (project: Project) => void;
  createProject: (name: string, description?: string, address?: string) => Promise<{ error: any; data?: any }>;
  updateProject: (projectId: string, updates: { name?: string; description?: string; address?: string }) => Promise<{ error: any; data?: any }>;
  joinProjectByCode: (code: string) => Promise<{ error: Error | null; data?: Project }>;
  leaveProject: (projectId: string) => Promise<{ error: Error | null }>;
  refreshProjects: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const projectsHook = useProjects(auth.user?.id);

  const value: AppContextType = {
    session: auth.session,
    user: auth.user,
    profile: auth.profile,
    authLoading: auth.loading,
    signIn: auth.signIn,
    signUp: auth.signUp,
    signOut: auth.signOut,
    updateProfile: auth.updateProfile,
    refreshProfile: auth.refreshProfile,
    projects: projectsHook.projects,
    currentProject: projectsHook.currentProject,
    members: projectsHook.members,
    projectsLoading: projectsHook.loading,
    switchProject: projectsHook.switchProject,
    createProject: projectsHook.createProject,
    updateProject: projectsHook.updateProject,
    joinProjectByCode: projectsHook.joinProjectByCode,
    leaveProject: projectsHook.leaveProject,
    refreshProjects: projectsHook.refreshProjects,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
