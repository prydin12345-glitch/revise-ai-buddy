alter table public.exams
  add column if not exists profile_id uuid references public.subject_exam_profiles(id) on delete set null;
create index if not exists exams_profile_id_idx on public.exams(profile_id);

alter table public.practice_question_sets
  add column if not exists profile_id uuid references public.subject_exam_profiles(id) on delete set null;
create index if not exists practice_question_sets_profile_id_idx on public.practice_question_sets(profile_id);

alter table public.exam_questions
  add column if not exists profile_id uuid references public.subject_exam_profiles(id) on delete set null;
create index if not exists exam_questions_profile_id_idx on public.exam_questions(profile_id);

alter table public.practice_questions
  add column if not exists profile_id uuid references public.subject_exam_profiles(id) on delete set null;
create index if not exists practice_questions_profile_id_idx on public.practice_questions(profile_id);