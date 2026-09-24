/**
 * ARQUIVO GERADO AUTOMATICAMENTE a partir do banco — NÃO EDITE À MÃO.
 * Para atualizar depois de mudar uma migration: `npm run db:tipos`
 * (veja docs/MANUTENCAO.md). O teste tests/integracao/tipos-banco.test.ts
 * acusa quando este arquivo e o banco divergem.
 * Tipos auxiliares do app ficam em ./tipos-banco.ts.
 */
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
      cartoes: {
        Row: {
          ativo: boolean
          categoria_fatura_id: string
          conta_id: string | null
          created_at: string
          dia_fechamento: number
          dia_vencimento: number
          empresa_id: string
          final: string | null
          fornecedor_id: string
          id: string
          nome: string
          nome_normalizado: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          categoria_fatura_id: string
          conta_id?: string | null
          created_at?: string
          dia_fechamento: number
          dia_vencimento: number
          empresa_id: string
          final?: string | null
          fornecedor_id: string
          id?: string
          nome: string
          nome_normalizado?: never
          updated_at?: string
          user_id?: string
        }
        Update: {
          ativo?: boolean
          categoria_fatura_id?: string
          conta_id?: string | null
          created_at?: string
          dia_fechamento?: number
          dia_vencimento?: number
          empresa_id?: string
          final?: string | null
          fornecedor_id?: string
          id?: string
          nome?: string
          nome_normalizado?: never
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_categoria_fk"
            columns: ["categoria_fatura_id", "user_id"]
            referencedRelation: "categorias"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "cartoes_conta_fk"
            columns: ["conta_id", "empresa_id", "user_id"]
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id", "empresa_id", "user_id"]
          },
          {
            foreignKeyName: "cartoes_empresa_fk"
            columns: ["empresa_id", "user_id"]
            referencedRelation: "empresas"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "cartoes_fornecedor_fk"
            columns: ["fornecedor_id", "user_id"]
            referencedRelation: "fornecedores"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      categorias: {
        Row: {
          created_at: string
          id: string
          nome: string
          nome_normalizado: string | null
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          nome_normalizado?: never
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          nome_normalizado?: never
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compras_cartao: {
        Row: {
          cartao_id: string
          categoria_id: string
          created_at: string
          data_compra: string
          descricao: string
          id: string
          observacao: string | null
          parcelas: number
          primeira_fatura_mes: string
          updated_at: string
          user_id: string
          valor_total_centavos: number
        }
        Insert: {
          cartao_id: string
          categoria_id: string
          created_at?: string
          data_compra: string
          descricao: string
          id?: string
          observacao?: string | null
          parcelas: number
          primeira_fatura_mes: string
          updated_at?: string
          user_id?: string
          valor_total_centavos: number
        }
        Update: {
          cartao_id?: string
          categoria_id?: string
          created_at?: string
          data_compra?: string
          descricao?: string
          id?: string
          observacao?: string | null
          parcelas?: number
          primeira_fatura_mes?: string
          updated_at?: string
          user_id?: string
          valor_total_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_cartao_fk"
            columns: ["cartao_id", "user_id"]
            referencedRelation: "cartoes"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "compras_categoria_fk"
            columns: ["categoria_id", "user_id"]
            referencedRelation: "categorias"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          apelido: string
          apelido_normalizado: string | null
          ativa: boolean
          banco: string
          created_at: string
          empresa_id: string
          final: string | null
          id: string
          padrao: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          apelido: string
          apelido_normalizado?: never
          ativa?: boolean
          banco: string
          created_at?: string
          empresa_id: string
          final?: string | null
          id?: string
          padrao?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          apelido?: string
          apelido_normalizado?: never
          ativa?: boolean
          banco?: string
          created_at?: string
          empresa_id?: string
          final?: string | null
          id?: string
          padrao?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_empresa_fk"
            columns: ["empresa_id", "user_id"]
            referencedRelation: "empresas"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      empresas: {
        Row: {
          apelido: string
          apelido_normalizado: string | null
          cnpj: string | null
          created_at: string
          id: string
          razao_social: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apelido: string
          apelido_normalizado?: never
          cnpj?: string | null
          created_at?: string
          id?: string
          razao_social?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          apelido?: string
          apelido_normalizado?: never
          cnpj?: string | null
          created_at?: string
          id?: string
          razao_social?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          created_at: string
          id: string
          nome: string
          nome_normalizado: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          nome_normalizado?: never
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          nome_normalizado?: never
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lancamentos: {
        Row: {
          ajuste_centavos: number
          cartao_id: string | null
          categoria_id: string
          codigo_barras: string | null
          conta_id: string | null
          created_at: string
          descricao: string
          empresa_id: string
          fatura_mes: string | null
          fornecedor_id: string
          id: string
          observacao: string | null
          pago_em: string | null
          parcela: number | null
          serie_id: string | null
          status: string
          total_parcelas: number | null
          updated_at: string
          user_id: string
          valor_centavos: number
          vencimento: string
        }
        Insert: {
          ajuste_centavos?: number
          cartao_id?: string | null
          categoria_id: string
          codigo_barras?: string | null
          conta_id?: string | null
          created_at?: string
          descricao: string
          empresa_id: string
          fatura_mes?: string | null
          fornecedor_id: string
          id?: string
          observacao?: string | null
          pago_em?: string | null
          parcela?: number | null
          serie_id?: string | null
          status?: string
          total_parcelas?: number | null
          updated_at?: string
          user_id?: string
          valor_centavos: number
          vencimento: string
        }
        Update: {
          ajuste_centavos?: number
          cartao_id?: string | null
          categoria_id?: string
          codigo_barras?: string | null
          conta_id?: string | null
          created_at?: string
          descricao?: string
          empresa_id?: string
          fatura_mes?: string | null
          fornecedor_id?: string
          id?: string
          observacao?: string | null
          pago_em?: string | null
          parcela?: number | null
          serie_id?: string | null
          status?: string
          total_parcelas?: number | null
          updated_at?: string
          user_id?: string
          valor_centavos?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_cartao_fk"
            columns: ["cartao_id", "user_id"]
            referencedRelation: "cartoes"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "lancamentos_categoria_fk"
            columns: ["categoria_id", "user_id"]
            referencedRelation: "categorias"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "lancamentos_conta_fk"
            columns: ["conta_id", "empresa_id", "user_id"]
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id", "empresa_id", "user_id"]
          },
          {
            foreignKeyName: "lancamentos_empresa_fk"
            columns: ["empresa_id", "user_id"]
            referencedRelation: "empresas"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "lancamentos_fornecedor_fk"
            columns: ["fornecedor_id", "user_id"]
            referencedRelation: "fornecedores"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      movimentos_conta: {
        Row: {
          confirmado: boolean
          conta_id: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          saldo_informado: number | null
          tipo: string
          transferencia_id: string | null
          updated_at: string
          user_id: string
          valor_centavos: number
        }
        Insert: {
          confirmado?: boolean
          conta_id: string
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          saldo_informado?: number | null
          tipo: string
          transferencia_id?: string | null
          updated_at?: string
          user_id?: string
          valor_centavos: number
        }
        Update: {
          confirmado?: boolean
          conta_id?: string
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          saldo_informado?: number | null
          tipo?: string
          transferencia_id?: string | null
          updated_at?: string
          user_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_conta_fk"
            columns: ["conta_id", "user_id"]
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      parcelas_cartao: {
        Row: {
          cartao_id: string
          compra_id: string
          fatura_mes: string
          id: string
          numero: number
          total: number
          user_id: string
          valor_centavos: number
        }
        Insert: {
          cartao_id: string
          compra_id: string
          fatura_mes: string
          id?: string
          numero: number
          total: number
          user_id?: string
          valor_centavos: number
        }
        Update: {
          cartao_id?: string
          compra_id?: string
          fatura_mes?: string
          id?: string
          numero?: number
          total?: number
          user_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_cartao_fk"
            columns: ["cartao_id", "user_id"]
            referencedRelation: "cartoes"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "parcelas_compra_fk"
            columns: ["compra_id", "user_id"]
            referencedRelation: "compras_cartao"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      usuarios_autorizados: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atualizar_compra_cartao: {
        Args: {
          p_cartao_id: string
          p_categoria_id: string
          p_data_compra: string
          p_descricao: string
          p_id: string
          p_observacao: string
          p_parcelas: number
          p_primeira_fatura_mes: string
          p_valor_total: number
        }
        Returns: undefined
      }
      atualizar_lancamento: {
        Args: {
          p_categoria_id: string
          p_codigo_barras: string
          p_conta_id: string
          p_descricao: string
          p_empresa_id: string
          p_escopo: string
          p_fornecedor_id: string
          p_id: string
          p_observacao: string
          p_status: string
          p_valor_centavos: number
          p_vencimento: string
        }
        Returns: number
      }
      cnpj_valido: { Args: { p_cnpj: string }; Returns: boolean }
      competencia_valida: { Args: { p_mes: string }; Returns: boolean }
      conferir_saldo: {
        Args: { p_conta_id: string; p_saldo_informado: number }
        Returns: {
          confirmado: boolean
          conta_id: string
          created_at: string
          data: string
          descricao: string | null
          id: string
          saldo_informado: number | null
          tipo: string
          transferencia_id: string | null
          updated_at: string
          user_id: string
          valor_centavos: number
        }
        SetofOptions: {
          from: "*"
          to: "movimentos_conta"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      conta_em_exclusao: { Args: { p_user_id: string }; Returns: boolean }
      contas_a_conferir_hoje: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      data_na_competencia: {
        Args: { p_dia: number; p_mes: string }
        Returns: string
      }
      definir_ajuste_fatura: {
        Args: { p_ajuste: number; p_id: string; p_observacao: string }
        Returns: undefined
      }
      definir_pagamento: {
        Args: { p_conta_id?: string; p_id: string; p_pago: boolean }
        Returns: {
          ajuste_centavos: number
          cartao_id: string | null
          categoria_id: string
          codigo_barras: string | null
          conta_id: string | null
          created_at: string
          descricao: string
          empresa_id: string
          fatura_mes: string | null
          fornecedor_id: string
          id: string
          observacao: string | null
          pago_em: string | null
          parcela: number | null
          serie_id: string | null
          status: string
          total_parcelas: number | null
          updated_at: string
          user_id: string
          valor_centavos: number
          vencimento: string
        }
        SetofOptions: {
          from: "*"
          to: "lancamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      excluir_compra_cartao: { Args: { p_id: string }; Returns: undefined }
      excluir_lancamento: {
        Args: { p_escopo: string; p_id: string }
        Returns: number
      }
      excluir_transferencia: {
        Args: { p_transferencia_id: string }
        Returns: undefined
      }
      fatura_esta_paga: {
        Args: { p_cartao_id: string; p_mes: string }
        Returns: boolean
      }
      garantir_categorias_padrao: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nome: string
          ordem: number
        }[]
      }
      gerar_parcelas_compra: {
        Args: { p_compra_id: string }
        Returns: undefined
      }
      hoje_app: { Args: Record<PropertyKey, never>; Returns: string }
      inserir_categorias_padrao: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      normalizar_nome: { Args: { p_nome: string }; Returns: string }
      obter_ou_criar_fornecedor: { Args: { p_nome: string }; Returns: string }
      registrar_compra_cartao: {
        Args: {
          p_cartao_id: string
          p_categoria_id: string
          p_data_compra: string
          p_descricao: string
          p_observacao: string
          p_parcelas: number
          p_primeira_fatura_mes: string
          p_valor_total: number
        }
        Returns: string
      }
      rotulo_competencia: { Args: { p_mes: string }; Returns: string }
      saldos_contas: {
        Args: Record<PropertyKey, never>
        Returns: {
          conta_id: string
          saldo_centavos: number
        }[]
      }
      sincronizar_fatura: {
        Args: { p_cartao_id: string; p_mes: string }
        Returns: undefined
      }
      somar_meses_competencia: {
        Args: { p_mes: string; p_meses: number }
        Returns: string
      }
      transferir_entre_contas: {
        Args: {
          p_data: string
          p_descricao: string
          p_destino_id: string
          p_origem_id: string
          p_valor: number
        }
        Returns: string
      }
      usuario_autorizado: { Args: Record<PropertyKey, never>; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

