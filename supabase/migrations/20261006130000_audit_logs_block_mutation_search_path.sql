-- Audit: pin the search_path of the append-only guard function.
-- Resolves the Supabase advisor "function_search_path_mutable" for
-- audit_logs_block_mutation (20261006120100_audit_logs.sql). The function
-- references no schema objects, so an empty search_path is safe.

alter function audit_logs_block_mutation() set search_path = '';
