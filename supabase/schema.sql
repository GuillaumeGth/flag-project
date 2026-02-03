-- Enable PostGIS extension for geographic data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    email TEXT,
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

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('text', 'photo', 'audio')),
    text_content TEXT,
    media_url TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    radius INTEGER DEFAULT 30,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages policies (drop if exists, then create)
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages" ON public.messages
    FOR SELECT USING (
        auth.uid() = sender_id OR auth.uid() = recipient_id
    );

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Recipients can update messages" ON public.messages;
CREATE POLICY "Recipients can update messages" ON public.messages
    FOR UPDATE USING (auth.uid() = recipient_id);

-- Indexes (create if not exists)
CREATE INDEX IF NOT EXISTS messages_recipient_idx ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_location_idx ON public.messages USING GIST(location);
DROP INDEX IF EXISTS messages_unread_idx;
CREATE INDEX messages_unread_idx ON public.messages(recipient_id) WHERE is_read = FALSE;

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
            radius,
            is_read
        ) VALUES (
            bot_user_id,
            NEW.id,
            'text',
            'Bienvenue sur Flag ! Je suis Flag Bot, ton assistant. Tu peux m''envoyer des messages pour tester l''application. Bonne découverte !',
            ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326)::geography,
            30,
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
