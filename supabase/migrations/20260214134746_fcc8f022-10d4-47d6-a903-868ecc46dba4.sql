
-- Fix security definer view by setting it to use invoker security
ALTER VIEW public.youtube_connections_safe SET (security_invoker = on);
