-- Enable PostGIS extension for geographic data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    marker_avatar_url TEXT,
    phone TEXT,
    email TEXT,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    is_searchable BOOLEAN NOT NULL DEFAULT TRUE,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users policies (drop if exists, then create)
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Push tokens table (multiple devices per user)
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    expo_push_token TEXT NOT NULL,
    device_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add last_used_at column if it doesn't exist (idempotent migration)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_push_tokens'
          AND column_name = 'last_used_at'
    ) THEN
        ALTER TABLE public.user_push_tokens ADD COLUMN last_used_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END
$$;

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can manage own push tokens" ON public.user_push_tokens
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Ensure one row per (user, token) for upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.user_push_tokens'::regclass
          AND contype = 'u'
          AND conname = 'user_push_tokens_user_token_key'
    ) THEN
        ALTER TABLE public.user_push_tokens
            ADD CONSTRAINT user_push_tokens_user_token_key
            UNIQUE (user_id, expo_push_token);
    END IF;
END
$$;

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('text', 'photo', 'audio')),
    text_content TEXT,
    media_url TEXT,
    location GEOGRAPHY(POINT, 4326),
    is_read BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_by_sender BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by_recipient BOOLEAN NOT NULL DEFAULT FALSE,
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    is_admin_placed BOOLEAN NOT NULL DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages policies (drop if exists, then create)
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages" ON public.messages
    FOR SELECT USING (
        auth.uid() = sender_id
        OR auth.uid() = recipient_id
        OR (
            is_public = true
            AND (
                -- sender is not private
                NOT EXISTS (
                    SELECT 1 FROM public.users
                    WHERE id = sender_id AND is_private = true
                )
                -- OR current user follows the sender
                OR EXISTS (
                    SELECT 1 FROM public.subscriptions
                    WHERE follower_id = auth.uid() AND following_id = sender_id
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        -- Cannot send to a bot
        AND (
            recipient_id IS NULL
            OR NOT EXISTS (
                SELECT 1 FROM public.users WHERE id = recipient_id AND is_bot = true
            )
        )
        AND (
            -- Public messages don't require a subscription
            is_public = true
            -- No recipient (broadcast)
            OR recipient_id IS NULL
            -- Private messages require a subscription in either direction
            OR EXISTS (
                SELECT 1 FROM public.subscriptions
                WHERE (follower_id = auth.uid() AND following_id = recipient_id)
                   OR (follower_id = recipient_id AND following_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Recipients can update messages" ON public.messages;
CREATE POLICY "Recipients can update messages" ON public.messages
    FOR UPDATE USING (auth.uid() = recipient_id)
    WITH CHECK (
        auth.uid() = recipient_id
        -- Recipients cannot touch the sender's soft-delete flag
        AND deleted_by_sender = (SELECT m.deleted_by_sender FROM public.messages m WHERE m.id = id)
    );

DROP POLICY IF EXISTS "Senders can soft delete messages" ON public.messages;
CREATE POLICY "Senders can soft delete messages" ON public.messages
    FOR UPDATE USING (auth.uid() = sender_id)
    WITH CHECK (
        auth.uid() = sender_id
        -- Senders cannot touch the recipient's soft-delete flag
        AND deleted_by_recipient = (SELECT m.deleted_by_recipient FROM public.messages m WHERE m.id = id)
    );

-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Indexes (create if not exists)
CREATE INDEX IF NOT EXISTS messages_recipient_idx ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_location_idx ON public.messages USING GIST(location);
DROP INDEX IF EXISTS messages_unread_idx;
CREATE INDEX messages_unread_idx ON public.messages(recipient_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON public.messages(reply_to_id);

-- Function to auto-create user profile on signup
-- Supports both phone auth (display_name) and Google OAuth (full_name/name)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, phone, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.phone,
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            NEW.email
        ),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url);
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the auth user creation
    RAISE LOG 'handle_new_user error: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to send welcome message from Flag Bot to new users
CREATE OR REPLACE FUNCTION public.send_welcome_message()
RETURNS TRIGGER AS $$
DECLARE
    bot_user_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Only send if Flag Bot exists and this isn't the Flag Bot itself
    IF NEW.id != bot_user_id AND EXISTS (SELECT 1 FROM public.users WHERE id = bot_user_id) THEN
        INSERT INTO public.messages (
            sender_id,
            recipient_id,
            content_type,
            text_content,
            location,
            is_read
        ) VALUES (
            bot_user_id,
            NEW.id,
            'text',
            'Bienvenue sur Flag ! Je suis Flag Bot, ton assistant. Tu peux m''envoyer des messages pour tester l''application. Bonne découverte !',
            ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326)::geography,
            false
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to send welcome message after user profile is created
DROP TRIGGER IF EXISTS on_user_created_send_welcome ON public.users;
CREATE TRIGGER on_user_created_send_welcome
    AFTER INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.send_welcome_message();

-- HTTP extension for calling external APIs (used for push notifications)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to send push notification via Expo when a new message is created
CREATE OR REPLACE FUNCTION public.send_push_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
    target_tokens TEXT[];
    token TEXT;
    sender_name TEXT;
    expo_url TEXT := 'https://exp.host/--/api/v2/push/send';
    payload JSONB;
    notif_title TEXT;
    notif_body TEXT;
    notif_pref BOOLEAN;
BEGIN
    -- Only notify for private messages (recipient exists)
    IF NEW.recipient_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check notify_private_flags preference (recipient's prefs for messages from sender)
    SELECT notify_private_flags INTO notif_pref
    FROM public.subscriptions
    WHERE follower_id = NEW.recipient_id AND following_id = NEW.sender_id;

    -- If preference is explicitly disabled, skip notification
    IF notif_pref = FALSE THEN
        RETURN NEW;
    END IF;

    -- Collect all push tokens for the recipient
    SELECT array_agg(expo_push_token)
    INTO target_tokens
    FROM public.user_push_tokens
    WHERE user_id = NEW.recipient_id;

    IF target_tokens IS NULL OR array_length(target_tokens, 1) = 0 THEN
        RETURN NEW;
    END IF;

    -- Get sender display name (fallback to generic label)
    SELECT COALESCE(display_name, 'Quelqu''un')
    INTO sender_name
    FROM public.users
    WHERE id = NEW.sender_id;

    -- Differentiate notification text based on whether message is geolocated
    IF NEW.location IS NOT NULL THEN
        notif_title := 'Nouveau flag à découvrir !';
        notif_body := sender_name || ' t''a laissé un message à découvrir sur la carte';
    ELSE
        notif_title := 'Nouveau message';
        notif_body := sender_name || ' t''a envoyé un message';
    END IF;

    FOREACH token IN ARRAY target_tokens LOOP
        payload := jsonb_build_object(
            'to', token,
            'sound', 'default',
            'title', notif_title,
            'body', notif_body,
            'data', jsonb_build_object('messageId', NEW.id)
        );
        PERFORM net.http_post(
            url := expo_url,
            body := payload,
            headers := '{"Content-Type": "application/json"}'::jsonb
        );
        INSERT INTO public.notification_logs(type, recipient_user_id, sender_user_id, expo_push_token, title, body, data)
        VALUES ('new_message', NEW.recipient_id, NEW.sender_id, token, notif_title, notif_body, jsonb_build_object('messageId', NEW.id));
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'send_push_on_new_message error: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_created_send_push ON public.messages;
CREATE TRIGGER on_message_created_send_push
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.send_push_on_new_message();

-- Function to send push notification to the author when their message is discovered
CREATE OR REPLACE FUNCTION public.send_push_on_message_discovered()
RETURNS TRIGGER AS $$
DECLARE
    target_tokens TEXT[];
    token TEXT;
    discoverer_name TEXT;
    expo_url TEXT := 'https://exp.host/--/api/v2/push/send';
    payload JSONB;
BEGIN
    -- Only fire when is_read transitions from false to true
    IF OLD.is_read = TRUE OR NEW.is_read = FALSE THEN
        RETURN NEW;
    END IF;

    -- Collect all push tokens for the sender (author)
    SELECT array_agg(expo_push_token)
    INTO target_tokens
    FROM public.user_push_tokens
    WHERE user_id = NEW.sender_id;

    IF target_tokens IS NULL OR array_length(target_tokens, 1) = 0 THEN
        RETURN NEW;
    END IF;

    -- Get discoverer display name
    SELECT COALESCE(display_name, 'Quelqu''un')
    INTO discoverer_name
    FROM public.users
    WHERE id = NEW.recipient_id;

    FOREACH token IN ARRAY target_tokens LOOP
        payload := jsonb_build_object(
            'to', token,
            'sound', 'default',
            'title', 'Ton message a été découvert ! 🎉',
            'body', discoverer_name || ' a découvert ton message',
            'data', jsonb_build_object('messageId', NEW.id)
        );

        PERFORM net.http_post(
            url := expo_url,
            body := payload,
            headers := '{"Content-Type": "application/json"}'::jsonb
        );
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'send_push_on_message_discovered error: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_discovered_send_push ON public.messages;
CREATE TRIGGER on_message_discovered_send_push
    AFTER UPDATE OF is_read ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.send_push_on_message_discovered();

-- Discovered public messages (tracks which public messages a user has discovered on the map)
CREATE TABLE IF NOT EXISTS public.discovered_public_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT discovered_public_messages_unique UNIQUE (user_id, message_id)
);

ALTER TABLE public.discovered_public_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own discoveries" ON public.discovered_public_messages;
CREATE POLICY "Users can view own discoveries" ON public.discovered_public_messages
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can mark as discovered" ON public.discovered_public_messages;
CREATE POLICY "Users can mark as discovered" ON public.discovered_public_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own discoveries" ON public.discovered_public_messages;
CREATE POLICY "Users can update own discoveries" ON public.discovered_public_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS discovered_public_messages_user_idx ON public.discovered_public_messages(user_id);

-- Subscriptions table (follow/unfollow)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    notify_private_flags BOOLEAN NOT NULL DEFAULT TRUE,
    notify_public_flags  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT subscriptions_unique UNIQUE (follower_id, following_id),
    CONSTRAINT subscriptions_no_self CHECK (follower_id != following_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
    FOR SELECT USING (auth.uid() = follower_id OR auth.uid() = following_id);

DROP POLICY IF EXISTS "Users can follow" ON public.subscriptions;
CREATE POLICY "Users can follow" ON public.subscriptions
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow" ON public.subscriptions;
CREATE POLICY "Users can unfollow" ON public.subscriptions
    FOR DELETE USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
    FOR UPDATE USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS subscriptions_follower_idx ON public.subscriptions(follower_id);
CREATE INDEX IF NOT EXISTS subscriptions_following_idx ON public.subscriptions(following_id);

-- Auto-subscribe every new user to Guigz
CREATE OR REPLACE FUNCTION public.auto_follow_guigz()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guigz_id UUID := 'c46b8f9d-dd8c-46b9-9b9f-aa5886952d11';
BEGIN
  IF NEW.id = guigz_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.subscriptions (follower_id, following_id, notify_private_flags, notify_public_flags)
  VALUES (NEW.id, guigz_id, true, true)
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_follow_guigz ON public.users;
CREATE TRIGGER trg_auto_follow_guigz
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_follow_guigz();

-- Auto-subscribe every new user to FläagBot
-- FläagBot UUID: 00000000-0000-0000-0000-000000000001
-- is_bot=true, is_searchable=false — unidirectional broadcast only
CREATE OR REPLACE FUNCTION public.auto_follow_flaagbot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  flaagbot_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF NEW.id = flaagbot_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.subscriptions (follower_id, following_id, notify_private_flags, notify_public_flags)
  VALUES (NEW.id, flaagbot_id, true, true)
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_follow_flaagbot ON public.users;
CREATE TRIGGER trg_auto_follow_flaagbot
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_follow_flaagbot();

-- Function to send push notification when someone gets a new follower
CREATE OR REPLACE FUNCTION public.send_push_on_new_follow()
RETURNS TRIGGER AS $$
DECLARE
    target_tokens TEXT[];
    token TEXT;
    follower_name TEXT;
    expo_url TEXT := 'https://exp.host/--/api/v2/push/send';
    payload JSONB;
BEGIN
    -- Collect all push tokens for the followed user
    SELECT array_agg(expo_push_token)
    INTO target_tokens
    FROM public.user_push_tokens
    WHERE user_id = NEW.following_id;

    IF target_tokens IS NULL OR array_length(target_tokens, 1) = 0 THEN
        RETURN NEW;
    END IF;

    -- Get follower display name
    SELECT COALESCE(display_name, 'Quelqu''un')
    INTO follower_name
    FROM public.users
    WHERE id = NEW.follower_id;

    FOREACH token IN ARRAY target_tokens LOOP
        payload := jsonb_build_object(
            'to', token,
            'sound', 'default',
            'title', 'Nouvel abonné',
            'body', follower_name || ' s''est abonné à vous',
            'data', jsonb_build_object('followerId', NEW.follower_id)
        );

        PERFORM net.http_post(
            url := expo_url,
            body := payload,
            headers := '{"Content-Type": "application/json"}'::jsonb
        );
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'send_push_on_new_follow error: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_subscription_created_send_push ON public.subscriptions;
CREATE TRIGGER on_subscription_created_send_push
    AFTER INSERT ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.send_push_on_new_follow();

-- Function to send push notification to followers when a new public message is created
CREATE OR REPLACE FUNCTION public.send_push_on_new_public_message()
RETURNS TRIGGER AS $$
DECLARE
  sub RECORD;
  target_tokens TEXT[];
  token TEXT;
  sender_name TEXT;
  expo_url TEXT := 'https://exp.host/--/api/v2/push/send';
  payload JSONB;
BEGIN
  -- Only handle public messages (no recipient)
  IF NEW.recipient_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, 'Quelqu''un') INTO sender_name
  FROM public.users WHERE id = NEW.sender_id;

  FOR sub IN
    SELECT s.follower_id
    FROM public.subscriptions s
    WHERE s.following_id = NEW.sender_id
      AND s.notify_public_flags = TRUE
  LOOP
    SELECT array_agg(expo_push_token) INTO target_tokens
    FROM public.user_push_tokens
    WHERE user_id = sub.follower_id;

    IF target_tokens IS NOT NULL AND array_length(target_tokens, 1) > 0 THEN
      FOREACH token IN ARRAY target_tokens LOOP
        payload := jsonb_build_object(
          'to', token,
          'sound', 'default',
          'title', 'Nouveau flag public !',
          'body', sender_name || ' a déposé un nouveau flag',
          'data', jsonb_build_object('messageId', NEW.id)
        );
        PERFORM net.http_post(
            url := expo_url,
            body := payload,
            headers := '{"Content-Type": "application/json"}'::jsonb
        );
      END LOOP;
    END IF;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'send_push_on_new_public_message error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_public_message_created_send_push ON public.messages;
CREATE TRIGGER on_public_message_created_send_push
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.send_push_on_new_public_message();

-- Storage bucket for media (photos, audio)
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for media bucket
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone can view media" ON storage.objects;
CREATE POLICY "Anyone can view media"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

-- Storage policies for avatars bucket
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- Error logs table + email alert on production errors
-- ============================================================

-- App config table (stores API keys and settings securely)
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- No client access — only service_role and triggers (SECURITY DEFINER) can read
DROP POLICY IF EXISTS "No client access to app_config" ON public.app_config;
CREATE POLICY "No client access to app_config" ON public.app_config
    FOR ALL USING (false);

-- Insert default config rows (to be updated via Supabase dashboard SQL editor)
INSERT INTO public.app_config (key, value) VALUES
    ('resend_api_key', ''),
    ('error_alert_email', '')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_message TEXT NOT NULL,
    error_context TEXT,          -- e.g. service/function name
    error_stack TEXT,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}', -- extra info (screen, OS, app version, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can insert their own error logs (or with null user_id)
DROP POLICY IF EXISTS "Users can insert error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Authenticated users can insert error_logs" ON public.error_logs;
CREATE POLICY "Authenticated users can insert error_logs" ON public.error_logs
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Only service_role can read/manage error logs
DROP POLICY IF EXISTS "Service role can read error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Service role can manage error_logs" ON public.error_logs;
CREATE POLICY "Service role can manage error_logs" ON public.error_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_user_id_idx ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS error_logs_context_idx ON public.error_logs(error_context);

-- Function to send email alert via Resend API when an error is logged
-- Configure via the app_config table:
--   UPDATE public.app_config SET value = 're_xxx' WHERE key = 'resend_api_key';
--   UPDATE public.app_config SET value = 'you@example.com' WHERE key = 'error_alert_email';
CREATE OR REPLACE FUNCTION public.send_error_email_alert()
RETURNS TRIGGER AS $$
DECLARE
    resend_key TEXT;
    alert_email TEXT;
    payload JSONB;
BEGIN
    -- Read config from app_config table
    SELECT value INTO resend_key FROM public.app_config WHERE key = 'resend_api_key';
    SELECT value INTO alert_email FROM public.app_config WHERE key = 'error_alert_email';

    -- Skip if not configured
    IF resend_key IS NULL OR resend_key = '' OR alert_email IS NULL OR alert_email = '' THEN
        RAISE LOG 'send_error_email_alert: skipped, missing resend_api_key or error_alert_email';
        RETURN NEW;
    END IF;

    payload := jsonb_build_object(
        'from', 'Flag App <onboarding@resend.dev>',
        'to', jsonb_build_array(alert_email),
        'subject', '[Flag] Erreur prod: ' || LEFT(NEW.error_message, 80),
        'html', '<h2>Erreur en production</h2>'
            || '<p><strong>Contexte:</strong> ' || COALESCE(NEW.error_context, 'N/A') || '</p>'
            || '<p><strong>Message:</strong> ' || NEW.error_message || '</p>'
            || '<p><strong>Stack:</strong></p><pre>' || COALESCE(NEW.error_stack, 'N/A') || '</pre>'
            || '<p><strong>User ID:</strong> ' || COALESCE(NEW.user_id::text, 'anonyme') || '</p>'
            || '<p><strong>Metadata:</strong></p><pre>' || COALESCE(NEW.metadata::text, '{}') || '</pre>'
            || '<p><strong>Date:</strong> ' || NEW.created_at::text || '</p>'
    );

    -- Uses pg_net (must be enabled: CREATE EXTENSION IF NOT EXISTS pg_net)
    PERFORM net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || resend_key,
            'Content-Type', 'application/json'
        ),
        body := payload
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'send_error_email_alert failed: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_error_log_send_email ON public.error_logs;
CREATE TRIGGER on_error_log_send_email
    AFTER INSERT ON public.error_logs
    FOR EACH ROW EXECUTE FUNCTION public.send_error_email_alert();

-- ============================================================
-- Notification logs (audit trail of every push sent)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    expo_push_token TEXT NOT NULL,
    title TEXT,
    body TEXT,
    data JSONB,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can query notification_logs
DROP POLICY IF EXISTS "admin_only" ON public.notification_logs;
CREATE POLICY "admin_only" ON public.notification_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
    );

CREATE INDEX IF NOT EXISTS notification_logs_recipient_idx ON public.notification_logs(recipient_user_id);
CREATE INDEX IF NOT EXISTS notification_logs_sent_at_idx ON public.notification_logs(sent_at DESC);

-- Follow requests table (for private accounts)
CREATE TABLE IF NOT EXISTS public.follow_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT follow_requests_unique UNIQUE (requester_id, target_id),
    CONSTRAINT follow_requests_no_self CHECK (requester_id != target_id)
);

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requester can view own requests" ON public.follow_requests;
CREATE POLICY "Requester can view own requests" ON public.follow_requests
    FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "Users can send follow requests" ON public.follow_requests;
CREATE POLICY "Users can send follow requests" ON public.follow_requests
    FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Requester can cancel request" ON public.follow_requests;
CREATE POLICY "Requester can cancel request" ON public.follow_requests
    FOR DELETE USING (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Target can respond to request" ON public.follow_requests;
CREATE POLICY "Target can respond to request" ON public.follow_requests
    FOR UPDATE USING (auth.uid() = target_id);

CREATE INDEX IF NOT EXISTS follow_requests_requester_idx ON public.follow_requests(requester_id);
CREATE INDEX IF NOT EXISTS follow_requests_target_idx ON public.follow_requests(target_id);
CREATE INDEX IF NOT EXISTS follow_requests_status_idx ON public.follow_requests(status);

-- Push notification when a follow request is received
CREATE OR REPLACE FUNCTION public.send_push_on_follow_request()
RETURNS TRIGGER AS $$
DECLARE
    target_tokens TEXT[];
    token TEXT;
    requester_name TEXT;
    expo_url TEXT := 'https://exp.host/--/api/v2/push/send';
    payload JSONB;
BEGIN
    IF NEW.status != 'pending' THEN RETURN NEW; END IF;

    SELECT array_agg(expo_push_token) INTO target_tokens
    FROM public.user_push_tokens WHERE user_id = NEW.target_id;

    IF target_tokens IS NULL OR array_length(target_tokens, 1) = 0 THEN RETURN NEW; END IF;

    SELECT COALESCE(display_name, 'Quelqu''un') INTO requester_name
    FROM public.users WHERE id = NEW.requester_id;

    FOREACH token IN ARRAY target_tokens LOOP
        payload := jsonb_build_object(
            'to', token,
            'sound', 'default',
            'title', 'Demande d''abonnement',
            'body', requester_name || ' souhaite s''abonner à vous',
            'data', jsonb_build_object('requesterId', NEW.requester_id)
        );
        PERFORM net.http_post(
            url := expo_url,
            body := payload,
            headers := '{"Content-Type": "application/json"}'::jsonb
        );
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'send_push_on_follow_request error: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follow_request_created_send_push ON public.follow_requests;
CREATE TRIGGER on_follow_request_created_send_push
    AFTER INSERT ON public.follow_requests
    FOR EACH ROW EXECUTE FUNCTION public.send_push_on_follow_request();

-- Message reactions table
-- Stores emoji reactions (❤️ 😂 😮 😢 😡 👍) on messages.
-- Unique per (message, user, emoji) — one reaction type per user per message.
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT message_reactions_unique UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Only users who can view the message can view its reactions
DROP POLICY IF EXISTS "Users can view reactions on accessible messages" ON public.message_reactions;
CREATE POLICY "Users can view reactions on accessible messages" ON public.message_reactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = message_id
              AND (auth.uid() = m.sender_id OR auth.uid() = m.recipient_id OR m.is_public = true)
        )
    );

-- Users can only insert their own reactions
DROP POLICY IF EXISTS "Users can add own reactions" ON public.message_reactions;
CREATE POLICY "Users can add own reactions" ON public.message_reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own reactions
DROP POLICY IF EXISTS "Users can delete own reactions" ON public.message_reactions;
CREATE POLICY "Users can delete own reactions" ON public.message_reactions
    FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS message_reactions_message_id_idx ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS message_reactions_user_id_idx ON public.message_reactions(user_id);

-- Function to send push notification to message author when someone reacts
CREATE OR REPLACE FUNCTION public.send_push_on_reaction()
RETURNS TRIGGER AS $$
DECLARE
    target_tokens TEXT[];
    token TEXT;
    reactor_name TEXT;
    message_author_id UUID;
    expo_url TEXT := 'https://exp.host/--/api/v2/push/send';
    payload JSONB;
BEGIN
    SELECT sender_id INTO message_author_id
    FROM public.messages
    WHERE id = NEW.message_id;

    -- Don't notify if reacting to your own message
    IF message_author_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    SELECT array_agg(expo_push_token)
    INTO target_tokens
    FROM public.user_push_tokens
    WHERE user_id = message_author_id;

    IF target_tokens IS NULL OR array_length(target_tokens, 1) = 0 THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(display_name, 'Quelqu''un')
    INTO reactor_name
    FROM public.users
    WHERE id = NEW.user_id;

    FOREACH token IN ARRAY target_tokens LOOP
        payload := jsonb_build_object(
            'to', token,
            'sound', 'default',
            'title', reactor_name || ' a réagi à ton message',
            'body', NEW.emoji,
            'data', jsonb_build_object('messageId', NEW.message_id)
        );

        PERFORM net.http_post(
            url := expo_url,
            body := payload,
            headers := '{"Content-Type": "application/json"}'::jsonb
        );
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'send_push_on_reaction error: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_reaction_created_send_push ON public.message_reactions;
CREATE TRIGGER on_reaction_created_send_push
    AFTER INSERT ON public.message_reactions
    FOR EACH ROW EXECUTE FUNCTION public.send_push_on_reaction();

-- Function to clean up push tokens unused for more than 30 days
-- Called from the client on app startup via RPC
CREATE OR REPLACE FUNCTION public.cleanup_stale_push_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.user_push_tokens
    WHERE user_id = auth.uid()
      AND last_used_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Comments on public flags
-- ============================================================

-- Comments table (text only, 1-level replies via parent_comment_id)
CREATE TABLE IF NOT EXISTS public.message_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.message_comments(id) ON DELETE CASCADE,
    text_content TEXT NOT NULL CHECK (char_length(text_content) > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.message_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS message_comments_message_id_idx ON public.message_comments(message_id);
CREATE INDEX IF NOT EXISTS message_comments_parent_idx ON public.message_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS message_comments_user_message_idx ON public.message_comments(user_id, message_id);

-- SELECT: visible if parent message is public AND user is sender or has discovered it
DROP POLICY IF EXISTS "Users can view comments on accessible public messages" ON public.message_comments;
CREATE POLICY "Users can view comments on accessible public messages" ON public.message_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = message_id
              AND m.is_public = true
              AND (
                  m.sender_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.discovered_public_messages d
                      WHERE d.message_id = m.id AND d.user_id = auth.uid()
                  )
              )
        )
    );

-- Helper: count user comments on a message without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_comment_count(p_message_id uuid, p_user_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM message_comments WHERE message_id = p_message_id AND user_id = p_user_id;
$$;

-- INSERT: same access check + own user_id + max 50 comments per user per flag
-- NOTE: count check uses SECURITY DEFINER helper to avoid infinite RLS recursion
DROP POLICY IF EXISTS "Users can comment on discovered public messages" ON public.message_comments;
CREATE POLICY "Users can comment on discovered public messages" ON public.message_comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = message_id
              AND m.is_public = true
              AND (
                  m.sender_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.discovered_public_messages d
                      WHERE d.message_id = m.id AND d.user_id = auth.uid()
                  )
              )
        )
        AND public.get_user_comment_count(message_comments.message_id, auth.uid()) < 50
    );

-- DELETE: only own comments
DROP POLICY IF EXISTS "Users can delete own comments" ON public.message_comments;
CREATE POLICY "Users can delete own comments" ON public.message_comments
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger: prevent nested replies (max 1 level)
CREATE OR REPLACE FUNCTION public.check_no_nested_reply()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_comment_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.message_comments
            WHERE id = NEW.parent_comment_id AND parent_comment_id IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'Cannot reply to a reply (max 1 level of nesting)';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_nested_reply ON public.message_comments;
CREATE TRIGGER trg_no_nested_reply
    BEFORE INSERT ON public.message_comments
    FOR EACH ROW EXECUTE FUNCTION public.check_no_nested_reply();

-- Comment likes table (heart toggle)
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES public.message_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT comment_likes_unique UNIQUE (comment_id, user_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx ON public.comment_likes(comment_id);

DROP POLICY IF EXISTS "Users can view comment likes" ON public.comment_likes;
CREATE POLICY "Users can view comment likes" ON public.comment_likes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.message_comments mc
            JOIN public.messages m ON m.id = mc.message_id
            WHERE mc.id = comment_id
              AND m.is_public = true
        )
    );

DROP POLICY IF EXISTS "Users can like comments" ON public.comment_likes;
CREATE POLICY "Users can like comments" ON public.comment_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike comments" ON public.comment_likes;
CREATE POLICY "Users can unlike comments" ON public.comment_likes
    FOR DELETE USING (auth.uid() = user_id);

-- Push notification when someone comments on a flag
CREATE OR REPLACE FUNCTION public.send_push_on_new_comment()
RETURNS TRIGGER AS $$
DECLARE
    flag_owner_id UUID;
    parent_comment_author_id UUID;
    commenter_name TEXT;
    target_user_id UUID;
    target_tokens TEXT[];
    token TEXT;
    expo_url TEXT := 'https://exp.host/--/api/v2/push/send';
    payload JSONB;
    notif_title TEXT;
    notif_body TEXT;
BEGIN
    -- Get flag owner
    SELECT sender_id INTO flag_owner_id FROM public.messages WHERE id = NEW.message_id;

    -- Get commenter name
    SELECT COALESCE(display_name, 'Quelqu''un') INTO commenter_name
    FROM public.users WHERE id = NEW.user_id;

    -- If this is a reply, notify the parent comment author
    IF NEW.parent_comment_id IS NOT NULL THEN
        SELECT user_id INTO parent_comment_author_id
        FROM public.message_comments WHERE id = NEW.parent_comment_id;

        IF parent_comment_author_id IS NOT NULL AND parent_comment_author_id != NEW.user_id THEN
            target_user_id := parent_comment_author_id;
            notif_title := commenter_name || ' a répondu à votre commentaire';
            notif_body := LEFT(NEW.text_content, 100);

            SELECT array_agg(expo_push_token) INTO target_tokens
            FROM public.user_push_tokens WHERE user_id = target_user_id;

            IF target_tokens IS NOT NULL AND array_length(target_tokens, 1) > 0 THEN
                FOREACH token IN ARRAY target_tokens LOOP
                    payload := jsonb_build_object(
                        'to', token, 'sound', 'default',
                        'title', notif_title, 'body', notif_body,
                        'data', jsonb_build_object('type', 'comment_reply', 'messageId', NEW.message_id)
                    );
                    PERFORM net.http_post(
                        url := expo_url,
                        body := payload,
                        headers := '{"Content-Type": "application/json"}'::jsonb
                    );
                END LOOP;
            END IF;
        END IF;
    END IF;

    -- Notify flag owner (unless they are the commenter or already notified as parent comment author)
    IF flag_owner_id != NEW.user_id
       AND (flag_owner_id IS DISTINCT FROM parent_comment_author_id OR NEW.parent_comment_id IS NULL) THEN
        notif_title := commenter_name || ' a commenté votre fläag';
        notif_body := LEFT(NEW.text_content, 100);

        SELECT array_agg(expo_push_token) INTO target_tokens
        FROM public.user_push_tokens WHERE user_id = flag_owner_id;

        IF target_tokens IS NOT NULL AND array_length(target_tokens, 1) > 0 THEN
            FOREACH token IN ARRAY target_tokens LOOP
                payload := jsonb_build_object(
                    'to', token, 'sound', 'default',
                    'title', notif_title, 'body', notif_body,
                    'data', jsonb_build_object('type', 'comment', 'messageId', NEW.message_id)
                );
                PERFORM net.http_post(
                    url := expo_url,
                    body := payload,
                    headers := '{"Content-Type": "application/json"}'::jsonb
                );
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'send_push_on_new_comment error: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_created_send_push ON public.message_comments;
CREATE TRIGGER on_comment_created_send_push
    AFTER INSERT ON public.message_comments
    FOR EACH ROW EXECUTE FUNCTION public.send_push_on_new_comment();

-- RPC helper: batch comment counts (used by fetchCommentCounts in comments.ts)
CREATE OR REPLACE FUNCTION public.get_comment_counts(message_ids UUID[])
RETURNS TABLE(message_id UUID, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT mc.message_id, COUNT(*)::BIGINT
    FROM public.message_comments mc
    WHERE mc.message_id = ANY(message_ids)
    GROUP BY mc.message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Top users for search screen (excludes bots and non-searchable users)
CREATE OR REPLACE FUNCTION public.get_top_users_by_followers(limit_count integer DEFAULT 10, exclude_user_id uuid DEFAULT NULL::uuid)
RETURNS SETOF users
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT u.*
  FROM public.users u
  LEFT JOIN public.subscriptions followers ON followers.following_id = u.id
  LEFT JOIN public.subscriptions following ON following.follower_id = u.id
  LEFT JOIN public.messages m ON m.sender_id = u.id AND m.is_public = true
  WHERE (exclude_user_id IS NULL OR u.id != exclude_user_id)
    AND u.is_searchable = true
    AND u.is_bot = false
  GROUP BY u.id
  -- Must have at least 1 public message OR a follower/following ratio > 50
  HAVING COUNT(DISTINCT m.id) > 0
      OR (COUNT(DISTINCT followers.follower_id) > 0
          AND COUNT(DISTINCT followers.follower_id)::float / GREATEST(COUNT(DISTINCT following.following_id), 1) > 50)
  ORDER BY
    -- Priority 1: high follower/following ratio (at least 1 follower required)
    CASE WHEN COUNT(DISTINCT followers.follower_id) = 0 THEN 0
         ELSE COUNT(DISTINCT followers.follower_id)::float / GREATEST(COUNT(DISTINCT following.following_id), 1)
    END DESC,
    -- Priority 2: most public messages
    COUNT(DISTINCT m.id) DESC
  LIMIT limit_count;
$$;


-- Friends-of-friends suggestions: returns users followed by people I follow,
-- that I don't already follow, ordered by how many of my followees follow them.
CREATE OR REPLACE FUNCTION public.get_suggested_users(limit_count integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  display_name text,
  avatar_url text,
  is_private boolean,
  mutual_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT
    u.id,
    u.display_name,
    u.avatar_url,
    u.is_private,
    COUNT(*) AS mutual_count
  FROM public.subscriptions s1
  JOIN public.subscriptions s2 ON s2.follower_id = s1.following_id
  JOIN public.users u ON u.id = s2.following_id
  WHERE s1.follower_id = auth.uid()
    AND s2.following_id != auth.uid()
    AND u.is_searchable = TRUE
    AND u.is_bot = FALSE
    AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions s3
      WHERE s3.follower_id = auth.uid()
        AND s3.following_id = s2.following_id
    )
  GROUP BY u.id, u.display_name, u.avatar_url, u.is_private
  ORDER BY mutual_count DESC
  LIMIT limit_count;
$$;
