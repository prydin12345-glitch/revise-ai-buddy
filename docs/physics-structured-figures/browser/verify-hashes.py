from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
REPO = Path('/workspace/revise-ai-buddy')
source = json.loads((HERE / 'source-hashes.json').read_text())
different = [name for name, expected in source.items()
             if not (REPO / name).is_file()
             or hashlib.sha256((REPO / name).read_bytes()).hexdigest() != expected]
if different:
    raise SystemExit('Source hashes changed: ' + ', '.join(different))
build = json.loads((HERE / 'build-manifest.json').read_text())
for name, key in [('view.tsx', 'fixtureSha256'), ('bundle.js', 'bundleSha256'), ('styles.css', 'stylesheetSha256')]:
    if hashlib.sha256((HERE / name).read_bytes()).hexdigest() != build[key]:
        raise SystemExit('Built fixture hash changed: ' + name)
print(json.dumps({'status': 'PASS', 'sourceFiles': len(source),
                  'bundledInputs': len(build['bundledInputs']),
                  'tailwindScannedInputs': len(build['tailwindScannedInputs'])}))
