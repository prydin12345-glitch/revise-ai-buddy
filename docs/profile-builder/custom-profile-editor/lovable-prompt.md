After the custom exam profile editor draft PR is reviewed and merged, paste this into Lovable:

> Use GitHub main containing the merged custom exam profile editor PR. Confirm and report the exact merged commit. Keep the repository version if Lovable offers to restore older work. Do not reset, restore a backup, force-push or merge the PR yourself.
>
> Sync and rebuild the frontend preview from that commit. This change needs no Edge function deployment, database migration or dependency update. Keep existing environment configuration and ownership/authentication checks. Do not publish the website.
>
> Verify the documented offline/controlled fixtures for laptop, iPad and phone sizes in light/dark mode. Existing manually created profiles should open on Topics with their entire saved list, including custom topics absent from the library. Check icon-only Add/Edit/Remove, search/sort/library views, bulk removal/keep-one, Undo, studied content, settings, exact sections/marks/optional questions and saved guided versions. Existing AI profiles must retain their AI editor route.
>
> Compare the full saved/reopened profile, including untouched raw fields and nested metadata. Display-name edits must keep canonical quiz and performance identities. Opening or browsing must not write, regenerate or prune topics. Failed saves must retain edits; retrying a partial create must update the same row. Discard and close confirmation must release modal focus/pointer locks. Pending studied-text input must not leak into another profile.
>
> Use synthetic fixtures only. Do not access student data, modify live profiles, start live/paid AI calls or replay charged requests. Report the commit, preview build status and actual check results. Leave the website unpublished.
