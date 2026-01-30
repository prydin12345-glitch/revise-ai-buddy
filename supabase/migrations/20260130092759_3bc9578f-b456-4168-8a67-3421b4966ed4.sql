-- Allow deferred extraction state for resource packs
ALTER TABLE public.resource_packs
  DROP CONSTRAINT IF EXISTS resource_packs_status_check;

ALTER TABLE public.resource_packs
  ADD CONSTRAINT resource_packs_status_check
  CHECK (
    status IS NULL OR status = ANY (
      ARRAY[
        'draft'::text,
        'pending'::text,
        'processing'::text,
        'ready'::text,
        'failed'::text
      ]
    )
  );
