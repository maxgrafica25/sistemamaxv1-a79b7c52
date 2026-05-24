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
      accounts_receivable: {
        Row: {
          category: string
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          order_id: string | null
          status: string
          total_value: number
          updated_at: string
        }
        Insert: {
          category?: string
          client_id?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          order_id?: string | null
          status?: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          order_id?: string | null
          status?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable_installments: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number
          created_at?: string
          due_date: string
          id?: string
          installment_number?: number
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_installments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
        ]
      }
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
      alert_recipients: {
        Row: {
          active: boolean
          created_at: string
          external_email: string | null
          id: string
          name: string
          notify_chat: boolean
          notify_email: boolean
          notify_inbox: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          external_email?: string | null
          id?: string
          name: string
          notify_chat?: boolean
          notify_email?: boolean
          notify_inbox?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          external_email?: string | null
          id?: string
          name?: string
          notify_chat?: boolean
          notify_email?: boolean
          notify_inbox?: boolean
          updated_at?: string
          user_id?: string | null
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
      client_recurring_products: {
        Row: {
          ativo: boolean
          aviso_antecedencia_dias: number
          client_id: string
          created_at: string
          created_by: string | null
          drive_folder_url: string | null
          frequencia_dias: number
          id: string
          nome: string
          observacoes: string | null
          proxima_prevista_em: string | null
          quote_preset_id: string | null
          ultima_impressao_em: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          aviso_antecedencia_dias?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          drive_folder_url?: string | null
          frequencia_dias?: number
          id?: string
          nome: string
          observacoes?: string | null
          proxima_prevista_em?: string | null
          quote_preset_id?: string | null
          ultima_impressao_em?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          aviso_antecedencia_dias?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          drive_folder_url?: string | null
          frequencia_dias?: number
          id?: string
          nome?: string
          observacoes?: string | null
          proxima_prevista_em?: string | null
          quote_preset_id?: string | null
          ultima_impressao_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_recurring_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_recurring_products_quote_preset_id_fkey"
            columns: ["quote_preset_id"]
            isOneToOne: false
            referencedRelation: "quote_presets"
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
      company_settings: {
        Row: {
          address: string | null
          company_name: string
          created_at: string
          default_loss_margin: number
          default_quote_validity_days: number
          default_tax_rate: number
          email: string | null
          id: string
          logo_url: string | null
          updated_at: string
          whatsapp_display: string | null
          whatsapp_number: string
        }
        Insert: {
          address?: string | null
          company_name?: string
          created_at?: string
          default_loss_margin?: number
          default_quote_validity_days?: number
          default_tax_rate?: number
          email?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string
          whatsapp_display?: string | null
          whatsapp_number?: string
        }
        Update: {
          address?: string | null
          company_name?: string
          created_at?: string
          default_loss_margin?: number
          default_quote_validity_days?: number
          default_tax_rate?: number
          email?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string
          whatsapp_display?: string | null
          whatsapp_number?: string
        }
        Relationships: []
      }
      consumable_price_history: {
        Row: {
          change_date: string | null
          consumable_id: string
          created_at: string | null
          id: string
          invoice_ref: string | null
          notes: string | null
          price: number
          quantity: number
          supplier: string | null
          unit_price: number | null
          yield_pages: number
        }
        Insert: {
          change_date?: string | null
          consumable_id: string
          created_at?: string | null
          id?: string
          invoice_ref?: string | null
          notes?: string | null
          price?: number
          quantity?: number
          supplier?: string | null
          unit_price?: number | null
          yield_pages?: number
        }
        Update: {
          change_date?: string | null
          consumable_id?: string
          created_at?: string | null
          id?: string
          invoice_ref?: string | null
          notes?: string | null
          price?: number
          quantity?: number
          supplier?: string | null
          unit_price?: number | null
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
      cv_calc_acabamento_labor_items: {
        Row: {
          acabamento_id: string
          consumo_qty: number
          consumo_tipo: string
          created_at: string
          descricao: string
          id: string
          production_step_id: string | null
          sort_order: number
          time_minutes: number
          updated_at: string
        }
        Insert: {
          acabamento_id: string
          consumo_qty?: number
          consumo_tipo?: string
          created_at?: string
          descricao?: string
          id?: string
          production_step_id?: string | null
          sort_order?: number
          time_minutes?: number
          updated_at?: string
        }
        Update: {
          acabamento_id?: string
          consumo_qty?: number
          consumo_tipo?: string
          created_at?: string
          descricao?: string
          id?: string
          production_step_id?: string | null
          sort_order?: number
          time_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_calc_acabamento_labor_items_acabamento_id_fkey"
            columns: ["acabamento_id"]
            isOneToOne: false
            referencedRelation: "cv_calc_acabamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_calc_acabamento_labor_items_production_step_id_fkey"
            columns: ["production_step_id"]
            isOneToOne: false
            referencedRelation: "production_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_calc_acabamento_media_order: {
        Row: {
          acabamento_id: string
          created_at: string
          sort_order: number
          tipo_midia: string
          updated_at: string
          visivel: boolean
        }
        Insert: {
          acabamento_id: string
          created_at?: string
          sort_order?: number
          tipo_midia: string
          updated_at?: string
          visivel?: boolean
        }
        Update: {
          acabamento_id?: string
          created_at?: string
          sort_order?: number
          tipo_midia?: string
          updated_at?: string
          visivel?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cv_calc_acabamento_media_order_acabamento_id_fkey"
            columns: ["acabamento_id"]
            isOneToOne: false
            referencedRelation: "cv_calc_acabamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_calc_acabamento_recipe_items: {
        Row: {
          acabamento_id: string
          consumo_qty: number
          consumo_tipo: string
          created_at: string
          id: string
          sort_order: number
          supply_id: string
          updated_at: string
        }
        Insert: {
          acabamento_id: string
          consumo_qty?: number
          consumo_tipo?: string
          created_at?: string
          id?: string
          sort_order?: number
          supply_id: string
          updated_at?: string
        }
        Update: {
          acabamento_id?: string
          consumo_qty?: number
          consumo_tipo?: string
          created_at?: string
          id?: string
          sort_order?: number
          supply_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_calc_acabamento_recipe_items_acabamento_id_fkey"
            columns: ["acabamento_id"]
            isOneToOne: false
            referencedRelation: "cv_calc_acabamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_calc_acabamento_recipe_items_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "supplies"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_calc_acabamentos: {
        Row: {
          ativo: boolean
          created_at: string
          custo_fixo: number
          custo_mt2: number
          custo_perimetro: number
          custo_unidade: number
          extra_cost_fixo: number
          extra_cost_mt2: number
          extra_cost_perimetro: number
          extra_cost_unidade: number
          familia: string
          id: string
          largura_max_cm: number | null
          lucro_fixo: number
          lucro_mt2: number
          lucro_perimetro: number
          lucro_unidade: number
          markup_override_pct: number | null
          nome: string
          pricing_mode: string
          sort_order: number
          tipos_midia_compativeis: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          custo_fixo?: number
          custo_mt2?: number
          custo_perimetro?: number
          custo_unidade?: number
          extra_cost_fixo?: number
          extra_cost_mt2?: number
          extra_cost_perimetro?: number
          extra_cost_unidade?: number
          familia: string
          id?: string
          largura_max_cm?: number | null
          lucro_fixo?: number
          lucro_mt2?: number
          lucro_perimetro?: number
          lucro_unidade?: number
          markup_override_pct?: number | null
          nome: string
          pricing_mode?: string
          sort_order?: number
          tipos_midia_compativeis?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          custo_fixo?: number
          custo_mt2?: number
          custo_perimetro?: number
          custo_unidade?: number
          extra_cost_fixo?: number
          extra_cost_mt2?: number
          extra_cost_perimetro?: number
          extra_cost_unidade?: number
          familia?: string
          id?: string
          largura_max_cm?: number | null
          lucro_fixo?: number
          lucro_mt2?: number
          lucro_perimetro?: number
          lucro_unidade?: number
          markup_override_pct?: number | null
          nome?: string
          pricing_mode?: string
          sort_order?: number
          tipos_midia_compativeis?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      cv_calc_config: {
        Row: {
          id: string
          sangria_adesivo_mm: number
          sangria_chapa_mm: number
          sangria_lona_mm: number
          sangria_outro_mm: number
          singleton: boolean
          updated_at: string
          valor_minimo: number
        }
        Insert: {
          id?: string
          sangria_adesivo_mm?: number
          sangria_chapa_mm?: number
          sangria_lona_mm?: number
          sangria_outro_mm?: number
          singleton?: boolean
          updated_at?: string
          valor_minimo?: number
        }
        Update: {
          id?: string
          sangria_adesivo_mm?: number
          sangria_chapa_mm?: number
          sangria_lona_mm?: number
          sangria_outro_mm?: number
          singleton?: boolean
          updated_at?: string
          valor_minimo?: number
        }
        Relationships: []
      }
      cv_calc_impressoes: {
        Row: {
          ativo: boolean
          comprimento_max_cm: number | null
          created_at: string
          custo_fixo: number
          custo_mt2: number
          id: string
          largura_max_cm: number | null
          lucro_fixo: number
          lucro_mt2: number
          nome: string
          sort_order: number
          tipos_midia_compativeis: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          comprimento_max_cm?: number | null
          created_at?: string
          custo_fixo?: number
          custo_mt2?: number
          id?: string
          largura_max_cm?: number | null
          lucro_fixo?: number
          lucro_mt2?: number
          nome: string
          sort_order?: number
          tipos_midia_compativeis?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          comprimento_max_cm?: number | null
          created_at?: string
          custo_fixo?: number
          custo_mt2?: number
          id?: string
          largura_max_cm?: number | null
          lucro_fixo?: number
          lucro_mt2?: number
          nome?: string
          sort_order?: number
          tipos_midia_compativeis?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      cv_calc_midias: {
        Row: {
          ativo: boolean
          created_at: string
          custo_fixo: number
          custo_mt2: number
          id: string
          lucro_fixo: number
          lucro_mt2: number
          nome: string
          sort_order: number
          tipo_midia: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          custo_fixo?: number
          custo_mt2?: number
          id?: string
          lucro_fixo?: number
          lucro_mt2?: number
          nome: string
          sort_order?: number
          tipo_midia: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          custo_fixo?: number
          custo_mt2?: number
          id?: string
          lucro_fixo?: number
          lucro_mt2?: number
          nome?: string
          sort_order?: number
          tipo_midia?: string
          updated_at?: string
        }
        Relationships: []
      }
      cv_quote_items: {
        Row: {
          acabamento_id: string | null
          acabamento_nome: string | null
          altura_cm: number
          aplicou_minimo: boolean
          area_total_m2: number
          art_status: string | null
          created_at: string
          finishes_json: Json
          id: string
          largura_cm: number
          material_id: string | null
          material_nome: string | null
          perimetro_m: number
          preco_acabamentos: number
          preco_impressao: number
          preco_midia: number
          preco_total: number
          printer_id: string | null
          printer_nome: string | null
          quantidade: number
          quote_id: string
          sort_order: number
          tem_emenda: boolean
          tier_group_id: string | null
          updated_at: string
        }
        Insert: {
          acabamento_id?: string | null
          acabamento_nome?: string | null
          altura_cm?: number
          aplicou_minimo?: boolean
          area_total_m2?: number
          art_status?: string | null
          created_at?: string
          finishes_json?: Json
          id?: string
          largura_cm?: number
          material_id?: string | null
          material_nome?: string | null
          perimetro_m?: number
          preco_acabamentos?: number
          preco_impressao?: number
          preco_midia?: number
          preco_total?: number
          printer_id?: string | null
          printer_nome?: string | null
          quantidade?: number
          quote_id: string
          sort_order?: number
          tem_emenda?: boolean
          tier_group_id?: string | null
          updated_at?: string
        }
        Update: {
          acabamento_id?: string | null
          acabamento_nome?: string | null
          altura_cm?: number
          aplicou_minimo?: boolean
          area_total_m2?: number
          art_status?: string | null
          created_at?: string
          finishes_json?: Json
          id?: string
          largura_cm?: number
          material_id?: string | null
          material_nome?: string | null
          perimetro_m?: number
          preco_acabamentos?: number
          preco_impressao?: number
          preco_midia?: number
          preco_total?: number
          printer_id?: string | null
          printer_nome?: string | null
          quantidade?: number
          quote_id?: string
          sort_order?: number
          tem_emenda?: boolean
          tier_group_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_quote_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "legacy_cv_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_quote_items_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "legacy_cv_printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
      finishing_price_tiers: {
        Row: {
          created_at: string
          finishing_id: string
          id: string
          label: string
          max_qty: number | null
          min_qty: number
          price_per_sheet: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          finishing_id: string
          id?: string
          label: string
          max_qty?: number | null
          min_qty: number
          price_per_sheet: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          finishing_id?: string
          id?: string
          label?: string
          max_qty?: number | null
          min_qty?: number
          price_per_sheet?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finishing_price_tiers_finishing_id_fkey"
            columns: ["finishing_id"]
            isOneToOne: false
            referencedRelation: "finishings_price_items"
            referencedColumns: ["id"]
          },
        ]
      }
      finishings_price_items: {
        Row: {
          applies_to: string[]
          auto_format_multiplier: boolean
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          price_per_sheet: number
          pricing_model: Database["public"]["Enums"]["finishing_pricing_model"]
          production_step_id: string | null
          size: string | null
          sort_order: number
          time_minutes: number
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          applies_to?: string[]
          auto_format_multiplier?: boolean
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price_per_sheet?: number
          pricing_model?: Database["public"]["Enums"]["finishing_pricing_model"]
          production_step_id?: string | null
          size?: string | null
          sort_order?: number
          time_minutes?: number
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          applies_to?: string[]
          auto_format_multiplier?: boolean
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price_per_sheet?: number
          pricing_model?: Database["public"]["Enums"]["finishing_pricing_model"]
          production_step_id?: string | null
          size?: string | null
          sort_order?: number
          time_minutes?: number
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finishings_price_items_production_step_id_fkey"
            columns: ["production_step_id"]
            isOneToOne: false
            referencedRelation: "production_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_types: {
        Row: {
          created_at: string
          default_value: number
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_value?: number
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_value?: number
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      gcal_sync_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          operation: string
          payload: Json
          processed_at: string | null
          reminder_id: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          operation: string
          payload?: Json
          processed_at?: string | null
          reminder_id?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          operation?: string
          payload?: Json
          processed_at?: string | null
          reminder_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      global_settings: {
        Row: {
          checklist_before_save: boolean
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
          checklist_before_save?: boolean
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
          checklist_before_save?: boolean
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
      historical_suggestion_cache: {
        Row: {
          computed_at: string
          expires_at: string
          payload: Json
          signature: string
        }
        Insert: {
          computed_at?: string
          expires_at?: string
          payload?: Json
          signature: string
        }
        Update: {
          computed_at?: string
          expires_at?: string
          payload?: Json
          signature?: string
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
      legacy_cv_finishes: {
        Row: {
          categoria_compativel: string[]
          created_at: string
          custo: number
          id: string
          is_active: boolean
          margem_pct: number
          nome: string
          sort_order: number
          tipo_calculo: string
          updated_at: string
        }
        Insert: {
          categoria_compativel?: string[]
          created_at?: string
          custo?: number
          id?: string
          is_active?: boolean
          margem_pct?: number
          nome: string
          sort_order?: number
          tipo_calculo: string
          updated_at?: string
        }
        Update: {
          categoria_compativel?: string[]
          created_at?: string
          custo?: number
          id?: string
          is_active?: boolean
          margem_pct?: number
          nome?: string
          sort_order?: number
          tipo_calculo?: string
          updated_at?: string
        }
        Relationships: []
      }
      legacy_cv_materials: {
        Row: {
          categoria: string
          created_at: string
          custo_mt2: number
          id: string
          is_active: boolean
          largura_util_cm: number
          margem_mt2_pct: number
          nome: string
          sort_order: number
          updated_at: string
          valor_minimo: number
        }
        Insert: {
          categoria: string
          created_at?: string
          custo_mt2?: number
          id?: string
          is_active?: boolean
          largura_util_cm?: number
          margem_mt2_pct?: number
          nome: string
          sort_order?: number
          updated_at?: string
          valor_minimo?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          custo_mt2?: number
          id?: string
          is_active?: boolean
          largura_util_cm?: number
          margem_mt2_pct?: number
          nome?: string
          sort_order?: number
          updated_at?: string
          valor_minimo?: number
        }
        Relationships: []
      }
      legacy_cv_printers: {
        Row: {
          categorias_compativeis: string[]
          created_at: string
          custo_fixo_setup: number
          custo_mt2_print: number
          id: string
          is_active: boolean
          largura_max_cm: number
          lucro_fixo_setup: number
          margem_mt2_print_pct: number
          nome: string
          sort_order: number
          tecnologia: string
          updated_at: string
        }
        Insert: {
          categorias_compativeis?: string[]
          created_at?: string
          custo_fixo_setup?: number
          custo_mt2_print?: number
          id?: string
          is_active?: boolean
          largura_max_cm?: number
          lucro_fixo_setup?: number
          margem_mt2_print_pct?: number
          nome: string
          sort_order?: number
          tecnologia?: string
          updated_at?: string
        }
        Update: {
          categorias_compativeis?: string[]
          created_at?: string
          custo_fixo_setup?: number
          custo_mt2_print?: number
          id?: string
          is_active?: boolean
          largura_max_cm?: number
          lucro_fixo_setup?: number
          margem_mt2_print_pct?: number
          nome?: string
          sort_order?: number
          tecnologia?: string
          updated_at?: string
        }
        Relationships: []
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
      material_group_items: {
        Row: {
          consumo_tipo: string
          created_at: string
          description: string
          id: string
          material_group_id: string
          quantity: number
          sort_order: number
          supply_id: string | null
          unit_price: number
        }
        Insert: {
          consumo_tipo?: string
          created_at?: string
          description: string
          id?: string
          material_group_id: string
          quantity?: number
          sort_order?: number
          supply_id?: string | null
          unit_price?: number
        }
        Update: {
          consumo_tipo?: string
          created_at?: string
          description?: string
          id?: string
          material_group_id?: string
          quantity?: number
          sort_order?: number
          supply_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_group_items_material_group_id_fkey"
            columns: ["material_group_id"]
            isOneToOne: false
            referencedRelation: "material_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_group_items_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "supplies"
            referencedColumns: ["id"]
          },
        ]
      }
      material_groups: {
        Row: {
          created_at: string
          id: string
          is_kit: boolean
          labor_hour_rate_manual: number
          labor_hour_rate_source: string
          labor_minutes: number
          margin_pct: number | null
          modulo: string[]
          name: string
          notes: string | null
          pricing_mode: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_kit?: boolean
          labor_hour_rate_manual?: number
          labor_hour_rate_source?: string
          labor_minutes?: number
          margin_pct?: number | null
          modulo?: string[]
          name: string
          notes?: string | null
          pricing_mode?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_kit?: boolean
          labor_hour_rate_manual?: number
          labor_hour_rate_source?: string
          labor_minutes?: number
          margin_pct?: number | null
          modulo?: string[]
          name?: string
          notes?: string | null
          pricing_mode?: string
          updated_at?: string
        }
        Relationships: []
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
          is_cut_size: boolean
          name: string
          pack_price: number
          purchase_sheet_height_mm: number | null
          purchase_sheet_width_mm: number | null
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
          is_cut_size?: boolean
          name: string
          pack_price?: number
          purchase_sheet_height_mm?: number | null
          purchase_sheet_width_mm?: number | null
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
          is_cut_size?: boolean
          name?: string
          pack_price?: number
          purchase_sheet_height_mm?: number | null
          purchase_sheet_width_mm?: number | null
          quote_date?: string | null
          sheet_qty?: number
          sort_order?: number
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_method_fees: {
        Row: {
          created_at: string
          fee_pct: number
          id: string
          method: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee_pct?: number
          id?: string
          method: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee_pct?: number
          id?: string
          method?: string
          sort_order?: number
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
      product_kit_item_variants: {
        Row: {
          created_at: string
          id: string
          item_id: string
          label: string | null
          max_value: number | null
          min_value: number
          position: number
          supply_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          label?: string | null
          max_value?: number | null
          min_value?: number
          position?: number
          supply_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          label?: string | null
          max_value?: number | null
          min_value?: number
          position?: number
          supply_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_kit_item_variants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "product_kit_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_kit_item_variants_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "supplies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_kit_items: {
        Row: {
          alternative_group: string | null
          auto_select_default: boolean
          created_at: string
          id: string
          item_type: string
          kit_id: string
          notes: string | null
          position: number
          process_step_id: string | null
          quantity_formula: string
          quantity_value: number
          role: string
          supply_id: string | null
          updated_at: string
        }
        Insert: {
          alternative_group?: string | null
          auto_select_default?: boolean
          created_at?: string
          id?: string
          item_type: string
          kit_id: string
          notes?: string | null
          position?: number
          process_step_id?: string | null
          quantity_formula?: string
          quantity_value?: number
          role?: string
          supply_id?: string | null
          updated_at?: string
        }
        Update: {
          alternative_group?: string | null
          auto_select_default?: boolean
          created_at?: string
          id?: string
          item_type?: string
          kit_id?: string
          notes?: string | null
          position?: number
          process_step_id?: string | null
          quantity_formula?: string
          quantity_value?: number
          role?: string
          supply_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_kit_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "product_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      product_kit_presets: {
        Row: {
          created_at: string
          kit_id: string
          preset_id: string
        }
        Insert: {
          created_at?: string
          kit_id: string
          preset_id: string
        }
        Update: {
          created_at?: string
          kit_id?: string
          preset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_kit_presets_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "product_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_kit_presets_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "quote_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      product_kits: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          product_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          product_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          product_kind?: string
          updated_at?: string
        }
        Relationships: []
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
      production_step_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      production_steps: {
        Row: {
          created_at: string
          description: string
          id: string
          step_group_id: string | null
          step_type: string
          time_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          step_group_id?: string | null
          step_type?: string
          time_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          step_group_id?: string | null
          step_type?: string
          time_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_steps_step_group_id_fkey"
            columns: ["step_group_id"]
            isOneToOne: false
            referencedRelation: "step_groups"
            referencedColumns: ["id"]
          },
        ]
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
          is_active: boolean
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_approval_receipts: {
        Row: {
          approved_at: string
          approver_ip: string | null
          approver_name: string
          created_at: string
          id: string
          items_snapshot: Json
          quote_id: string
          quote_number: string
          quote_version: number
          terms_text: string
          terms_version: string
          total_approved: number
          user_agent: string | null
        }
        Insert: {
          approved_at?: string
          approver_ip?: string | null
          approver_name: string
          created_at?: string
          id?: string
          items_snapshot?: Json
          quote_id: string
          quote_number: string
          quote_version?: number
          terms_text: string
          terms_version?: string
          total_approved?: number
          user_agent?: string | null
        }
        Update: {
          approved_at?: string
          approver_ip?: string | null
          approver_name?: string
          created_at?: string
          id?: string
          items_snapshot?: Json
          quote_id?: string
          quote_number?: string
          quote_version?: number
          terms_text?: string
          terms_version?: string
          total_approved?: number
          user_agent?: string | null
        }
        Relationships: []
      }
      quote_checklist_answers: {
        Row: {
          created_at: string
          question_id: string
          quote_id: string
          resposta_bool: boolean | null
          resposta_num: number | null
          resposta_text: string | null
          resposta_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          question_id: string
          quote_id: string
          resposta_bool?: boolean | null
          resposta_num?: number | null
          resposta_text?: string | null
          resposta_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          question_id?: string
          quote_id?: string
          resposta_bool?: boolean | null
          resposta_num?: number | null
          resposta_text?: string | null
          resposta_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_checklist_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quote_checklist_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_checklist_questions: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          hint: string | null
          id: string
          labor_custo_fixo: number
          labor_custo_m2: number
          labor_descricao: string | null
          labor_step_type: string | null
          pergunta: string
          sort_order: number
          tipo_resposta: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          hint?: string | null
          id?: string
          labor_custo_fixo?: number
          labor_custo_m2?: number
          labor_descricao?: string | null
          labor_step_type?: string | null
          pergunta: string
          sort_order?: number
          tipo_resposta: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          hint?: string | null
          id?: string
          labor_custo_fixo?: number
          labor_custo_m2?: number
          labor_descricao?: string | null
          labor_step_type?: string | null
          pergunta?: string
          sort_order?: number
          tipo_resposta?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_checklist_triggers: {
        Row: {
          altura_min_m: number | null
          area_max_m2: number | null
          area_min_m2: number | null
          created_at: string
          familia_acab: string[]
          id: string
          question_id: string
          sempre: boolean
          tipo_midia: string[]
        }
        Insert: {
          altura_min_m?: number | null
          area_max_m2?: number | null
          area_min_m2?: number | null
          created_at?: string
          familia_acab?: string[]
          id?: string
          question_id: string
          sempre?: boolean
          tipo_midia?: string[]
        }
        Update: {
          altura_min_m?: number | null
          area_max_m2?: number | null
          area_min_m2?: number | null
          created_at?: string
          familia_acab?: string[]
          id?: string
          question_id?: string
          sempre?: boolean
          tipo_midia?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "quote_checklist_triggers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quote_checklist_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_engagement_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json
          quote_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          quote_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          quote_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_engagement_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_labor_steps: {
        Row: {
          description: string
          id: string
          is_optional: boolean
          parent_item_id: string | null
          quote_id: string
          sort_order: number
          step_type: string
          time_minutes: number
        }
        Insert: {
          description: string
          id?: string
          is_optional?: boolean
          parent_item_id?: string | null
          quote_id: string
          sort_order?: number
          step_type?: string
          time_minutes?: number
        }
        Update: {
          description?: string
          id?: string
          is_optional?: boolean
          parent_item_id?: string | null
          quote_id?: string
          sort_order?: number
          step_type?: string
          time_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_labor_steps_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "quote_materials"
            referencedColumns: ["id"]
          },
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
          approved_at: string | null
          approved_value: number | null
          art_status: string | null
          booklet_duplex: boolean | null
          booklet_pages: number | null
          booklet_units: number | null
          catalog_item_id: string | null
          catalog_source: string | null
          custom_name: string | null
          description: string
          generated_title: string | null
          grammage: string | null
          height_mm: number | null
          id: string
          is_optional: boolean
          paper_type: string | null
          parent_item_id: string | null
          pieces_count: number | null
          print_colors: string | null
          product_kind: string | null
          quantity: number
          quantity_variations: Json
          quote_id: string
          reference: string | null
          side: string | null
          size: string | null
          sort_order: number
          status: string
          tier_group_id: string | null
          unit_price: number
          width_mm: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_value?: number | null
          art_status?: string | null
          booklet_duplex?: boolean | null
          booklet_pages?: number | null
          booklet_units?: number | null
          catalog_item_id?: string | null
          catalog_source?: string | null
          custom_name?: string | null
          description: string
          generated_title?: string | null
          grammage?: string | null
          height_mm?: number | null
          id?: string
          is_optional?: boolean
          paper_type?: string | null
          parent_item_id?: string | null
          pieces_count?: number | null
          print_colors?: string | null
          product_kind?: string | null
          quantity?: number
          quantity_variations?: Json
          quote_id: string
          reference?: string | null
          side?: string | null
          size?: string | null
          sort_order?: number
          status?: string
          tier_group_id?: string | null
          unit_price?: number
          width_mm?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_value?: number | null
          art_status?: string | null
          booklet_duplex?: boolean | null
          booklet_pages?: number | null
          booklet_units?: number | null
          catalog_item_id?: string | null
          catalog_source?: string | null
          custom_name?: string | null
          description?: string
          generated_title?: string | null
          grammage?: string | null
          height_mm?: number | null
          id?: string
          is_optional?: boolean
          paper_type?: string | null
          parent_item_id?: string | null
          pieces_count?: number | null
          print_colors?: string | null
          product_kind?: string | null
          quantity?: number
          quantity_variations?: Json
          quote_id?: string
          reference?: string | null
          side?: string | null
          size?: string | null
          sort_order?: number
          status?: string
          tier_group_id?: string | null
          unit_price?: number
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_materials_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "quote_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_materials_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_presets: {
        Row: {
          acabamentos_sugeridos: string[]
          altura_cm: number | null
          ativo: boolean
          created_at: string
          form_tipo: string | null
          icone: string
          id: string
          is_banner: boolean
          largura_cm: number | null
          midia_nome_match: string | null
          midia_tipo: string | null
          modulo: string
          nome: string
          ordem: number
          papel_exclui: string[]
          papel_inclui: string[]
          quantidade_padrao: number | null
          updated_at: string
        }
        Insert: {
          acabamentos_sugeridos?: string[]
          altura_cm?: number | null
          ativo?: boolean
          created_at?: string
          form_tipo?: string | null
          icone?: string
          id?: string
          is_banner?: boolean
          largura_cm?: number | null
          midia_nome_match?: string | null
          midia_tipo?: string | null
          modulo: string
          nome: string
          ordem?: number
          papel_exclui?: string[]
          papel_inclui?: string[]
          quantidade_padrao?: number | null
          updated_at?: string
        }
        Update: {
          acabamentos_sugeridos?: string[]
          altura_cm?: number | null
          ativo?: boolean
          created_at?: string
          form_tipo?: string | null
          icone?: string
          id?: string
          is_banner?: boolean
          largura_cm?: number | null
          midia_nome_match?: string | null
          midia_tipo?: string | null
          modulo?: string
          nome?: string
          ordem?: number
          papel_exclui?: string[]
          papel_inclui?: string[]
          quantidade_padrao?: number | null
          updated_at?: string
        }
        Relationships: []
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
      quote_suggestion_rules: {
        Row: {
          acao_acab_id: string | null
          acao_mensagem: string
          acao_question_id: string | null
          acao_tipo: string
          ativo: boolean
          cond_altura_min: number | null
          cond_area_max: number | null
          cond_area_min: number | null
          cond_cliente_tag: string[]
          cond_familia: string[]
          cond_sempre: boolean
          cond_tipo_midia: string[]
          created_at: string
          id: string
          nome: string
          prioridade: number
          severidade: string
          updated_at: string
        }
        Insert: {
          acao_acab_id?: string | null
          acao_mensagem?: string
          acao_question_id?: string | null
          acao_tipo: string
          ativo?: boolean
          cond_altura_min?: number | null
          cond_area_max?: number | null
          cond_area_min?: number | null
          cond_cliente_tag?: string[]
          cond_familia?: string[]
          cond_sempre?: boolean
          cond_tipo_midia?: string[]
          created_at?: string
          id?: string
          nome: string
          prioridade?: number
          severidade?: string
          updated_at?: string
        }
        Update: {
          acao_acab_id?: string | null
          acao_mensagem?: string
          acao_question_id?: string | null
          acao_tipo?: string
          ativo?: boolean
          cond_altura_min?: number | null
          cond_area_max?: number | null
          cond_area_min?: number | null
          cond_cliente_tag?: string[]
          cond_familia?: string[]
          cond_sempre?: boolean
          cond_tipo_midia?: string[]
          created_at?: string
          id?: string
          nome?: string
          prioridade?: number
          severidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_suggestion_rules_acao_acab_id_fkey"
            columns: ["acao_acab_id"]
            isOneToOne: false
            referencedRelation: "cv_calc_acabamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_suggestion_rules_acao_question_id_fkey"
            columns: ["acao_question_id"]
            isOneToOne: false
            referencedRelation: "quote_checklist_questions"
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
          tier_group_id: string | null
        }
        Insert: {
          cost?: number
          description: string
          id?: string
          quote_id: string
          sort_order?: number
          supplier?: string
          tier_group_id?: string | null
        }
        Update: {
          cost?: number
          description?: string
          id?: string
          quote_id?: string
          sort_order?: number
          supplier?: string
          tier_group_id?: string | null
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
          attention_to: string | null
          client: string
          client_id: string | null
          client_phone: string | null
          created_at: string
          date: string
          discount_type: string | null
          discount_value: number | null
          freight_type_id: string | null
          freight_value: number
          hidden_extras_value: number
          id: string
          is_locked: boolean
          is_template: boolean
          last_partial_seen_at: string | null
          last_viewed_at: string | null
          main_quantity: number | null
          notes: string | null
          options: Json | null
          parent_quote_id: string | null
          payment_method: string | null
          product: string
          profit_margin: string | null
          quote_number: string
          recurring_id: string | null
          rejection_reason: string | null
          status: string
          tags: string[]
          updated_at: string
          v3_payload: Json | null
          validity: string | null
          value: number
          version: number
          view_count: number
        }
        Insert: {
          attention_to?: string | null
          client: string
          client_id?: string | null
          client_phone?: string | null
          created_at?: string
          date?: string
          discount_type?: string | null
          discount_value?: number | null
          freight_type_id?: string | null
          freight_value?: number
          hidden_extras_value?: number
          id?: string
          is_locked?: boolean
          is_template?: boolean
          last_partial_seen_at?: string | null
          last_viewed_at?: string | null
          main_quantity?: number | null
          notes?: string | null
          options?: Json | null
          parent_quote_id?: string | null
          payment_method?: string | null
          product: string
          profit_margin?: string | null
          quote_number: string
          recurring_id?: string | null
          rejection_reason?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          v3_payload?: Json | null
          validity?: string | null
          value?: number
          version?: number
          view_count?: number
        }
        Update: {
          attention_to?: string | null
          client?: string
          client_id?: string | null
          client_phone?: string | null
          created_at?: string
          date?: string
          discount_type?: string | null
          discount_value?: number | null
          freight_type_id?: string | null
          freight_value?: number
          hidden_extras_value?: number
          id?: string
          is_locked?: boolean
          is_template?: boolean
          last_partial_seen_at?: string | null
          last_viewed_at?: string | null
          main_quantity?: number | null
          notes?: string | null
          options?: Json | null
          parent_quote_id?: string | null
          payment_method?: string | null
          product?: string
          profit_margin?: string | null
          quote_number?: string
          recurring_id?: string | null
          rejection_reason?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          v3_payload?: Json | null
          validity?: string | null
          value?: number
          version?: number
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_parent_quote_id_fkey"
            columns: ["parent_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "client_recurring_products"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_alerts_sent: {
        Row: {
          alerted_at: string
          alerted_on: string
          channel: string
          days_overdue: number
          equipment_id: string
          gap_start_date: string
          id: string
          is_first_critical: boolean
          resolved_at: string | null
          severity: string
        }
        Insert: {
          alerted_at?: string
          alerted_on?: string
          channel?: string
          days_overdue: number
          equipment_id: string
          gap_start_date: string
          id?: string
          is_first_critical?: boolean
          resolved_at?: string | null
          severity?: string
        }
        Update: {
          alerted_at?: string
          alerted_on?: string
          channel?: string
          days_overdue?: number
          equipment_id?: string
          gap_start_date?: string
          id?: string
          is_first_critical?: boolean
          resolved_at?: string | null
          severity?: string
        }
        Relationships: []
      }
      recurring_print_history: {
        Row: {
          carga_cor: string | null
          created_at: string
          equipment_id: string | null
          id: string
          impresso_em: string
          observacoes: string | null
          operador_id: string | null
          quote_id: string | null
          recurring_id: string
          sales_order_id: string | null
        }
        Insert: {
          carga_cor?: string | null
          created_at?: string
          equipment_id?: string | null
          id?: string
          impresso_em?: string
          observacoes?: string | null
          operador_id?: string | null
          quote_id?: string | null
          recurring_id: string
          sales_order_id?: string | null
        }
        Update: {
          carga_cor?: string | null
          created_at?: string
          equipment_id?: string | null
          id?: string
          impresso_em?: string
          observacoes?: string | null
          operador_id?: string | null
          quote_id?: string | null
          recurring_id?: string
          sales_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_print_history_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_print_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_print_history_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "client_recurring_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_print_history_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          cancelled_at: string | null
          cancelled_reason: string | null
          category: string
          created_at: string
          description: string | null
          event_at: string | null
          gcal_synced_at: string | null
          google_event_id: string | null
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
          cancelled_at?: string | null
          cancelled_reason?: string | null
          category?: string
          created_at?: string
          description?: string | null
          event_at?: string | null
          gcal_synced_at?: string | null
          google_event_id?: string | null
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
          cancelled_at?: string | null
          cancelled_reason?: string | null
          category?: string
          created_at?: string
          description?: string | null
          event_at?: string | null
          gcal_synced_at?: string | null
          google_event_id?: string | null
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
      sales_order_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      sales_order_items: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total: number
          order_id: string
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_total?: number
          order_id: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          order_id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          note: string | null
          order_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          order_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string | null
          delivery_date: string | null
          id: string
          internal_notes: string | null
          order_number: string
          payment_method: string | null
          payment_terms: string | null
          production_notes: string | null
          quote_id: string | null
          recurring_id: string | null
          status: string
          total_value: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          delivery_date?: string | null
          id?: string
          internal_notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_terms?: string | null
          production_notes?: string | null
          quote_id?: string | null
          recurring_id?: string | null
          status?: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          delivery_date?: string | null
          id?: string
          internal_notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_terms?: string | null
          production_notes?: string | null
          quote_id?: string | null
          recurring_id?: string | null
          status?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "client_recurring_products"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
          production_step_id: string
          sort_order: number
          step_group_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          production_step_id: string
          sort_order?: number
          step_group_id: string
        }
        Update: {
          created_at?: string
          id?: string
          production_step_id?: string
          sort_order?: number
          step_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_group_items_production_step_id_fkey"
            columns: ["production_step_id"]
            isOneToOne: false
            referencedRelation: "production_steps"
            referencedColumns: ["id"]
          },
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
          margem_pct: number
          modulo: string[]
          produto: string
          quantidade: number
          unidade: string
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
          margem_pct?: number
          modulo?: string[]
          produto: string
          quantidade?: number
          unidade?: string
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
          margem_pct?: number
          modulo?: string[]
          produto?: string
          quantidade?: number
          unidade?: string
          updated_at?: string
          valor?: number
          valor_unitario?: number
        }
        Relationships: []
      }
      supply_pricing_tiers: {
        Row: {
          created_at: string
          id: string
          label: string
          manual_price: number
          max_qty: number | null
          min_qty: number
          sort_order: number
          supply_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          manual_price: number
          max_qty?: number | null
          min_qty: number
          sort_order?: number
          supply_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          manual_price?: number
          max_qty?: number | null
          min_qty?: number
          sort_order?: number
          supply_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_pricing_tiers_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "supplies"
            referencedColumns: ["id"]
          },
        ]
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
      user_google_tokens: {
        Row: {
          access_token: string
          connected_at: string
          email_google: string | null
          expires_at: string
          refresh_token: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          email_google?: string | null
          expires_at: string
          refresh_token: string
          scope: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          email_google?: string | null
          expires_at?: string
          refresh_token?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_quote_items: {
        Args: { p_item_ids: string[]; p_quote_id: string }
        Returns: {
          approved_count: number
          total_value: number
        }[]
      }
      backup_get_cron_jobs: { Args: never; Returns: Json }
      backup_get_foreign_keys: { Args: never; Returns: Json }
      backup_get_functions: { Args: never; Returns: Json }
      backup_get_indexes: { Args: never; Returns: Json }
      backup_get_policies: { Args: never; Returns: Json }
      backup_get_realtime_publication: { Args: never; Returns: Json }
      backup_get_tables: { Args: never; Returns: Json }
      backup_get_triggers: { Args: never; Returns: Json }
      create_quote_version: { Args: { p_quote_id: string }; Returns: string }
      create_receivable_from_order: {
        Args: { p_installments: Json; p_order_id: string }
        Returns: string
      }
      delete_quotes_bulk: { Args: { p_ids: string[] }; Returns: Json }
      detectar_duplicatas_categorias: {
        Args: { _destino: string; _origem: string }
        Returns: {
          destino_count: number
          fornecedor: string
          origem_count: number
          produto: string
        }[]
      }
      enqueue_recurring_reminders: { Args: never; Returns: number }
      is_channel_creator: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_financeiro_user: { Args: { _user_id: string }; Returns: boolean }
      is_profile_admin: { Args: { _user_id: string }; Returns: boolean }
      list_users_admin: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          email: string
          email_confirmed_at: string
          is_active: boolean
          last_sign_in_at: string
          role: string
          user_id: string
        }[]
      }
      mark_recurring_printed: {
        Args: {
          p_carga_cor: string
          p_equipment_id: string
          p_observacoes: string
          p_quote_id?: string
          p_recurring_id: string
          p_sales_order_id?: string
        }
        Returns: string
      }
      next_order_number: { Args: never; Returns: string }
      register_quote_event: {
        Args: {
          p_event_type: string
          p_metadata?: Json
          p_quote_id: string
          p_user_agent?: string
          p_visitor_id?: string
        }
        Returns: undefined
      }
      register_quote_view: { Args: { quote_id: string }; Returns: undefined }
    }
    Enums: {
      finishing_pricing_model: "per_sheet" | "per_unit"
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
    Enums: {
      finishing_pricing_model: ["per_sheet", "per_unit"],
    },
  },
} as const
