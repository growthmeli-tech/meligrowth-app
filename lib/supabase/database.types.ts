export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          role: "operator" | "client";
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          role: "operator" | "client";
          created_at?: string;
        };
        Update: {
          email?: string;
          name?: string | null;
          role?: "operator" | "client";
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          name: string;
          initials: string;
          plan: "starter" | "growth" | "scale";
          operator_id: string | null;
          client_user_id: string | null;
          meli_account_url: string | null;
          meli_seller_id: string | null;
          created_at: string;
          active: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["clients"]["Row"]> & {
          name: string;
          initials: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Row"]>;
        Relationships: [];
      };
      diagnostics: {
        Row: {
          id: string;
          client_id: string;
          date: string;
          score_global: number;
          estado_global: string;
          reclamos: number | null;
          mediaciones: number | null;
          cancelaciones_vendedor: number | null;
          envios_a_tiempo: number | null;
          score_salud: number | null;
          pubs_activas_pct: number | null;
          pubs_optimizadas_pct: number | null;
          ctr: number | null;
          score_publicaciones: number | null;
          margen_pre_ads: number | null;
          gasto_ads: number | null;
          ventas_ads: number | null;
          ventas_totales: number | null;
          acos: number | null;
          roas: number | null;
          tacos: number | null;
          score_ads: number | null;
          incidencias_pct: number | null;
          uso_full_flex_pct: number | null;
          cancelaciones_stock_pct: number | null;
          score_logistica: number | null;
          skus_sin_stock_pct: number | null;
          dias_stock: number | null;
          lead_time_reposicion: number | null;
          sistema_reposicion: number | null;
          score_stock: number | null;
          created_by: string | null;
          source: "manual" | "scraping" | "import";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["diagnostics"]["Row"]> & {
          client_id: string;
          score_global: number;
          estado_global: string;
        };
        Update: Partial<Database["public"]["Tables"]["diagnostics"]["Row"]>;
        Relationships: [];
      };
      score_history: {
        Row: {
          id: string;
          client_id: string;
          date: string;
          score_global: number;
          score_salud: number | null;
          score_pubs: number | null;
          score_ads: number | null;
          score_logistica: number | null;
          score_stock: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["score_history"]["Row"]> & {
          client_id: string;
          date: string;
          score_global: number;
        };
        Update: Partial<Database["public"]["Tables"]["score_history"]["Row"]>;
        Relationships: [];
      };
      actions: {
        Row: {
          id: string;
          client_id: string;
          created_by: string | null;
          bloque: string;
          titulo: string;
          descripcion: string | null;
          prioridad: "urgente" | "alta" | "media";
          estado: "pendiente" | "en_curso" | "completada";
          due_date: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["actions"]["Row"]> & {
          client_id: string;
          bloque: string;
          titulo: string;
          prioridad: "urgente" | "alta" | "media";
        };
        Update: Partial<Database["public"]["Tables"]["actions"]["Row"]>;
        Relationships: [];
      };
      client_files: {
        Row: {
          id: string;
          client_id: string;
          uploaded_by: string | null;
          tipo: "skus_stock" | "margenes" | "ficha_tecnica" | "otro";
          filename: string;
          storage_path: string;
          size_bytes: number | null;
          procesado: boolean;
          procesado_at: string | null;
          error_procesamiento: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["client_files"]["Row"]> & {
          client_id: string;
          filename: string;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_files"]["Row"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          client_id: string;
          sku: string;
          stock: number | null;
          title: string | null;
          description: string | null;
          last_file_id: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & {
          client_id: string;
          sku: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [];
      };
      margins: {
        Row: {
          id: string;
          client_id: string;
          sku: string;
          costo: number | null;
          precio: number | null;
          margen: number | null;
          last_file_id: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["margins"]["Row"]> & {
          client_id: string;
          sku: string;
        };
        Update: Partial<Database["public"]["Tables"]["margins"]["Row"]>;
        Relationships: [];
      };
      product_specs: {
        Row: {
          id: string;
          client_id: string;
          sku: string;
          titulo: string | null;
          descripcion: string | null;
          attributes: Json;
          last_file_id: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["product_specs"]["Row"]> & {
          client_id: string;
          sku: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_specs"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          client_id: string | null;
          user_id: string | null;
          tipo: "score_bajo" | "alerta_critica" | "accion_completada" | "archivo_procesado" | "reporte_semanal";
          titulo: string;
          mensaje: string;
          leida: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          tipo: "score_bajo" | "alerta_critica" | "accion_completada" | "archivo_procesado" | "reporte_semanal";
          titulo: string;
          mensaje: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      weekly_reports: {
        Row: {
          id: string;
          client_id: string;
          user_id: string | null;
          email: string;
          resend_email_id: string | null;
          score_global: number | null;
          score_delta: number | null;
          status: string;
          error_msg: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["weekly_reports"]["Row"]> & {
          client_id: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_reports"]["Row"]>;
        Relationships: [];
      };
      pricing_proposals: {
        Row: {
          id: string;
          client_id: string;
          created_by: string | null;
          source: "manual" | "template";
          plan: "starter" | "growth" | "scale";
          current_revenue: number;
          projected_revenue: number;
          gross_margin_pct: number;
          delivery_cost: number;
          setup_fee: number;
          months: number;
          fixed_fee: number;
          variable_commission: number;
          monthly_fee: number;
          operator_profit: number;
          operator_margin_pct: number;
          total_contract_value: number;
          payback_ratio: number;
          recommended: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pricing_proposals"]["Row"]> & {
          client_id: string;
          source: "manual" | "template";
          plan: "starter" | "growth" | "scale";
        };
        Update: Partial<Database["public"]["Tables"]["pricing_proposals"]["Row"]>;
        Relationships: [];
      };
      meli_sessions: {
        Row: {
          id: string;
          client_id: string;
          created_by: string | null;
          seller_id: string | null;
          storage_path: string;
          status: "missing" | "uploaded" | "validated" | "error";
          source: string;
          last_validated_at: string | null;
          last_error: string | null;
          warnings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["meli_sessions"]["Row"]> & {
          client_id: string;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["meli_sessions"]["Row"]>;
        Relationships: [];
      };
      scraping_jobs: {
        Row: {
          id: string;
          client_id: string;
          tipo: "salud" | "ads" | "publicaciones" | "stock";
          estado: "pending" | "running" | "success" | "error";
          resultado_json: Json | null;
          error_msg: string | null;
          started_at: string | null;
          finished_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["scraping_jobs"]["Row"]> & {
          client_id: string;
          tipo: "salud" | "ads" | "publicaciones" | "stock";
        };
        Update: Partial<Database["public"]["Tables"]["scraping_jobs"]["Row"]>;
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: "360" | "360_copilot";
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["companies"]["Row"]> & {
          name: string;
          slug: string;
          plan?: "360" | "360_copilot";
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Row"]>;
        Relationships: [];
      };
      ml_accounts: {
        Row: {
          id: string;
          company_id: string;
          seller_id: string | null;
          account_name: string;
          active: boolean;
          meli_account_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ml_accounts"]["Row"]> & {
          company_id: string;
          account_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["ml_accounts"]["Row"]>;
        Relationships: [];
      };
      users_v2: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          role:
            | "super_admin_meli_growth"
            | "internal_operator_meli_growth"
            | "client_manager"
            | "client_operator";
          company_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["users_v2"]["Row"]> & {
          id: string;
          email: string;
          role:
            | "super_admin_meli_growth"
            | "internal_operator_meli_growth"
            | "client_manager"
            | "client_operator";
        };
        Update: Partial<Database["public"]["Tables"]["users_v2"]["Row"]>;
        Relationships: [];
      };
      user_account_access: {
        Row: {
          id: string;
          user_id: string;
          ml_account_id: string;
          access_type: "manager" | "operator" | "internal";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_account_access"]["Row"]> & {
          user_id: string;
          ml_account_id: string;
          access_type: "manager" | "operator" | "internal";
        };
        Update: Partial<Database["public"]["Tables"]["user_account_access"]["Row"]>;
        Relationships: [];
      };
      metric_snapshots: {
        Row: {
          id: string;
          ml_account_id: string;
          snapshot_date: string;
          source: "api" | "scraper" | "manual" | "csv";
          reclamos: number | null;
          mediaciones: number | null;
          cancelaciones_vendedor: number | null;
          envios_a_tiempo: number | null;
          pubs_activas_pct: number | null;
          pubs_optimizadas_pct: number | null;
          ctr: number | null;
          margen_pre_ads: number | null;
          gasto_ads: number | null;
          ventas_ads: number | null;
          ventas_totales: number | null;
          acos: number | null;
          roas: number | null;
          tacos: number | null;
          incidencias_pct: number | null;
          uso_full_flex_pct: number | null;
          cancelaciones_stock_pct: number | null;
          skus_sin_stock_pct: number | null;
          dias_stock: number | null;
          lead_time_reposicion: number | null;
          sistema_reposicion: number | null;
          data_sources: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["metric_snapshots"]["Row"]> & {
          ml_account_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["metric_snapshots"]["Row"]>;
        Relationships: [];
      };
      account_health: {
        Row: {
          id: string;
          ml_account_id: string;
          snapshot_id: string;
          snapshot_date: string;
          score_global: number;
          estado_global: string;
          score_salud: number | null;
          score_publicaciones: number | null;
          score_ads: number | null;
          score_logistica: number | null;
          score_stock: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["account_health"]["Row"]> & {
          ml_account_id: string;
          snapshot_id: string;
          snapshot_date: string;
          score_global: number;
          estado_global: string;
        };
        Update: Partial<Database["public"]["Tables"]["account_health"]["Row"]>;
        Relationships: [];
      };
      alerts: {
        Row: {
          id: string;
          ml_account_id: string;
          health_id: string | null;
          categoria: string;
          prioridad: "urgente" | "alta" | "media" | "baja";
          titulo: string;
          descripcion: string | null;
          accion_concreta: string | null;
          benchmark_objetivo: string | null;
          audiencia: "internal" | "manager" | "operator" | "all";
          resuelta: boolean;
          resuelta_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["alerts"]["Row"]> & {
          ml_account_id: string;
          categoria: string;
          prioridad: "urgente" | "alta" | "media" | "baja";
          titulo: string;
          audiencia: "internal" | "manager" | "operator" | "all";
        };
        Update: Partial<Database["public"]["Tables"]["alerts"]["Row"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          ml_account_id: string;
          alert_id: string | null;
          assigned_to: string | null;
          titulo: string;
          descripcion: string | null;
          prioridad: "urgente" | "alta" | "media" | "baja";
          estado: "pendiente" | "en_curso" | "completada" | "descartada";
          due_date: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tasks"]["Row"]> & {
          ml_account_id: string;
          titulo: string;
          prioridad: "urgente" | "alta" | "media" | "baja";
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
      task_events: {
        Row: {
          id: string;
          task_id: string;
          user_id: string | null;
          evento: string;
          detalle: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["task_events"]["Row"]> & {
          task_id: string;
          evento: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_events"]["Row"]>;
        Relationships: [];
      };
      ingestion_runs: {
        Row: {
          id: string;
          ml_account_id: string;
          source: "api" | "scraper" | "manual" | "csv";
          status: "pending" | "running" | "success" | "error";
          blocks_fetched: Json;
          error_msg: string | null;
          started_at: string | null;
          finished_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ingestion_runs"]["Row"]> & {
          ml_account_id: string;
          source: "api" | "scraper" | "manual" | "csv";
          status: "pending" | "running" | "success" | "error";
        };
        Update: Partial<Database["public"]["Tables"]["ingestion_runs"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: "operator" | "client";
      client_plan: "starter" | "growth" | "scale";
      diagnostic_source: "manual" | "scraping" | "import";
      action_priority: "urgente" | "alta" | "media";
      action_status: "pendiente" | "en_curso" | "completada";
      file_type: "skus_stock" | "margenes" | "ficha_tecnica" | "otro";
      scraping_type: "salud" | "ads" | "publicaciones" | "stock";
      scraping_status: "pending" | "running" | "success" | "error";
      notification_type: "score_bajo" | "alerta_critica" | "accion_completada" | "archivo_procesado" | "reporte_semanal";
      meli_session_status: "missing" | "uploaded" | "validated" | "error";
      pricing_proposal_source: "manual" | "template";
      user_role_v2:
        | "super_admin_meli_growth"
        | "internal_operator_meli_growth"
        | "client_manager"
        | "client_operator";
      plan_type: "360" | "360_copilot";
    };
    CompositeTypes: Record<string, never>;
  };
};
