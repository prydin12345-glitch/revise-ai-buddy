# Redeploy six exam services

Redeploy these from the current project code:

- extract-exam-questions
- publish-exam
- generate-practice-questions
- get-practice-questions
- grade-practice-question
- submit-exam

Each one deploys with its shared helpers.

## Not changing
- Code, sign-in settings, secrets and quotas stay as they are.
- No database changes and no generated exam.
- The website stays unpublished. Deploying publish-exam only changes how papers are finalised.

## After deploying
- Confirm each service deployed successfully. If any fail, report which one and why.
