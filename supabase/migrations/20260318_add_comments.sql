-- Migration: Add comments on public flags
-- Date: 2026-03-18
-- Description: message_comments + comment_likes tables, RLS, triggers (nested reply guard + push notifications)

-- ============================================================
-- 1. Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS public.message_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.message_comments(id) ON DELETE CASCADE,
    text_content TEXT NOT NULL CHECK (char_length(text_content) > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES public.message_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT comment_likes_unique UNIQUE (comment_id, user_id)
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS message_comments_message_id_idx ON public.message_comments(message_id);
CREATE INDEX IF NOT EXISTS message_comments_parent_idx ON public.message_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS message_comments_user_message_idx ON public.message_comments(user_id, message_id);
CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx ON public.comment_likes(comment_id);

-- ============================================================
-- 3. RLS — message_comments
-- ============================================================

ALTER TABLE public.message_comments ENABLE ROW LEVEL SECURITY;

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
        AND (SELECT count(*) FROM public.message_comments mc
             WHERE mc.message_id = message_comments.message_id
               AND mc.user_id = auth.uid()) < 50
    );

DROP POLICY IF EXISTS "Users can delete own comments" ON public.message_comments;
CREATE POLICY "Users can delete own comments" ON public.message_comments
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 4. RLS — comment_likes
-- ============================================================

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

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

-- ============================================================
-- 5. Trigger — Prevent nested replies (max 1 level)
-- ============================================================

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

-- ============================================================
-- 6. Trigger — Push notification on new comment
-- ============================================================

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
                    PERFORM http(('POST', expo_url,
                        ARRAY[http_header('Content-Type', 'application/json')],
                        'application/json', payload::text)::http_request);
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
                PERFORM http(('POST', expo_url,
                    ARRAY[http_header('Content-Type', 'application/json')],
                    'application/json', payload::text)::http_request);
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

-- ============================================================
-- 7. RPC helper — batch comment counts (used by fetchCommentCounts)
-- ============================================================

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
