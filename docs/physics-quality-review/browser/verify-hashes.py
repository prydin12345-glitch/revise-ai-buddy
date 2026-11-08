from pathlib import Path
import hashlib,json
root=Path('/workspace/revise-ai-buddy');folder=Path(__file__).parent
hashes=json.loads((folder/'source-hashes.json').read_text())
changed=[name for name,value in hashes.items() if hashlib.sha256((root/name).read_bytes()).hexdigest()!=value]
assert not changed, 'Browser source hashes differ from current checkout: '+', '.join(changed)
report=json.loads((folder/'browser-results.json').read_text())
assert report['sourceHashes']==hashes, 'The run used another bundle.'
assert report['status']=='PASS'
report['sourceHashesVerifiedAgainstFinalTree']=True
(folder/'browser-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'sourceStyleHashes':len(hashes),'mismatches':changed,'cases':len(report['cases']),'scenarios':report['scenarioChecks']}))
