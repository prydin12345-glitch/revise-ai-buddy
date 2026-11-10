"""Verify this frozen run; classify an optional historical dependency fingerprint separately."""
from pathlib import Path
import argparse
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


REPO = find_root(os.environ['PHYSICS_REPO_ROOT']) if 'PHYSICS_REPO_ROOT' in os.environ else find_root(HERE) or find_root(Path.cwd())
if REPO is None:
    raise SystemExit('Cannot find checkout; set PHYSICS_REPO_ROOT.')
ARTIFACTS = Path(os.environ.get('PHYSICS_ARTIFACT_DIR', str(Path(tempfile.gettempdir()) / 'physics-practice-parity-artifacts'))).resolve()
FONT_DIR = Path(os.environ.get('PHYSICS_FONT_DIR', str(ARTIFACTS / 'fonts'))).resolve()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def changed(source, base):
    return [name for name, expected in source.items()
            if not (base / name).is_file() or sha256(base / name) != expected]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path, help='Optional old combined source-hashes.json or application hash manifest.')
    parser.add_argument('--require-baseline-app-match', action='store_true', help='Also fail if the historical application hashes differ.')
    args = parser.parse_args()
    app = json.loads((ARTIFACTS / 'app-source-hashes.json').read_text())
    server = json.loads((ARTIFACTS / 'server-source-hashes.json').read_text())
    dependencies = json.loads((ARTIFACTS / 'dependency-input-hashes.json').read_text())
    build = json.loads((ARTIFACTS / 'build-manifest.json').read_text())
    app_differences = changed(app, REPO)
    server_differences = changed(server, REPO)
    dependency_differences = changed(dependencies, REPO)
    fixture_differences = changed(build['fixtureInputs'], HERE)
    font_differences = changed(build['externalFontInputs'], FONT_DIR)
    output_differences = [name for name, key in [('bundle.js', 'bundleSha256'), ('styles.css', 'stylesheetSha256'), ('app-source-hashes.json', 'appSourceHashesSha256'), ('server-source-hashes.json', 'serverSourceHashesSha256'), ('dependency-input-hashes.json', 'dependencyInputHashesSha256')]
                          if not (ARTIFACTS / name).is_file() or sha256(ARTIFACTS / name) != build[key]]
    report = {'status': 'PASS', 'applicationFiles': len(app), 'serverFiles': len(server), 'dependencyInputs': len(dependencies),
              'applicationDifferences': app_differences, 'serverDifferences': server_differences, 'dependencyDifferencesWithinRun': dependency_differences,
              'fixtureDifferences': fixture_differences, 'fontDifferences': font_differences, 'outputDifferences': output_differences,
              'runtime': build['runtime'],
              'policy': 'Application/server/config/lockfile drift fails. Server sources are pinned but not executed by this browser composition. Dependency differences from historical runs are classified separately and never prove application parity.'}
    if args.baseline:
        old = json.loads(args.baseline.read_text())
        old_app = {name: value for name, value in old.items() if not name.startswith('node_modules/') and not name.startswith('docs/')}
        old_dependencies = {name: value for name, value in old.items() if name.startswith('node_modules/')}
        added_application_files = sorted(set(app) - set(old_app))
        report['historicalComparison'] = {
            'application': {'comparedFiles': len(old_app), 'differentFiles': changed(old_app, REPO), 'newlyCoveredFiles': added_application_files},
            'installedDependencyInputs': {'comparedFiles': len(old_dependencies), 'differentFiles': changed(old_dependencies, REPO)},
            'applicationMatchesHistoricalManifest': not changed(old_app, REPO) and not added_application_files,
            'interpretation': 'Historical dependency fingerprints vary with installed package/platform inputs. All application changes remain listed; dependency variation is not an application parity pass.'}
    failures = bool(app_differences or server_differences or dependency_differences or fixture_differences or font_differences or output_differences)
    if args.require_baseline_app_match:
        if not args.baseline:
            parser.error('--require-baseline-app-match requires --baseline')
        failures |= not report['historicalComparison']['applicationMatchesHistoricalManifest']
    if failures:
        report['status'] = 'FAIL'
    (ARTIFACTS / 'hash-verification.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
