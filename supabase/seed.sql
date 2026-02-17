-- Seed script: Create a default "Flag Bot" user for testing
-- Run this in Supabase SQL Editor (with service_role access)

-- Create a system user in auth.users
-- Note: This uses a fixed UUID so it's consistent across environments
DO $$
DECLARE
    bot_user_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Insert into auth.users if not exists
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_user_meta_data,
        is_super_admin,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
    VALUES (
        bot_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'flagbot@flag.app',
        crypt('FlagBot2024!SecurePassword', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"display_name": "Flag Bot", "avatar_url": null}'::jsonb,
        FALSE,
        '',
        '',
        '',
        ''
    )
    ON CONFLICT (id) DO NOTHING;

    -- The trigger should auto-create the public.users entry
    -- But let's ensure it exists
    INSERT INTO public.users (id, display_name, email, created_at, updated_at)
    VALUES (
        bot_user_id,
        'Flag Bot',
        'flagbot@flag.app',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = 'Flag Bot',
        updated_at = NOW();

    RAISE NOTICE 'Flag Bot user created with ID: %', bot_user_id;
END $$;

-- Verify the user was created
SELECT id, display_name, email FROM public.users WHERE email = 'flagbot@flag.app';

-- ============================================================
-- Send a welcome message from Flag Bot to all existing users
-- ============================================================
INSERT INTO public.messages (
    sender_id,
    recipient_id,
    content_type,
    text_content,
    location,
    radius,
    is_read,
    created_at
)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid AS sender_id,
    u.id AS recipient_id,
    'text' AS content_type,
    'Bienvenue sur Flag ! Je suis Flag Bot, ton assistant. Tu peux m''envoyer des messages pour tester l''application. Bonne découverte !' AS text_content,
    ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326)::geography AS location, -- Paris coordinates
    30 AS radius,
    false AS is_read,
    NOW() AS created_at
FROM public.users u
WHERE u.id != '00000000-0000-0000-0000-000000000001'
AND NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.sender_id = '00000000-0000-0000-0000-000000000001'
    AND m.recipient_id = u.id
    AND m.text_content LIKE 'Bienvenue%'
);

-- ============================================================
-- Create test messages near user's location for map testing
-- Modify the coordinates below to match your current location
-- ============================================================
DO $$
DECLARE
    bot_user_id UUID := '00000000-0000-0000-0000-000000000001';
    test_user_id UUID;
    -- CHANGE THESE COORDINATES to your current location
    base_lat DOUBLE PRECISION := 48.8566;  -- Paris latitude
    base_lng DOUBLE PRECISION := 2.3522;   -- Paris longitude
BEGIN
    -- Get the first non-bot user
    SELECT id INTO test_user_id FROM public.users
    WHERE id != bot_user_id
    LIMIT 1;

    IF test_user_id IS NOT NULL THEN
        -- Message 1: Very close (discoverable)
        INSERT INTO public.messages (sender_id, recipient_id, content_type, text_content, location, radius, is_read, created_at)
        VALUES (
            bot_user_id,
            test_user_id,
            'text',
            'Ce message est tout proche ! Tu devrais pouvoir le lire.',
            ST_SetSRID(ST_MakePoint(base_lng + 0.0001, base_lat + 0.0001), 4326)::geography,
            30,
            false,
            NOW() - INTERVAL '5 minutes'
        )
        ON CONFLICT DO NOTHING;

        -- Message 2: Medium distance (~100m)
        INSERT INTO public.messages (sender_id, recipient_id, content_type, text_content, location, radius, is_read, created_at)
        VALUES (
            bot_user_id,
            test_user_id,
            'text',
            'Ce message est un peu plus loin, tu dois te rapprocher !',
            ST_SetSRID(ST_MakePoint(base_lng + 0.001, base_lat + 0.0005), 4326)::geography,
            30,
            false,
            NOW() - INTERVAL '10 minutes'
        )
        ON CONFLICT DO NOTHING;

        -- Message 3: Far (~300m)
        INSERT INTO public.messages (sender_id, recipient_id, content_type, text_content, location, radius, is_read, created_at)
        VALUES (
            bot_user_id,
            test_user_id,
            'text',
            'Tu me trouveras si tu marches un peu !',
            ST_SetSRID(ST_MakePoint(base_lng - 0.003, base_lat + 0.002), 4326)::geography,
            30,
            false,
            NOW() - INTERVAL '1 hour'
        )
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Created 3 test messages for user %', test_user_id;
    END IF;
END $$;
