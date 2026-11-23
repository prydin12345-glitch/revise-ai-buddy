"""Use the shared strict verifier without touching previous artifact directories."""
from pathlib import Path
import os
import runpy

os.environ.setdefault('PROFILE_BUILDER_BROWSER_ARTIFACT_DIR', '/tmp/profile-builder-ai-profile-editor')
runpy.run_path(str(Path(__file__).resolve().parents[2] / 'assessment-identities/browser/verify-hashes.py'), run_name='__main__')
