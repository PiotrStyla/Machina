export interface Database {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: string;
          number: string;
          title: string;
          client: string;
          description: string;
          status: "active" | "planned" | "completed";
          deadline: string | null;
          estimated_minutes: number;
          created_at: string;
        };
        Insert: {
          id: string;
          number: string;
          title: string;
          client?: string;
          description?: string;
          status: "active" | "planned" | "completed";
          deadline?: string | null;
          estimated_minutes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          number?: string;
          title?: string;
          client?: string;
          description?: string;
          status?: "active" | "planned" | "completed";
          deadline?: string | null;
          estimated_minutes?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          job_id: string;
          title: string;
          estimated_minutes: number;
          status: "todo" | "in-progress" | "done";
          position: number;
          created_at: string;
        };
        Insert: {
          id: string;
          job_id: string;
          title: string;
          estimated_minutes?: number;
          status: "todo" | "in-progress" | "done";
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          title?: string;
          estimated_minutes?: number;
          status?: "todo" | "in-progress" | "done";
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      time_sessions: {
        Row: {
          id: string;
          task_id: string;
          started_at: string;
          stopped_at: string;
          duration_seconds: number;
        };
        Insert: {
          id: string;
          task_id: string;
          started_at: string;
          stopped_at: string;
          duration_seconds: number;
        };
        Update: {
          id?: string;
          task_id?: string;
          started_at?: string;
          stopped_at?: string;
          duration_seconds?: number;
        };
        Relationships: [];
      };
      active_timer: {
        Row: {
          id: "current";
          task_id: string;
          started_at: string;
        };
        Insert: {
          id: "current";
          task_id: string;
          started_at: string;
        };
        Update: {
          id?: "current";
          task_id?: string;
          started_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
