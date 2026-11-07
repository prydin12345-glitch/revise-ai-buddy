# Post-merge Lovable handoff

For this change, the [actual dependency graph](edge-function-dependencies.json) identifies only **`profile-builder`**. The new follow-up protocol/private checkpoint fields do not change saved-profile or generation evidence schemas. This list assumes the preceding merged evidence-provenance rollout has already been deployed; it does not claim to inspect live deployment revisions.

After this PR is merged, send Lovable:

> Deploy only `profile-builder` from the latest merged main, including the combined-specification scoping and `answer_source` follow-up changes. Keep the Examly website unpublished. Preserve its existing authentication/JWT settings, ownership rules, quotas and call/time budgets. No migration or generated database-type refresh is required. Confirm the deployed source revision, then run the included offline/synthetic tests for combined AS/A-level sources, targeted questions, retained attachments/reading and same-job resume. Do not log in as a student, edit live data, save/delete real profiles, call paid AI or generate a paid exam. Report actual checks and anything still unverified with the real provider.

New source jobs support same-job clarification. Older terminal jobs remain stopped safely; a fresh build is needed for those. Keep/re-attach the PDF if a full browser reload removed its account-session attachment. Do not automatically replay an old paid request.

A separately authorised real-provider check remains necessary to assess extraction and draft quality. Automated tests and successful deployment do not prove scientific accuracy or an external quality rating.
