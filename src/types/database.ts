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
      announcement_receipts: {
        Row: {
          acknowledged_at: string | null
          announcement_id: string
          created_at: string
          delivered_at: string | null
          employee_id: string
          id: string
          read_at: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          announcement_id: string
          created_at?: string
          delivered_at?: string | null
          employee_id: string
          id?: string
          read_at?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          announcement_id?: string
          created_at?: string
          delivered_at?: string | null
          employee_id?: string
          id?: string
          read_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_receipts_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_receipts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_targets: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_targets_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          acknowledgement_required: boolean
          body: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_pinned: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          acknowledgement_required?: boolean
          body: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          acknowledgement_required?: boolean
          body?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      approval_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          note: string | null
          subject_id: string
          subject_type: string
          subject_version: number
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          note?: string | null
          subject_id: string
          subject_type: string
          subject_version: number
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          note?: string | null
          subject_id?: string
          subject_type?: string
          subject_version?: number
        }
        Relationships: []
      }
      attendance_correction_requests: {
        Row: {
          attendance_record_id: string
          before_values: Json
          decided_by: string | null
          decision_note: string | null
          effective_values: Json | null
          id: string
          reason: string
          request_version: number
          requested_at: string
          requested_by: string
          requested_values: Json
          resolved_at: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          attendance_record_id: string
          before_values: Json
          decided_by?: string | null
          decision_note?: string | null
          effective_values?: Json | null
          id?: string
          reason: string
          request_version?: number
          requested_at?: string
          requested_by: string
          requested_values: Json
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          attendance_record_id?: string
          before_values?: Json
          decided_by?: string | null
          decision_note?: string | null
          effective_values?: Json | null
          id?: string
          reason?: string
          request_version?: number
          requested_at?: string
          requested_by?: string
          requested_values?: Json
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_correction_requests_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_evidence: {
        Row: {
          attendance_record_id: string
          deleted_at: string | null
          evidence_type: string
          id: string
          mime_type: string
          retention_status: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          attendance_record_id: string
          deleted_at?: string | null
          evidence_type: string
          id?: string
          mime_type: string
          retention_status?: string
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          attendance_record_id?: string
          deleted_at?: string | null
          evidence_type?: string
          id?: string
          mime_type?: string
          retention_status?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_evidence_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_status: Database["public"]["Enums"]["attendance_status"]
          clock_in_accuracy_m: number
          clock_in_at: string
          clock_in_latitude: number
          clock_in_longitude: number
          clock_out_accuracy_m: number | null
          clock_out_at: string | null
          clock_out_latitude: number | null
          clock_out_longitude: number | null
          created_at: string
          employee_id: string
          id: string
          outlet_id: string
          record_version: number
          schedule_assignment_id: string | null
          updated_at: string
          validation_due_at: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
          work_date: string
          worked_duration_min: number | null
        }
        Insert: {
          attendance_status?: Database["public"]["Enums"]["attendance_status"]
          clock_in_accuracy_m: number
          clock_in_at: string
          clock_in_latitude: number
          clock_in_longitude: number
          clock_out_accuracy_m?: number | null
          clock_out_at?: string | null
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          created_at?: string
          employee_id: string
          id?: string
          outlet_id: string
          record_version?: number
          schedule_assignment_id?: string | null
          updated_at?: string
          validation_due_at?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
          work_date: string
          worked_duration_min?: number | null
        }
        Update: {
          attendance_status?: Database["public"]["Enums"]["attendance_status"]
          clock_in_accuracy_m?: number
          clock_in_at?: string
          clock_in_latitude?: number
          clock_in_longitude?: number
          clock_out_accuracy_m?: number | null
          clock_out_at?: string | null
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          created_at?: string
          employee_id?: string
          id?: string
          outlet_id?: string
          record_version?: number
          schedule_assignment_id?: string | null
          updated_at?: string
          validation_due_at?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
          work_date?: string
          worked_duration_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_schedule_assignment_id_fkey"
            columns: ["schedule_assignment_id"]
            isOneToOne: false
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_risk_flags: {
        Row: {
          attendance_record_id: string
          created_at: string
          evidence: Json
          flag_type: string
          id: string
          review_note: string | null
          review_status: Database["public"]["Enums"]["risk_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
        }
        Insert: {
          attendance_record_id: string
          created_at?: string
          evidence?: Json
          flag_type: string
          id?: string
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["risk_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity: string
        }
        Update: {
          attendance_record_id?: string
          created_at?: string
          evidence?: Json
          flag_type?: string
          id?: string
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["risk_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_risk_flags_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_validations: {
        Row: {
          attendance_record_id: string
          decided_at: string
          decided_by: string
          decision: string
          decision_note: string | null
          id: string
          record_version: number
        }
        Insert: {
          attendance_record_id: string
          decided_at?: string
          decided_by: string
          decision: string
          decision_note?: string | null
          id?: string
          record_version: number
        }
        Update: {
          attendance_record_id?: string
          decided_at?: string
          decided_by?: string
          decision?: string
          decision_note?: string | null
          id?: string
          record_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_validations_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_values: Json | null
          before_values: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_values?: Json | null
          before_values?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_values?: Json | null
          before_values?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      backup_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          destination_outlet_id: string
          employee_id: string
          id: string
          origin_outlet_id: string
          reason: string
          schedule_assignment_id: string
          work_date: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          destination_outlet_id: string
          employee_id: string
          id?: string
          origin_outlet_id: string
          reason: string
          schedule_assignment_id: string
          work_date: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          destination_outlet_id?: string
          employee_id?: string
          id?: string
          origin_outlet_id?: string
          reason?: string
          schedule_assignment_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_assignments_destination_outlet_id_fkey"
            columns: ["destination_outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_assignments_origin_outlet_id_fkey"
            columns: ["origin_outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_assignments_schedule_assignment_id_fkey"
            columns: ["schedule_assignment_id"]
            isOneToOne: true
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_exports: {
        Row: {
          checksum: string | null
          completed_at: string | null
          created_at: string
          export_type: string
          id: string
          period_end: string
          period_start: string
          requested_by: string
          status: Database["public"]["Enums"]["job_status"]
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          checksum?: string | null
          completed_at?: string | null
          created_at?: string
          export_type: string
          id?: string
          period_end: string
          period_start: string
          requested_by: string
          status?: Database["public"]["Enums"]["job_status"]
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          checksum?: string | null
          completed_at?: string | null
          created_at?: string
          export_type?: string
          id?: string
          period_end?: string
          period_start?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["job_status"]
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      data_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          failed_rows: number
          id: string
          import_type: string
          requested_by: string
          source_file_path: string
          status: Database["public"]["Enums"]["job_status"]
          success_rows: number
          total_rows: number
          updated_at: string
          validation_errors: Json
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failed_rows?: number
          id?: string
          import_type: string
          requested_by: string
          source_file_path: string
          status?: Database["public"]["Enums"]["job_status"]
          success_rows?: number
          total_rows?: number
          updated_at?: string
          validation_errors?: Json
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failed_rows?: number
          id?: string
          import_type?: string
          requested_by?: string
          source_file_path?: string
          status?: Database["public"]["Enums"]["job_status"]
          success_rows?: number
          total_rows?: number
          updated_at?: string
          validation_errors?: Json
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          is_primary: boolean
          name: string
          phone: string
          relationship: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          is_primary?: boolean
          name: string
          phone: string
          relationship: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_off_days: {
        Row: {
          borrowed_from_adjacent_week: boolean
          created_at: string
          employee_id: string
          id: string
          off_date: string
          override_reason: string | null
          roster_period_id: string
          set_by: string
          source_week_start: string
          updated_at: string
        }
        Insert: {
          borrowed_from_adjacent_week?: boolean
          created_at?: string
          employee_id: string
          id?: string
          off_date: string
          override_reason?: string | null
          roster_period_id: string
          set_by: string
          source_week_start: string
          updated_at?: string
        }
        Update: {
          borrowed_from_adjacent_week?: boolean
          created_at?: string
          employee_id?: string
          id?: string
          off_date?: string
          override_reason?: string | null
          roster_period_id?: string
          set_by?: string
          source_week_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_off_days_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_off_days_roster_period_id_fkey"
            columns: ["roster_period_id"]
            isOneToOne: false
            referencedRelation: "roster_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_placements: {
        Row: {
          change_reason: string | null
          created_at: string
          employee_id: string
          end_date: string | null
          id: string
          is_primary: boolean
          outlet_id: string
          set_by: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          change_reason?: string | null
          created_at?: string
          employee_id: string
          end_date?: string | null
          id?: string
          is_primary?: boolean
          outlet_id: string
          set_by?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          change_reason?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          is_primary?: boolean
          outlet_id?: string
          set_by?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_placements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_placements_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          archived_at: string | null
          birth_date: string | null
          created_at: string
          employment_status_id: string
          full_name: string
          id: string
          job_position_id: string
          joined_at: string
          nik: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          birth_date?: string | null
          created_at?: string
          employment_status_id: string
          full_name: string
          id?: string
          job_position_id: string
          joined_at: string
          nik: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          birth_date?: string | null
          created_at?: string
          employment_status_id?: string
          full_name?: string
          id?: string
          job_position_id?: string
          joined_at?: string
          nik?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_employment_status_id_fkey"
            columns: ["employment_status_id"]
            isOneToOne: false
            referencedRelation: "employment_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "job_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_statuses: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      file_deletion_jobs: {
        Row: {
          attachment_id: string | null
          attempt_count: number
          completed_at: string | null
          created_at: string
          deletion_reason: string
          evidence_id: string | null
          id: string
          last_error: string | null
          scheduled_for: string
          status: Database["public"]["Enums"]["job_status"]
          storage_bucket: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          attachment_id?: string | null
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          deletion_reason: string
          evidence_id?: string | null
          id?: string
          last_error?: string | null
          scheduled_for: string
          status?: Database["public"]["Enums"]["job_status"]
          storage_bucket: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          attachment_id?: string | null
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          deletion_reason?: string
          evidence_id?: string | null
          id?: string
          last_error?: string | null
          scheduled_for?: string
          status?: Database["public"]["Enums"]["job_status"]
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_deletion_jobs_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "request_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_deletion_jobs_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "attendance_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      job_positions: {
        Row: {
          auto_roster_eligible: boolean
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          auto_roster_eligible?: boolean
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          auto_roster_eligible?: boolean
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_entitlements: {
        Row: {
          created_at: string
          employee_id: string
          expired_days: number
          granted_days: number
          id: string
          leave_type_id: string
          reserved_days: number
          updated_at: string
          used_days: number
          year: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          expired_days?: number
          granted_days?: number
          id?: string
          leave_type_id: string
          reserved_days?: number
          updated_at?: string
          used_days?: number
          year: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          expired_days?: number
          granted_days?: number
          id?: string
          leave_type_id?: string
          reserved_days?: number
          updated_at?: string
          used_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_entitlements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_entitlements_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          employee_id: string
          ends_on: string
          id: string
          leave_type_id: string
          reason: string
          request_version: number
          requested_days: number
          starts_on: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id: string
          ends_on: string
          id?: string
          leave_type_id: string
          reason: string
          request_version?: number
          requested_days: number
          starts_on: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id?: string
          ends_on?: string
          id?: string
          leave_type_id?: string
          reason?: string
          request_version?: number
          requested_days?: number
          starts_on?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          code: string
          created_at: string
          deducts_annual_balance: boolean
          document_required_after_days: number | null
          id: string
          is_active: boolean
          minimum_notice_days: number
          name: string
          requires_document: boolean
          same_day_allowed: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          deducts_annual_balance?: boolean
          document_required_after_days?: number | null
          id?: string
          is_active?: boolean
          minimum_notice_days?: number
          name: string
          requires_document?: boolean
          same_day_allowed?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          deducts_annual_balance?: boolean
          document_required_after_days?: number | null
          id?: string
          is_active?: boolean
          minimum_notice_days?: number
          name?: string
          requires_document?: boolean
          same_day_allowed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notification_receipts: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          id: string
          in_app_read_at: string | null
          notification_id: string
          push_sent_at: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          in_app_read_at?: string | null
          notification_id: string
          push_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          in_app_read_at?: string | null
          notification_id?: string
          push_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_receipts_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          employee_id: string
          id: string
          notification_type: string
          payload: Json
          subject_id: string | null
          subject_type: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          employee_id: string
          id?: string
          notification_type: string
          payload?: Json
          subject_id?: string | null
          subject_type?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          employee_id?: string
          id?: string
          notification_type?: string
          payload?: Json
          subject_id?: string | null
          subject_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      outlet_shift_templates: {
        Row: {
          created_at: string
          early_checkout_tolerance_min: number
          ends_at: string
          id: string
          is_active: boolean
          late_tolerance_min: number
          outlet_id: string
          shift_type: Database["public"]["Enums"]["shift_type"]
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          early_checkout_tolerance_min?: number
          ends_at: string
          id?: string
          is_active?: boolean
          late_tolerance_min?: number
          outlet_id: string
          shift_type: Database["public"]["Enums"]["shift_type"]
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          early_checkout_tolerance_min?: number
          ends_at?: string
          id?: string
          is_active?: boolean
          late_tolerance_min?: number
          outlet_id?: string
          shift_type?: Database["public"]["Enums"]["shift_type"]
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlet_shift_templates_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      outlet_staffing_requirements: {
        Row: {
          cashier_count: number
          created_at: string
          effective_from: string
          effective_until: string | null
          id: string
          minimum_staff: number
          outlet_id: string
          shift_template_id: string
          updated_at: string
        }
        Insert: {
          cashier_count: number
          created_at?: string
          effective_from: string
          effective_until?: string | null
          id?: string
          minimum_staff: number
          outlet_id: string
          shift_template_id: string
          updated_at?: string
        }
        Update: {
          cashier_count?: number
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          minimum_staff?: number
          outlet_id?: string
          shift_template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlet_staffing_requirements_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outlet_staffing_requirements_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "outlet_shift_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      outlets: {
        Row: {
          address: string
          code: string
          created_at: string
          geofence_radius_m: number
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          policy_version_id: string | null
          updated_at: string
        }
        Insert: {
          address: string
          code: string
          created_at?: string
          geofence_radius_m?: number
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
          policy_version_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          code?: string
          created_at?: string
          geofence_radius_m?: number
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          policy_version_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlets_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_requests: {
        Row: {
          actual_duration_min: number | null
          approved_duration_min: number | null
          assigned_by: string | null
          attendance_record_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          employee_id: string
          id: string
          overtime_date: string
          planned_duration_min: number
          reason: string
          request_version: number
          source_type: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          actual_duration_min?: number | null
          approved_duration_min?: number | null
          assigned_by?: string | null
          attendance_record_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id: string
          id?: string
          overtime_date: string
          planned_duration_min: number
          reason: string
          request_version?: number
          source_type: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          actual_duration_min?: number | null
          approved_duration_min?: number | null
          assigned_by?: string | null
          attendance_record_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id?: string
          id?: string
          overtime_date?: string
          planned_duration_min?: number
          reason?: string
          request_version?: number
          source_type?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_requests_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_versions: {
        Row: {
          configuration: Json
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          id: string
          policy_type: string
          version_number: number
        }
        Insert: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          policy_type: string
          version_number: number
        }
        Update: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          policy_type?: string
          version_number?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_encrypted: string
          created_at: string
          device_label: string | null
          endpoint_encrypted: string
          endpoint_hash: string
          id: string
          last_used_at: string | null
          p256dh_encrypted: string
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_encrypted: string
          created_at?: string
          device_label?: string | null
          endpoint_encrypted: string
          endpoint_hash: string
          id?: string
          last_used_at?: string | null
          p256dh_encrypted: string
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_encrypted?: string
          created_at?: string
          device_label?: string | null
          endpoint_encrypted?: string
          endpoint_hash?: string
          id?: string
          last_used_at?: string | null
          p256dh_encrypted?: string
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      request_attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          document_type: string
          employee_id: string
          id: string
          mime_type: string
          retention_until: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          document_type: string
          employee_id: string
          id?: string
          mime_type: string
          retention_until: string
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          subject_id: string
          subject_type: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          document_type?: string
          employee_id?: string
          id?: string
          mime_type?: string
          retention_until?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_attachments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_conflicts: {
        Row: {
          conflict_code: string
          created_at: string
          description: string
          employee_id: string | null
          generation_run_id: string
          id: string
          outlet_id: string | null
          resolution_status: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          suggestions: Json
          work_date: string | null
        }
        Insert: {
          conflict_code: string
          created_at?: string
          description: string
          employee_id?: string | null
          generation_run_id: string
          id?: string
          outlet_id?: string | null
          resolution_status?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          suggestions?: Json
          work_date?: string | null
        }
        Update: {
          conflict_code?: string
          created_at?: string
          description?: string
          employee_id?: string | null
          generation_run_id?: string
          id?: string
          outlet_id?: string | null
          resolution_status?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          suggestions?: Json
          work_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roster_conflicts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_conflicts_generation_run_id_fkey"
            columns: ["generation_run_id"]
            isOneToOne: false
            referencedRelation: "roster_generation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_conflicts_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_generation_runs: {
        Row: {
          algorithm_version: string
          completed_at: string | null
          created_at: string
          id: string
          requested_by: string
          roster_version_id: string
          rule_snapshot: Json
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          algorithm_version: string
          completed_at?: string | null
          created_at?: string
          id?: string
          requested_by: string
          roster_version_id: string
          rule_snapshot: Json
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          algorithm_version?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          requested_by?: string
          roster_version_id?: string
          rule_snapshot?: Json
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "roster_generation_runs_roster_version_id_fkey"
            columns: ["roster_version_id"]
            isOneToOne: false
            referencedRelation: "roster_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_periods: {
        Row: {
          active_version_id: string | null
          created_at: string
          id: string
          month_start: string
          publish_deadline: string
          status: Database["public"]["Enums"]["roster_period_status"]
          updated_at: string
        }
        Insert: {
          active_version_id?: string | null
          created_at?: string
          id?: string
          month_start: string
          publish_deadline: string
          status?: Database["public"]["Enums"]["roster_period_status"]
          updated_at?: string
        }
        Update: {
          active_version_id?: string | null
          created_at?: string
          id?: string
          month_start?: string
          publish_deadline?: string
          status?: Database["public"]["Enums"]["roster_period_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_periods_active_version_fk"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "roster_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_score_details: {
        Row: {
          employee_id: string
          fairness_score: number
          generation_run_id: string
          id: string
          middle_count: number
          morning_count: number
          night_count: number
          pairing_counts: Json
        }
        Insert: {
          employee_id: string
          fairness_score?: number
          generation_run_id: string
          id?: string
          middle_count?: number
          morning_count?: number
          night_count?: number
          pairing_counts?: Json
        }
        Update: {
          employee_id?: string
          fairness_score?: number
          generation_run_id?: string
          id?: string
          middle_count?: number
          morning_count?: number
          night_count?: number
          pairing_counts?: Json
        }
        Relationships: [
          {
            foreignKeyName: "roster_score_details_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_score_details_generation_run_id_fkey"
            columns: ["generation_run_id"]
            isOneToOne: false
            referencedRelation: "roster_generation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          created_by: string
          id: string
          published_at: string | null
          published_by: string | null
          roster_period_id: string
          status: Database["public"]["Enums"]["roster_version_status"]
          updated_at: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          created_by: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          roster_period_id: string
          status?: Database["public"]["Enums"]["roster_version_status"]
          updated_at?: string
          version_number: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          created_by?: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          roster_period_id?: string
          status?: Database["public"]["Enums"]["roster_version_status"]
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "roster_versions_roster_period_id_fkey"
            columns: ["roster_period_id"]
            isOneToOne: false
            referencedRelation: "roster_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_acknowledgements: {
        Row: {
          acknowledged_at: string
          acknowledged_version: number
          employee_id: string
          id: string
          schedule_assignment_id: string
        }
        Insert: {
          acknowledged_at?: string
          acknowledged_version: number
          employee_id: string
          id?: string
          schedule_assignment_id: string
        }
        Update: {
          acknowledged_at?: string
          acknowledged_version?: number
          employee_id?: string
          id?: string
          schedule_assignment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_acknowledgements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_acknowledgements_schedule_assignment_id_fkey"
            columns: ["schedule_assignment_id"]
            isOneToOne: false
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_assignments: {
        Row: {
          assignment_type: string
          created_at: string
          employee_id: string
          id: string
          outlet_id: string
          planned_duration_min: number
          planned_end: string | null
          planned_start: string | null
          roster_version_id: string
          shift_template_id: string | null
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
          work_date: string
        }
        Insert: {
          assignment_type?: string
          created_at?: string
          employee_id: string
          id?: string
          outlet_id: string
          planned_duration_min?: number
          planned_end?: string | null
          planned_start?: string | null
          roster_version_id: string
          shift_template_id?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
          work_date: string
        }
        Update: {
          assignment_type?: string
          created_at?: string
          employee_id?: string
          id?: string
          outlet_id?: string
          planned_duration_min?: number
          planned_end?: string | null
          planned_start?: string | null
          roster_version_id?: string
          shift_template_id?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_roster_version_id_fkey"
            columns: ["roster_version_id"]
            isOneToOne: false
            referencedRelation: "roster_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "outlet_shift_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_overrides: {
        Row: {
          after_values: Json
          before_values: Json
          changed_at: string
          changed_by: string
          id: string
          reason: string
          schedule_assignment_id: string
        }
        Insert: {
          after_values: Json
          before_values: Json
          changed_at?: string
          changed_by: string
          id?: string
          reason: string
          schedule_assignment_id: string
        }
        Update: {
          after_values?: Json
          before_values?: Json
          changed_at?: string
          changed_by?: string
          id?: string
          reason?: string
          schedule_assignment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_overrides_schedule_assignment_id_fkey"
            columns: ["schedule_assignment_id"]
            isOneToOne: false
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swap_requests: {
        Row: {
          colleague_decided_at: string | null
          colleague_id: string
          colleague_schedule_id: string
          created_at: string
          decision_note: string | null
          id: string
          reason: string
          requester_id: string
          requester_schedule_id: string
          status: string
          supervisor_decided_at: string | null
          supervisor_decided_by: string | null
          updated_at: string
        }
        Insert: {
          colleague_decided_at?: string | null
          colleague_id: string
          colleague_schedule_id: string
          created_at?: string
          decision_note?: string | null
          id?: string
          reason: string
          requester_id: string
          requester_schedule_id: string
          status?: string
          supervisor_decided_at?: string | null
          supervisor_decided_by?: string | null
          updated_at?: string
        }
        Update: {
          colleague_decided_at?: string | null
          colleague_id?: string
          colleague_schedule_id?: string
          created_at?: string
          decision_note?: string | null
          id?: string
          reason?: string
          requester_id?: string
          requester_schedule_id?: string
          status?: string
          supervisor_decided_at?: string | null
          supervisor_decided_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_colleague_id_fkey"
            columns: ["colleague_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_colleague_schedule_id_fkey"
            columns: ["colleague_schedule_id"]
            isOneToOne: false
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requester_schedule_id_fkey"
            columns: ["requester_schedule_id"]
            isOneToOne: false
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_accounts: {
        Row: {
          access_role: Database["public"]["Enums"]["access_role"]
          account_status: Database["public"]["Enums"]["account_status"]
          created_at: string
          deactivated_at: string | null
          employee_id: string | null
          last_login_at: string | null
          must_change_password: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          access_role?: Database["public"]["Enums"]["access_role"]
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          deactivated_at?: string | null
          employee_id?: string | null
          last_login_at?: string | null
          must_change_password?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          access_role?: Database["public"]["Enums"]["access_role"]
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          deactivated_at?: string | null
          employee_id?: string | null
          last_login_at?: string | null
          must_change_password?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_accounts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_employee_public_schedule: {
        Row: {
          assignment_type: string | null
          employee_name: string | null
          outlet_name: string | null
          planned_end: string | null
          planned_start: string | null
          schedule_status: string | null
          shift_type: string | null
          work_date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_view_announcement: {
        Args: { target_announcement_id: string }
        Returns: boolean
      }
      can_view_sensitive_operations: { Args: never; Returns: boolean }
      current_access_role: {
        Args: never
        Returns: Database["public"]["Enums"]["access_role"]
      }
      current_employee_id: { Args: never; Returns: string }
      decide_attendance_correction: {
        Args: {
          correction_id: string
          decision: string
          expected_version: number
          note: string
        }
        Returns: {
          attendance_record_id: string
          before_values: Json
          decided_by: string | null
          decision_note: string | null
          effective_values: Json | null
          id: string
          reason: string
          request_version: number
          requested_at: string
          requested_by: string
          requested_values: Json
          resolved_at: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance_correction_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_leave_request: {
        Args: {
          decision: string
          expected_version: number
          note: string
          request_id: string
        }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          employee_id: string
          ends_on: string
          id: string
          leave_type_id: string
          reason: string
          request_version: number
          requested_days: number
          starts_on: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leave_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_overtime_request: {
        Args: {
          approved_minutes: number
          decision: string
          expected_version: number
          note: string
          request_id: string
        }
        Returns: {
          actual_duration_min: number | null
          approved_duration_min: number | null
          assigned_by: string | null
          attendance_record_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          employee_id: string
          id: string
          overtime_date: string
          planned_duration_min: number
          reason: string
          request_version: number
          source_type: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "overtime_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_supervisor: { Args: never; Returns: boolean }
      validate_attendance: {
        Args: {
          attendance_id: string
          decision: string
          expected_version: number
          note: string
        }
        Returns: {
          attendance_status: Database["public"]["Enums"]["attendance_status"]
          clock_in_accuracy_m: number
          clock_in_at: string
          clock_in_latitude: number
          clock_in_longitude: number
          clock_out_accuracy_m: number | null
          clock_out_at: string | null
          clock_out_latitude: number | null
          clock_out_longitude: number | null
          created_at: string
          employee_id: string
          id: string
          outlet_id: string
          record_version: number
          schedule_assignment_id: string | null
          updated_at: string
          validation_due_at: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
          work_date: string
          worked_duration_min: number | null
        }
        SetofOptions: {
          from: "*"
          to: "attendance_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      access_role: "employee" | "supervisor" | "management"
      account_status: "invited" | "active" | "locked" | "deactivated"
      attendance_status: "open" | "completed" | "missing_checkout" | "corrected"
      job_status:
        | "scheduled"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      request_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
      risk_review_status: "open" | "cleared" | "confirmed"
      roster_period_status: "preparing" | "draft" | "published" | "closed"
      roster_version_status: "draft" | "published" | "superseded"
      schedule_status: "scheduled" | "off" | "cancelled"
      shift_type: "morning" | "middle" | "night"
      validation_status:
        | "pending"
        | "approved"
        | "rejected"
        | "needs_correction"
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
      access_role: ["employee", "supervisor", "management"],
      account_status: ["invited", "active", "locked", "deactivated"],
      attendance_status: ["open", "completed", "missing_checkout", "corrected"],
      job_status: [
        "scheduled",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      request_status: ["draft", "pending", "approved", "rejected", "cancelled"],
      risk_review_status: ["open", "cleared", "confirmed"],
      roster_period_status: ["preparing", "draft", "published", "closed"],
      roster_version_status: ["draft", "published", "superseded"],
      schedule_status: ["scheduled", "off", "cancelled"],
      shift_type: ["morning", "middle", "night"],
      validation_status: [
        "pending",
        "approved",
        "rejected",
        "needs_correction",
      ],
    },
  },
} as const
