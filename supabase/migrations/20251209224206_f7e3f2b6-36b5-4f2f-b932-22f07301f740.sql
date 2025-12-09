-- Create a security definer function to allow tutors to create notifications for students
CREATE OR REPLACE FUNCTION public.create_student_notification(
  p_student_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_action_data jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, action_data)
  VALUES (p_student_id, p_type, p_title, p_body, p_action_data)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_student_notification TO authenticated;