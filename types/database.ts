export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_feed: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          project_id: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feed_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          message_type: string | null
          project_id: string
          user_id: string
          voice_url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          message_type?: string | null
          project_id: string
          user_id: string
          voice_url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          message_type?: string | null
          project_id?: string
          user_id?: string
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string
          id: string
          role: string | null
          trade: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string
          id: string
          role?: string | null
          trade?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          role?: string | null
          trade?: string | null
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          joined_at: string | null
          project_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          project_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          project_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          join_code: string
          name: string
          status: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          join_code?: string
          name: string
          status?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          join_code?: string
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      task_proofs: {
        Row: {
          annotation_url: string | null
          created_at: string | null
          id: string
          photo_url: string | null
          submitted_by: string | null
          task_id: string
          transcript: string | null
          voice_note_url: string | null
        }
        Insert: {
          annotation_url?: string | null
          created_at?: string | null
          id?: string
          photo_url?: string | null
          submitted_by?: string | null
          task_id: string
          transcript?: string | null
          voice_note_url?: string | null
        }
        Update: {
          annotation_url?: string | null
          created_at?: string | null
          id?: string
          photo_url?: string | null
          submitted_by?: string | null
          task_id?: string
          transcript?: string | null
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_proofs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          blocked_reason: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          location: string | null
          priority: string | null
          project_id: string
          status: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          location?: string | null
          priority?: string | null
          project_id: string
          status?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          location?: string | null
          priority?: string | null
          project_id?: string
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_project_member: { Args: { p_project_id: string }; Returns: boolean }
      is_project_supervisor: {
        Args: { p_project_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectMember = Database['public']['Tables']['project_members']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskProof = Database['public']['Tables']['task_proofs']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
export type ActivityFeedItem = Database['public']['Tables']['activity_feed']['Row'];
