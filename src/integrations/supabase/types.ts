export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_operations_log: {
        Row: {
          created_at: string
          function_name: string
          id: string
          invoked_by: string | null
          metadata: Json | null
          operation: string
          target_count: number | null
          target_table: string | null
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          invoked_by?: string | null
          metadata?: Json | null
          operation: string
          target_count?: number | null
          target_table?: string | null
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          invoked_by?: string | null
          metadata?: Json | null
          operation?: string
          target_count?: number | null
          target_table?: string | null
        }
        Relationships: []
      }
      alertas_precos: {
        Row: {
          created_at: string
          fornecedor_nome: string | null
          id: string
          lida: boolean
          mensagem: string
          preco_antigo: number | null
          preco_novo: number | null
          prioridade: string
          produto_nome: string | null
          quantidade: number | null
          site_id: string
          variacao_pct: number | null
        }
        Insert: {
          created_at?: string
          fornecedor_nome?: string | null
          id?: string
          lida?: boolean
          mensagem: string
          preco_antigo?: number | null
          preco_novo?: number | null
          prioridade?: string
          produto_nome?: string | null
          quantidade?: number | null
          site_id: string
          variacao_pct?: number | null
        }
        Update: {
          created_at?: string
          fornecedor_nome?: string | null
          id?: string
          lida?: boolean
          mensagem?: string
          preco_antigo?: number | null
          preco_novo?: number | null
          prioridade?: string
          produto_nome?: string | null
          quantidade?: number | null
          site_id?: string
          variacao_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_precos_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_monitorados"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          format: string
          id: string
          size_bytes: number
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          format: string
          id?: string
          size_bytes?: number
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          format?: string
          id?: string
          size_bytes?: number
          status?: string
        }
        Relationships: []
      }
      base_conhecimento: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string | null
          conteudo: string
          criado_em: string
          id: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string | null
          conteudo: string
          criado_em?: string
          id?: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string | null
          conteudo?: string
          criado_em?: string
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean
          linked_quote_id: string | null
          name: string
          sector: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          linked_quote_id?: string | null
          name: string
          sector?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          linked_quote_id?: string | null
          name?: string
          sector?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_linked_quote_id_fkey"
            columns: ["linked_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cep: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          email: string
          empresa: string | null
          endereco: string | null
          estado: string | null
          id: string
          municipio: string | null
          nome: string
          numero: string | null
          observacoes: string | null
          tags: string[] | null
          telefone: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cep?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email: string
          empresa?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          municipio?: string | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          tags?: string[] | null
          telefone: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          cep?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email?: string
          empresa?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          municipio?: string | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          tags?: string[] | null
          telefone?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      consumable_price_history: {
        Row: {
          change_date: string | null
          consumable_id: string
          created_at: string | null
          id: string
          notes: string | null
          price: number
          yield_pages: number
        }
        Insert: {
          change_date?: string | null
          consumable_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          price?: number
          yield_pages?: number
        }
        Update: {
          change_date?: string | null
          consumable_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          price?: number
          yield_pages?: number
        }
        Relationships: [
          {
            foreignKeyName: "consumable_price_history_consumable_id_fkey"
            columns: ["consumable_id"]
            isOneToOne: false
            referencedRelation: "equipment_consumables"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_consumables: {
        Row: {
          created_at: string
          equipment_id: string
          id: string
          mode: string
          name: string
          price: number
          sort_order: number
          updated_at: string
          yield_pages: number
        }
        Insert: {
          created_at?: string
          equipment_id: string
          id?: string
          mode?: string
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
          yield_pages?: number
        }
        Update: {
          created_at?: string
          equipment_id?: string
          id?: string
          mode?: string
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
          yield_pages?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_consumables_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_depreciation: {
        Row: {
          created_at: string
          id: string
          name: string
          purchase_value: number
          residual_value: number
          updated_at: string
          useful_life_months: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          purchase_value?: number
          residual_value?: number
          updated_at?: string
          useful_life_months?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          purchase_value?: number
          residual_value?: number
          updated_at?: string
          useful_life_months?: number
        }
        Relationships: []
      }
      equipment_maintenances: {
        Row: {
          attachments: string[] | null
          cost: number
          created_at: string
          created_by: string | null
          date: string
          equipment_id: string
          hours_spent: number
          id: string
          maintenance_type: string
          notes: string | null
          replaced_parts: string | null
          service_description: string
          technician: string
          total_counter: number | null
          updated_at: string
        }
        Insert: {
          attachments?: string[] | null
          cost?: number
          created_at?: string
          created_by?: string | null
          date?: string
          equipment_id: string
          hours_spent?: number
          id?: string
          maintenance_type?: string
          notes?: string | null
          replaced_parts?: string | null
          service_description?: string
          technician?: string
          total_counter?: number | null
          updated_at?: string
        }
        Update: {
          attachments?: string[] | null
          cost?: number
          created_at?: string
          created_by?: string | null
          date?: string
          equipment_id?: string
          hours_spent?: number
          id?: string
          maintenance_type?: string
          notes?: string | null
          replaced_parts?: string | null
          service_description?: string
          technician?: string
          total_counter?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenances_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
        ]
      }
      equipments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          printer_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          printer_type?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          printer_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      global_settings: {
        Row: {
          collection_fee_pct: number
          collection_pct: number
          created_at: string
          credit_card_pct: number
          default_margin_pct: number
          id: string
          invoice_pct: number
          tax_pct: number
          updated_at: string
          waste_pct: number
        }
        Insert: {
          collection_fee_pct?: number
          collection_pct?: number
          created_at?: string
          credit_card_pct?: number
          default_margin_pct?: number
          id?: string
          invoice_pct?: number
          tax_pct?: number
          updated_at?: string
          waste_pct?: number
        }
        Update: {
          collection_fee_pct?: number
          collection_pct?: number
          created_at?: string
          credit_card_pct?: number
          default_margin_pct?: number
          id?: string
          invoice_pct?: number
          tax_pct?: number
          updated_at?: string
          waste_pct?: number
        }
        Relationships: []
      }
      historico_precos: {
        Row: {
          criado_em: string
          id: string
          site_id: string
          valor: number
        }
        Insert: {
          criado_em?: string
          id?: string
          site_id: string
          valor: number
        }
        Update: {
          criado_em?: string
          id?: string
          site_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "historico_precos_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_monitorados"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_precos_tiers: {
        Row: {
          criado_em: string
          id: string
          quantidade: number
          site_id: string
          tier_id: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          criado_em?: string
          id?: string
          quantidade: number
          site_id: string
          tier_id: string
          valor_total: number
          valor_unitario: number
        }
        Update: {
          criado_em?: string
          id?: string
          quantidade?: number
          site_id?: string
          tier_id?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "historico_precos_tiers_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_monitorados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_precos_tiers_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "site_precos_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          admin_notes: string | null
          attachments: string[] | null
          created_at: string
          description: string
          equipment_id: string
          id: string
          requested_by: string
          resolved_at: string | null
          status: string
          updated_at: string
          urgency: string
        }
        Insert: {
          admin_notes?: string | null
          attachments?: string[] | null
          created_at?: string
          description: string
          equipment_id: string
          id?: string
          requested_by: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          admin_notes?: string | null
          attachments?: string[] | null
          created_at?: string
          description?: string
          equipment_id?: string
          id?: string
          requested_by?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
        ]
      }
      markup_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      markup_tiers: {
        Row: {
          created_at: string
          fixed_cost_pct: number
          id: string
          label: string
          margin_pct: number
          markup_group_id: string | null
          max_qty: number | null
          min_qty: number
          printer_category_id: string
          sort_order: number
          updated_at: string
          variable_cost_pct: number
        }
        Insert: {
          created_at?: string
          fixed_cost_pct?: number
          id?: string
          label: string
          margin_pct?: number
          markup_group_id?: string | null
          max_qty?: number | null
          min_qty?: number
          printer_category_id: string
          sort_order?: number
          updated_at?: string
          variable_cost_pct?: number
        }
        Update: {
          created_at?: string
          fixed_cost_pct?: number
          id?: string
          label?: string
          margin_pct?: number
          markup_group_id?: string | null
          max_qty?: number | null
          min_qty?: number
          printer_category_id?: string
          sort_order?: number
          updated_at?: string
          variable_cost_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "markup_tiers_markup_group_id_fkey"
            columns: ["markup_group_id"]
            isOneToOne: false
            referencedRelation: "markup_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markup_tiers_printer_category_id_fkey"
            columns: ["printer_category_id"]
            isOneToOne: false
            referencedRelation: "printer_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          channel_id: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          channel_id: string
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          is_edited: boolean
          parent_message_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          channel_id: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          parent_message_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          channel_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          parent_message_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_expenses: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          is_read: boolean
          message: string
          source_id: string | null
          source_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          is_read?: boolean
          message: string
          source_id?: string | null
          source_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          is_read?: boolean
          message?: string
          source_id?: string | null
          source_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      paper_price_history: {
        Row: {
          contact: string | null
          created_at: string
          freight_price: number
          id: string
          pack_price: number
          paper_id: string
          quote_date: string | null
          sheet_qty: number
          supplier: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          freight_price?: number
          id?: string
          pack_price?: number
          paper_id: string
          quote_date?: string | null
          sheet_qty?: number
          supplier?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          freight_price?: number
          id?: string
          pack_price?: number
          paper_id?: string
          quote_date?: string | null
          sheet_qty?: number
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paper_price_history_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
        ]
      }
      papers: {
        Row: {
          contact: string | null
          created_at: string
          freight_price: number
          grammage: string | null
          id: string
          is_active: boolean
          name: string
          pack_price: number
          quote_date: string | null
          sheet_qty: number
          sort_order: number
          supplier: string | null
          updated_at: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          freight_price?: number
          grammage?: string | null
          id?: string
          is_active?: boolean
          name: string
          pack_price?: number
          quote_date?: string | null
          sheet_qty?: number
          sort_order?: number
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          freight_price?: number
          grammage?: string | null
          id?: string
          is_active?: boolean
          name?: string
          pack_price?: number
          quote_date?: string | null
          sheet_qty?: number
          sort_order?: number
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pinned_messages: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          message_id: string
          pinned_by: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          message_id: string
          pinned_by: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          message_id?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_categories: {
        Row: {
          created_at: string
          default_markup_group_id: string | null
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_markup_group_id?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_markup_group_id?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_categories_default_markup_group_id_fkey"
            columns: ["default_markup_group_id"]
            isOneToOne: false
            referencedRelation: "markup_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_readings: {
        Row: {
          bw_prints: number | null
          color_prints: number | null
          consumable_id: string | null
          copies_bw: number | null
          counter: number
          created_at: string
          date: string
          equipment_id: string | null
          id: string
          notes: string | null
          operator_name: string | null
          printer_model: string
          reading_time: string | null
          total_prints: number | null
          type: string
        }
        Insert: {
          bw_prints?: number | null
          color_prints?: number | null
          consumable_id?: string | null
          copies_bw?: number | null
          counter?: number
          created_at?: string
          date?: string
          equipment_id?: string | null
          id?: string
          notes?: string | null
          operator_name?: string | null
          printer_model: string
          reading_time?: string | null
          total_prints?: number | null
          type?: string
        }
        Update: {
          bw_prints?: number | null
          color_prints?: number | null
          consumable_id?: string | null
          copies_bw?: number | null
          counter?: number
          created_at?: string
          date?: string
          equipment_id?: string | null
          id?: string
          notes?: string | null
          operator_name?: string | null
          printer_model?: string
          reading_time?: string | null
          total_prints?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_readings_consumable_id_fkey"
            columns: ["consumable_id"]
            isOneToOne: false
            referencedRelation: "equipment_consumables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_readings_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
        ]
      }
      printing_price_items: {
        Row: {
          code: string | null
          created_at: string
          equipment_id: string | null
          equipment_mode: string
          grammage: string | null
          id: string
          is_active: boolean
          markup_group_id: string | null
          paper_cost: number
          paper_type: string
          printer_category_id: string
          printing_cost: number
          side: string
          size: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          equipment_id?: string | null
          equipment_mode?: string
          grammage?: string | null
          id?: string
          is_active?: boolean
          markup_group_id?: string | null
          paper_cost?: number
          paper_type: string
          printer_category_id: string
          printing_cost?: number
          side?: string
          size?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          equipment_id?: string | null
          equipment_mode?: string
          grammage?: string | null
          id?: string
          is_active?: boolean
          markup_group_id?: string | null
          paper_cost?: number
          paper_type?: string
          printer_category_id?: string
          printing_cost?: number
          side?: string
          size?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printing_price_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printing_price_items_markup_group_id_fkey"
            columns: ["markup_group_id"]
            isOneToOne: false
            referencedRelation: "markup_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printing_price_items_printer_category_id_fkey"
            columns: ["printer_category_id"]
            isOneToOne: false
            referencedRelation: "printer_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      production_losses: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          description: string
          equipment_id: string
          error_type: string
          id: string
          operator_name: string
          quantity: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          equipment_id: string
          error_type?: string
          id?: string
          operator_name: string
          quantity?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          equipment_id?: string
          error_type?: string
          id?: string
          operator_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_losses_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
        ]
      }
      production_steps: {
        Row: {
          created_at: string
          description: string
          id: string
          time_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          time_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          time_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      productive_capacity: {
        Row: {
          created_at: string
          hours_per_month: number
          id: string
          production_employees: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          hours_per_month?: number
          id?: string
          production_employees?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          hours_per_month?: number
          id?: string
          production_employees?: number
          updated_at?: string
        }
        Relationships: []
      }
      produtos_catalogo: {
        Row: {
          categoria: string | null
          created_at: string
          dimensoes: string | null
          gramatura: string | null
          id: string
          nome_canonico: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          dimensoes?: string | null
          gramatura?: string | null
          id?: string
          nome_canonico: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          dimensoes?: string | null
          gramatura?: string | null
          id?: string
          nome_canonico?: string
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_labor_steps: {
        Row: {
          description: string
          id: string
          quote_id: string
          sort_order: number
          time_minutes: number
        }
        Insert: {
          description: string
          id?: string
          quote_id: string
          sort_order?: number
          time_minutes?: number
        }
        Update: {
          description?: string
          id?: string
          quote_id?: string
          sort_order?: number
          time_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_labor_steps_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_materials: {
        Row: {
          description: string
          id: string
          quantity: number
          quote_id: string
          sort_order: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          quantity?: number
          quote_id: string
          sort_order?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          quantity?: number
          quote_id?: string
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_materials_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_reminders: {
        Row: {
          created_at: string
          id: string
          interval_days: number
          is_active: boolean
          next_reminder_at: string
          quote_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interval_days?: number
          is_active?: boolean
          next_reminder_at: string
          quote_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interval_days?: number
          is_active?: boolean
          next_reminder_at?: string
          quote_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_reminders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_third_party: {
        Row: {
          cost: number
          description: string
          id: string
          quote_id: string
          sort_order: number
          supplier: string
        }
        Insert: {
          cost?: number
          description: string
          id?: string
          quote_id: string
          sort_order?: number
          supplier?: string
        }
        Update: {
          cost?: number
          description?: string
          id?: string
          quote_id?: string
          sort_order?: number
          supplier?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_third_party_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client: string
          created_at: string
          date: string
          id: string
          product: string
          profit_margin: string | null
          quote_number: string
          rejection_reason: string | null
          status: string
          updated_at: string
          validity: string | null
          value: number
        }
        Insert: {
          client: string
          created_at?: string
          date?: string
          id?: string
          product: string
          profit_margin?: string | null
          quote_number: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          validity?: string | null
          value?: number
        }
        Update: {
          client?: string
          created_at?: string
          date?: string
          id?: string
          product?: string
          profit_margin?: string | null
          quote_number?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          validity?: string | null
          value?: number
        }
        Relationships: []
      }
      reminders: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_completed: boolean
          recurrence: string
          remind_at: string
          source_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          recurrence?: string
          remind_at: string
          source_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          recurrence?: string
          remind_at?: string
          source_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      salaries: {
        Row: {
          created_at: string
          id: string
          is_production: boolean
          name: string
          salary: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_production?: boolean
          name: string
          salary?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_production?: boolean
          name?: string
          salary?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_precos_tiers: {
        Row: {
          ativo: boolean
          atualizado_em: string
          created_at: string
          id: string
          preco_anterior: number | null
          preco_total: number
          preco_unitario: number
          quantidade: number
          site_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          created_at?: string
          id?: string
          preco_anterior?: number | null
          preco_total?: number
          preco_unitario?: number
          quantidade?: number
          site_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          created_at?: string
          id?: string
          preco_anterior?: number | null
          preco_total?: number
          preco_unitario?: number
          quantidade?: number
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_precos_tiers_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_monitorados"
            referencedColumns: ["id"]
          },
        ]
      }
      sites_monitorados: {
        Row: {
          ativo: boolean
          categoria: string
          codigo_externo: string | null
          config_coleta: Json
          created_at: string
          fornecedor_nome: string | null
          id: string
          intervalo_check_horas: number
          metodo_coleta: string
          nome_produto: string
          preco_anterior: number | null
          preco_atual: number | null
          produto_catalogo_id: string | null
          scrape_error: string | null
          scrape_source: string | null
          scrape_status: string
          seletor_css: string | null
          timestamp_check: string | null
          tipo_fonte: string
          updated_at: string
          url_completa: string | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          codigo_externo?: string | null
          config_coleta?: Json
          created_at?: string
          fornecedor_nome?: string | null
          id?: string
          intervalo_check_horas?: number
          metodo_coleta?: string
          nome_produto: string
          preco_anterior?: number | null
          preco_atual?: number | null
          produto_catalogo_id?: string | null
          scrape_error?: string | null
          scrape_source?: string | null
          scrape_status?: string
          seletor_css?: string | null
          timestamp_check?: string | null
          tipo_fonte?: string
          updated_at?: string
          url_completa?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo_externo?: string | null
          config_coleta?: Json
          created_at?: string
          fornecedor_nome?: string | null
          id?: string
          intervalo_check_horas?: number
          metodo_coleta?: string
          nome_produto?: string
          preco_anterior?: number | null
          preco_atual?: number | null
          produto_catalogo_id?: string | null
          scrape_error?: string | null
          scrape_source?: string | null
          scrape_status?: string
          seletor_css?: string | null
          timestamp_check?: string | null
          tipo_fonte?: string
          updated_at?: string
          url_completa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_monitorados_produto_catalogo_id_fkey"
            columns: ["produto_catalogo_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      step_group_items: {
        Row: {
          created_at: string
          description: string
          id: string
          sort_order: number
          step_group_id: string
          time_minutes: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          sort_order?: number
          step_group_id: string
          time_minutes?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          step_group_id?: string
          time_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "step_group_items_step_group_id_fkey"
            columns: ["step_group_id"]
            isOneToOne: false
            referencedRelation: "step_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      step_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          cnpj: string | null
          created_at: string
          email: string
          endereco: string | null
          id: string
          nome: string
          telefone: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          email: string
          endereco?: string | null
          id?: string
          nome: string
          telefone: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          email?: string
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplies: {
        Row: {
          contato: string
          created_at: string
          data: string
          finalidade: string
          fornecedor: string
          id: string
          produto: string
          quantidade: number
          updated_at: string
          valor: number
          valor_unitario: number
        }
        Insert: {
          contato?: string
          created_at?: string
          data?: string
          finalidade?: string
          fornecedor?: string
          id?: string
          produto: string
          quantidade?: number
          updated_at?: string
          valor?: number
          valor_unitario?: number
        }
        Update: {
          contato?: string
          created_at?: string
          data?: string
          finalidade?: string
          fornecedor?: string
          id?: string
          produto?: string
          quantidade?: number
          updated_at?: string
          valor?: number
          valor_unitario?: number
        }
        Relationships: []
      }
      supply_purchase_history: {
        Row: {
          contato: string
          created_at: string
          data: string
          fornecedor: string
          id: string
          produto: string
          quantidade: number
          supply_id: string
          valor: number
          valor_unitario: number
        }
        Insert: {
          contato?: string
          created_at?: string
          data?: string
          fornecedor?: string
          id?: string
          produto: string
          quantidade?: number
          supply_id: string
          valor?: number
          valor_unitario?: number
        }
        Update: {
          contato?: string
          created_at?: string
          data?: string
          fornecedor?: string
          id?: string
          produto?: string
          quantidade?: number
          supply_id?: string
          valor?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "supply_purchase_history_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "supplies"
            referencedColumns: ["id"]
          },
        ]
      }
      tabelas_importadas: {
        Row: {
          created_at: string
          file_name: string
          file_type: string | null
          fornecedor_nome: string | null
          id: string
          itens_atualizados: number
          itens_criados: number
          observacoes: string | null
          total_linhas: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string | null
          fornecedor_nome?: string | null
          id?: string
          itens_atualizados?: number
          itens_criados?: number
          observacoes?: string | null
          total_linhas?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string | null
          fornecedor_nome?: string | null
          id?: string
          itens_atualizados?: number
          itens_criados?: number
          observacoes?: string | null
          total_linhas?: number
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      backup_get_cron_jobs: { Args: never; Returns: Json }
      backup_get_foreign_keys: { Args: never; Returns: Json }
      backup_get_functions: { Args: never; Returns: Json }
      backup_get_indexes: { Args: never; Returns: Json }
      backup_get_policies: { Args: never; Returns: Json }
      backup_get_realtime_publication: { Args: never; Returns: Json }
      backup_get_tables: { Args: never; Returns: Json }
      backup_get_triggers: { Args: never; Returns: Json }
      detectar_duplicatas_categorias: {
        Args: { _destino: string; _origem: string }
        Returns: {
          destino_count: number
          fornecedor: string
          origem_count: number
          produto: string
        }[]
      }
      is_channel_creator: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_profile_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
