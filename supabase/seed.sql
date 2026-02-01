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
