# Uploaded syllabus response recovery

The uploaded syllabus reader and draft builder now request a streamed provider response. The gateway can send data while it prepares the reply. The function assembles the bounded response and checks for a provider completion marker before accepting it. It also accepts a complete JSON response from the same request. The reading stage has up to 55 seconds, subject to the remaining 120-second job budget.

Reading and drafting still use the selected assessment, literal source evidence and the existing profile validators. The reading instructions ask for concise quotes and named scope. The local reader retains the detailed source learning points. The existing three-call cap, owner-scoped receipts and quota reservation rules apply across subjects.

Provider failures show the stage and a controlled reason. Check progress reads the existing receipt. Starting a fresh build requires an explicit choice. An interrupted call keeps its uncertain usage record. Provider payloads and error bodies never enter the public diagnostic.

The reported message identifies an unconfirmed provider outcome. It cannot establish the cause of the original live failure. The controlled tests exercise complete and interrupted provider streams, HTTP 429 and 504, the actual save/reopen path and no replay on progress checks. The public Pearson PDF regression verifies 40, 40 and 80 detailed topics for Papers 1, 2 and 3 respectively, with literal excerpts and sibling papers excluded. These checks use synthetic provider replies.

After the PR is reviewed and merged, paste this into Lovable:

> Confirm the GitHub main commit containing the merged syllabus response recovery PR. Deploy the `profile-builder` Edge Function from that commit and sync the frontend preview to the same commit. The import check identified `profile-builder` as the only affected function. This change uses the existing database and job RPCs.
>
> Verify the deployment using the controlled tests and the public Pearson PDF fixture. Check that a provider failure shows one error with Check progress and Start new build. Check progress should read the original receipt. Confirm the live function and preview revisions. Keep the website unpublished and use no live student records or paid AI calls during verification.
