-- Add student_code column to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS student_code TEXT UNIQUE;

-- Create function to generate unique student codes
CREATE OR REPLACE FUNCTION public.generate_student_code(
  p_first_name TEXT,
  p_last_name TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  initials TEXT;
  random_num TEXT;
  new_code TEXT;
  attempts INTEGER := 0;
BEGIN
  initials := UPPER(
    COALESCE(LEFT(p_first_name, 1), 'X') || 
    COALESCE(LEFT(p_last_name, 1), 'X')
  );
  
  LOOP
    random_num := LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
    new_code := initials || random_num;
    
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE student_code = new_code) THEN
      RETURN new_code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RETURN initials || EXTRACT(EPOCH FROM NOW())::BIGINT % 100000;
    END IF;
  END LOOP;
END;
$$;

-- Update the handle_new_user_signup trigger to generate student codes
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    signup_role public.app_role;
    temp_role TEXT;
    new_student_code TEXT;
BEGIN
    temp_role := NEW.raw_user_meta_data->>'signup_role';
    signup_role := COALESCE(temp_role::public.app_role, 'student'::public.app_role);
    
    -- Generate unique student code
    new_student_code := public.generate_student_code(
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
    );
    
    INSERT INTO public.user_roles (user_id, role, metadata)
    VALUES (
        NEW.id,
        signup_role,
        jsonb_build_object('is_primary', TRUE, 'signup_method', 'email')
    );
    
    INSERT INTO public.user_profiles (id, first_name, last_name, display_name, student_code)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            CONCAT(NEW.raw_user_meta_data->>'first_name', ' ', NEW.raw_user_meta_data->>'last_name')
        ),
        new_student_code
    );
    
    INSERT INTO public.audit_log (user_id, action, resource_type, new_values)
    VALUES (
        NEW.id,
        'user_signup',
        'user_role',
        jsonb_build_object('role', signup_role, 'email', NEW.email, 'student_code', new_student_code)
    );
    
    RETURN NEW;
END;
$$;

-- Backfill existing users with student codes
UPDATE public.user_profiles 
SET student_code = public.generate_student_code(first_name, last_name)
WHERE student_code IS NULL;