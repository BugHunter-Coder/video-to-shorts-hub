
-- Create storage bucket for user video uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('user-videos', 'user-videos', false);

-- Users can upload their own videos (stored in folder named by user_id)
CREATE POLICY "Users can upload their own videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own videos
CREATE POLICY "Users can view their own videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own videos
CREATE POLICY "Users can delete their own videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add file_url column to videos table for optional file reference
ALTER TABLE public.videos ADD COLUMN file_url text;
