## Why it failed

The console error is:

> Could not find the 'studied_texts' column of 'subject_exam_profiles' in the schema cache

`useSubjectProfiles.createProfile` inserts both `studied_texts` and `paper_blueprint` into `subject_exam_profiles`. A DB check confirms `paper_blueprint` exists but **`studied_texts` was never added** — no migration ever created it. Any profile save that touches the new Paper Structure / studied-texts UI is rejected by PostgREST before it reaches the row.

## Fix

Add a new migration `supabase/migrations/20260710190000_add_studied_texts.sql`:

```sql
ALTER TABLE public.subject_exam_profiles
  ADD COLUMN IF NOT EXISTS studied_texts jsonb;
```

No grants/policies needed — the table already has them, and this is just a nullable column.

After the migration runs, PostgREST will refresh its schema cache automatically and profile creation with the new Paper Structure feature will succeed.

## Notes

- No frontend changes required — `useSubjectProfiles.ts` already sends `studied_texts: ... ?? null`.
- `src/integrations/supabase/types.ts` will regenerate after the migration.
- No edge function redeploy needed for this fix.
