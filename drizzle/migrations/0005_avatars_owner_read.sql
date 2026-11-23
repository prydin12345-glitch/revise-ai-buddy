DROP POLICY IF EXISTS "Avatars: authenticated read" ON storage.objects;
CREATE POLICY "Avatars: owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (select auth.uid())::text = (storage.foldername(name))[1]);