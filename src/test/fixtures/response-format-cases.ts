import type {ResponseDefinition,PrivateResponseKey} from '@/lib/response-contract';
import type {ResponseResource} from '@/lib/response-marking';
const base={version:1 as const,revision:'example_v1',resourceIds:[] as string[]};
const definitions:ResponseDefinition[]=[
 {...base,kind:'choice',minSelections:2,maxSelections:2,options:[{id:'a',label:'Glycogen'},{id:'b',label:'Sucrose'},{id:'c',label:'DNA'},{id:'d',label:'Glucose'}]},
 {...base,kind:'grid',minPerRow:0,maxPerRow:3,columns:[{id:'glycogen',label:'Glycogen'},{id:'sucrose',label:'Sucrose'},{id:'dna',label:'DNA'}],rows:[{id:'polymer',label:'Is a polymer'},{id:'glucose',label:'Contains glucose subunits'},{id:'nitrogen',label:'Contains nitrogen'}]},
 {...base,kind:'cloze',fields:[{id:'product',label:'Product',input:'text',required:true},{id:'organelle',label:'Organelle',input:'select',required:true,options:[{id:'mitochondria',label:'Mitochondria'},{id:'chloroplasts',label:'Chloroplasts'},{id:'ribosomes',label:'Ribosomes'}]}],segments:[{text:'During photosynthesis, plants make '},{blankId:'product'},{text:'. This process takes place in '},{blankId:'organelle'},{text:'.'}]},
 {...base,kind:'fields',resourceIds:['tubes'],fields:[{id:'x',label:'Tube X: calculate the rate (per second)',input:'number',required:true},{id:'y',label:'Tube Y: explain the difference in reaction rate',input:'text',required:true}]},
];
const keys:PrivateResponseKey[]=[
 {version:1,definitionRevision:base.revision,maxMarks:1,units:[{id:'u1',targetIds:['answer'],marks:1,rule:{kind:'exact_set',expectedIds:['a','c']}}]},
 {version:1,definitionRevision:base.revision,maxMarks:3,units:[['polymer',['glycogen','dna']],['glucose',['glycogen','sucrose']],['nitrogen',['dna']]].map(([id,expectedIds])=>({id:'u_'+id,targetIds:[id as string],marks:1,rule:{kind:'exact_set',expectedIds:expectedIds as string[]}}))},
 {version:1,definitionRevision:base.revision,maxMarks:2,units:[{id:'product',targetIds:['product'],marks:1,rule:{kind:'text',accepted:['glucose'],caseSensitive:false}},{id:'organelle',targetIds:['organelle'],marks:1,rule:{kind:'text',accepted:['chloroplasts'],caseSensitive:true}}]},
 {version:1,definitionRevision:base.revision,maxMarks:3,units:[{id:'x',targetIds:['x'],marks:1,rule:{kind:'number',expected:0.05,tolerance:0}},{id:'y',targetIds:['y'],marks:2,rule:{kind:'rubric',guidance:'PRIVATE SAMPLE: credit the lower rate in the cooler tube and fewer successful collisions.'}}]},
];
const tubes:ResponseResource={id:'tubes',kind:'table',title:'Shared experiment data',columns:['Tube','Temperature (C)','Reaction time (s)'],rows:[['X','35','20'],['Y','15','50']]};
/** Synthetic offline examples, not an exam board paper or an enabled generator. */
export const responseFormatCases=definitions.map((definition,index)=>({
 id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
 question_number:String(index+1),question_type:'written',marks:keys[index].maxMarks,
 question_text:['Identify two polymers.','Tick every applicable cell.','Complete the paragraph.','Use the same results table to answer both parts.'][index],
 response_definition:definition,response_resources:index===3?[tubes]:[],response_key:keys[index],
}));
