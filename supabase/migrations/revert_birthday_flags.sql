-- ============================================================
-- REVERT: birthday flags feature
-- Sessions: birthday_flags + birthday_flags_no_notification
-- ============================================================

-- 1. Restore send_push_on_new_message (without birthday check)
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

-- 2. Restore original SELECT policy (without birthday branch)
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages" ON public.messages
    FOR SELECT USING (
        auth.uid() = sender_id
        OR auth.uid() = recipient_id
        OR (
            is_public = true
            AND (
                NOT EXISTS (
                    SELECT 1 FROM public.users
                    WHERE id = sender_id AND is_private = true
                )
                OR EXISTS (
                    SELECT 1 FROM public.subscriptions
                    WHERE follower_id = auth.uid() AND following_id = sender_id
                )
            )
        )
    );

-- 3. Restore original INSERT policy (without admin birthday bypass)
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND (
            recipient_id IS NULL
            OR NOT EXISTS (
                SELECT 1 FROM public.users WHERE id = recipient_id AND is_bot = true
            )
        )
        AND (
            is_public = true
            OR recipient_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.subscriptions
                WHERE (follower_id = auth.uid() AND following_id = recipient_id)
                   OR (follower_id = recipient_id AND following_id = auth.uid())
            )
        )
    );

-- 4. Drop birthday index
DROP INDEX IF EXISTS public.messages_birthday_idx;

-- 5. Drop birthday columns
ALTER TABLE public.messages
    DROP COLUMN IF EXISTS birthday_visible_only,
    DROP COLUMN IF EXISTS birthday_target_user_id,
    DROP COLUMN IF EXISTS custom_marker_avatar_url;
