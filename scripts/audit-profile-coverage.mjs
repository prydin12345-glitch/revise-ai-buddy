import {build} from 'esbuild';
const b=await build({entryPoints:['supabase/functions/_shared/preset-approval.ts'],bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const audit=await api.auditApprovals();
const report={registryVersion:1,presets:api.APPROVAL_REGISTRY.map(e=>({...e,settingsCanonical:undefined,starred:['approved','superseded'].includes(e.status),audit:audit.find(a=>a.id===e.id)?.ok})),sourceBacked:[{course:'Pearson Edexcel A Level Biology B',component:'9BI0/01',starred:false,source:'pearson-9bi0-01-issue4'}]};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));else console.table(report.presets.map(e=>({id:e.id,status:e.status,star:e.starred?'★':'',audit:e.audit?'PASS':'FAIL'})));
if(audit.some(a=>!a.ok))process.exitCode=1;
