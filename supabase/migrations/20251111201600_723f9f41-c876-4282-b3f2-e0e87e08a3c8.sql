-- Fix search_path for update_revision_task_modified function
CREATE OR REPLACE FUNCTION public.update_revision_task_modified()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_modified_at = NOW();
  RETURN NEW;
END;
$$;