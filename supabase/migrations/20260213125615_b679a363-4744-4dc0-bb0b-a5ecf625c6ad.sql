
-- Table to store YouTube OAuth tokens for each user
CREATE TABLE public.youtube_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  channel_id TEXT,
  channel_title TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.youtube_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own youtube connection"
ON public.youtube_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own youtube connection"
ON public.youtube_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own youtube connection"
ON public.youtube_connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own youtube connection"
ON public.youtube_connections FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_youtube_connections_updated_at
BEFORE UPDATE ON public.youtube_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add aspect_ratio column to videos table
ALTER TABLE public.videos ADD COLUMN aspect_ratio TEXT DEFAULT '9:16';
