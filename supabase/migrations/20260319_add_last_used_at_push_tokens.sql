-- Migration: Add last_used_at to user_push_tokens
-- Date: 2026-03-19
-- Description: Adds last_used_at column to track token freshness, required by
--              registerPushToken (upsert) and cleanup_stale_push_tokens (RPC).

ALTER TABLE public.user_push_tokens
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ DEFAULT NOW();
