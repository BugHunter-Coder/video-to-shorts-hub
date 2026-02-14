
-- Drop existing overly broad policies
DROP POLICY IF EXISTS "Users can view their own youtube connection" ON public.youtube_connections;
DROP POLICY IF EXISTS "Users can insert their own youtube connection" ON public.youtube_connections;
DROP POLICY IF EXISTS "Users can update their own youtube connection" ON public.youtube_connections;
DROP POLICY IF EXISTS "Users can delete their own youtube connection" ON public.youtube_connections;

-- Recreate policies scoped to authenticated role only
CREATE POLICY "Authenticated users can view own youtube connection"
ON public.youtube_connections FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own youtube connection"
ON public.youtube_connections FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own youtube connection"
ON public.youtube_connections FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete own youtube connection"
ON public.youtube_connections FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create a safe view excluding tokens for client-side queries
CREATE VIEW public.youtube_connections_safe AS
SELECT id, user_id, channel_id, channel_title, token_expires_at, created_at, updated_at
FROM public.youtube_connections;
