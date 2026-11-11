"""Verify the frozen offline assessment-identity browser composition and source snapshot."""
from pathlib import Path
import hashlib
import json
import os
import tempfile

HERE = Path(__file__).resolve().parent


def find_root(start):
    path = Path(start).resolve()
    for candidate in (path, *path.parents):
        if (candidate / 'package.json').is_file() and (candidate / 'src/index.css').is_file():
            return candidate
    return None


REPO = find_root(os.environ['PROFILE_BUILDER_REPO_ROOT']) if 'PROFILE_BUILDER_REPO_ROOT' in os.environ else find_root(HERE) or find_root(Path.cwd())
if REPO is None:
    raise SystemExit('Cannot find checkout; set PROFILE_BUILDER_REPO_ROOT.')
ARTIFACTS = Path(os.environ.get('PROFILE_BUILDER_BROWSER_ARTIFACT_DIR', str(Path(tempfile.gettempdir()) / 'profile-builder-assessment-identities'))).resolve()
FONT_DIR = Path(os.environ.get('PROFILE_BUILDER_FONT_DIR', str(ARTIFACTS / 'fonts'))).resolve()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def changed(source, base):
    return [name for name, expected in source.items()
            if not (base / name).is_file() or sha256(base / name) != expected]


def main():
    app = json.loads((ARTIFACTS / 'app-source-hashes.json').read_text())
    server = json.loads((ARTIFACTS / 'server-source-hashes.json').read_text())
    dependencies = json.loads((ARTIFACTS / 'dependency-input-hashes.json').read_text())
    build = json.loads((ARTIFACTS / 'build-manifest.json').read_text())
    differences = {
        'applicationDifferences': changed(app, REPO),
        'serverDifferences': changed(server, REPO),
        'dependencyDifferencesWithinRun': changed(dependencies, REPO),
        'fixtureDifferences': changed(build['fixtureInputs'], REPO),
        'fontDifferences': changed(build['externalFontInputs'], FONT_DIR),
        'outputDifferences': [name for name, key in [('bundle.js', 'bundleSha256'), ('styles.css', 'stylesheetSha256'), ('app-source-hashes.json', 'appSourceHashesSha256'), ('server-source-hashes.json', 'serverSourceHashesSha256'), ('dependency-input-hashes.json', 'dependencyInputHashesSha256')]
                              if not (ARTIFACTS / name).is_file() or sha256(ARTIFACTS / name) != build[key]],
    }
    failed = any(differences.values())
    report = {'status': 'FAIL' if failed else 'PASS', 'applicationFiles': len(app), 'serverFiles': len(server),
              'dependencyInputs': len(dependencies), **differences, 'runtime': build['runtime'],
              'policy': 'Every recorded application/server/config/lockfile/fixture/font/dependency input and generated bundle/style output must match the frozen build. Server pinning does not imply that backend endpoints ran in the browser.'}
    (ARTIFACTS / 'hash-verification.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
