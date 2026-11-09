// @vitest-environment node
import {describe,it,expect} from "vitest";
import {
  parsePhysicsDiagramConfig,physicsDiagramIssues,physicsFigureIssues,
  readPhysicsFigureContract,savedPhysicsDiagram,needsPhysicsSetupFigure,
  type PhysicsFigureConfig,
} from "../functions/_shared/physics-diagram-contract";
import {validateQuestionCandidates} from "../functions/_shared/question-contract-validator";

const circuit:PhysicsFigureConfig = {type:"circuit",gridSpacing:90,showLabels:true,nodes:[
  {id:"p",col:0,row:0},{id:"q",col:3,row:0},{id:"r",col:3,row:2},{id:"s",col:0,row:2},
],wires:[{from:"p",to:"q",component:"battery",label:"9 V"},{from:"q",to:"r",component:"resistor",label:"3 Ω"},
  {from:"r",to:"s",component:"switch_open"},{from:"s",to:"p",component:"wire"}],junctions:[{at:"q"}]};
const pulley:PhysicsFigureConfig = {type:"pulley",angle:0,surface:"smooth",masses:{hanging:1.5,onSurface:6},showForces:false,showLabels:true,friction:false};
const projectile:PhysicsFigureConfig = {type:"projectile",speed:18,angle:35,launchHeight:0,targetX:47,targetY:23,showComponents:false,showLabels:true,unknowns:["range"]};
const fixtureConfigs:PhysicsFigureConfig[] = [
  {type:"slope",angle:25,mass:6,surface:"rough",showNormal:false,showWeight:false,showFriction:false,showComponents:false,showLabels:true},
  {type:"free_body",angle:0,mass:6,surface:"smooth",unknowns:["normal"],showLabels:true,appliedForce:14},
  {type:"conical_pendulum",stringLength:"l",angle:40,mass:0.3,omega:"ω",showTension:false,showWeight:false,showRadius:true,unknowns:["tension"],showLabels:true},
  {type:"vertical_motion",initialSpeed:"u",mass:"m",direction:"up",unknowns:["speed","maxHeight"],showLabels:true},
  pulley,
  {type:"beam",length:5,pivot:{type:"hinge",position:0},loads:[{position:5,magnitude:30,label:"30 N"}],reactions:[{position:0,label:"R",isUnknown:true}],showLabels:true},
  projectile,
  {type:"rod",mass:6,length:2.5,angle:70,wallType:"smooth",floorType:"rough",showForces:false,showLabels:true},
  {type:"vertical_lift",mass:15,height:2.4,time:"t",unknowns:["time"]},
  {type:"phasor_diagram",phasors:[{magnitude:5,angleDeg:0,label:"V₁ / V"},{magnitude:8,angleDeg:60,label:"V₂ / V"}]},
  {type:"delta_wye_comparison"},
  {type:"connected_particles",massA:1.5,massB:6,angle:25,surface:"smooth"},
  {type:"spring_mass",mass:0.3,extension:0.08,naturalLength:0.35,springConstant:null,orientation:"vertical"},
  {type:"collision",massA:1.5,massB:6,uA:5,uB:0,vA:null,vB:null,collisionType:"elastic"},
  {type:"dual",left:circuit,right:{type:"vertical_lift",mass:15,height:2.4,time:"t"}},circuit,
  {type:"ray_diagram",variant:"diverging_lens",objectPosition:"beyond_2f",showImage:false,showConstruction:false},
  {type:"wave_diagram",variant:"longitudinal",amplitude:0.8,showAmplitudeLabel:false,showWavelengthLabel:true},
  {type:"magnetic_field",variant:"bar_magnet",northOnLeft:false,showArrows:true,showFieldLines:true},
  {type:"nuclear_decay",variant:"beta_minus_decay",parentSymbol:"C",parentMassNumber:14,parentAtomicNumber:6,daughterSymbol:"?"},
  {type:"electromagnetic_spectrum",highlightRegion:"infrared",showUses:false,showWavelength:false},
];
const stored=(config:unknown,intent="setup")=>({...config as object,physics_figure_version:1,diagram_intent:intent});
const questions=(config:unknown,text:string)=>({question_text:text,diagram_config:stored(config)});
const scene="A block of mass 6 kg rests on a smooth horizontal table and is connected over a pulley to a hanging mass of 1.5 kg. Calculate the acceleration.";

describe("saved Physics renderer contract",()=>{
  it("validates all 21 renderer types and round-trips exact saved fields",()=>{
    expect(new Set(fixtureConfigs.map(config=>config.type)).size).toBe(21);
    for(const config of fixtureConfigs) {
      const parsed=parsePhysicsDiagramConfig(JSON.stringify(stored(config)));
      expect(parsed,config.type).toEqual({success:true,config});
      expect(savedPhysicsDiagram(questions(config,"Use this setup."))).toEqual(config);
    }
  });
  it("retains explicit symbols and null unknowns without guessing numbers",()=>{
    const motion=fixtureConfigs.find(config=>config.type==="vertical_motion")!;
    expect(physicsDiagramIssues(motion,"A particle is projected vertically upwards with unknown initial speed u.",{requireGivenLabels:true})).toEqual([]);
    expect(parsePhysicsDiagramConfig({...motion,initialSpeed:undefined}).success).toBe(false);
    expect(physicsDiagramIssues({...motion,initialSpeed:12},"Find the initial speed.")[0].detail).toMatch(/symbol/);
  });
  it("rejects nonfinite numbers, unknown enums, excessive arrays and unsafe labels",()=>{
    for(const changed of [
      {...pulley,masses:{hanging:Infinity,onSurface:6}}, {...pulley,surface:"frictionless"},
      {...circuit,nodes:Array(65).fill({id:"x",col:0,row:0})},
      {...circuit,wires:[{from:"p",to:"q",component:"resistor",label:"<script>alert(1)</script>"},...circuit.wires]},
      {...projectile,speed:"https://example.test/answer"}, {...projectile,private_answer:27.2},
    ]) expect(parsePhysicsDiagramConfig(changed).success).toBe(false);
  });
  it("rejects alias conflicts and bounds configuration size",()=>{
    expect(savedPhysicsDiagram({diagram_config:stored(pulley),diagramConfig:stored({...pulley,angle:20})})).toBeNull();
    expect(parsePhysicsDiagramConfig(" ".repeat(24_001)).success).toBe(false);
    expect(parsePhysicsDiagramConfig({...circuit,gridSpacing:0}).success).toBe(false);
  });
  it("validates circuit topology without forbidding an open switch",()=>{
    expect(physicsDiagramIssues(circuit)).toEqual([]);
    expect(physicsDiagramIssues({...circuit,wires:[...circuit.wires,{from:"p",to:"absent",component:"wire"}]}).map(issue=>issue.detail).join()).toMatch(/distinct saved nodes/);
    expect(physicsDiagramIssues({...circuit,junctions:[{at:"absent"}]}).map(issue=>issue.detail).join()).toMatch(/junction/);
    expect(physicsDiagramIssues({...circuit,nodes:[...circuit.nodes,{id:"p",col:9,row:9}]}).map(issue=>issue.detail).join()).toMatch(/unique/);
  });
});

describe("dimension-aware figure consistency",()=>{
  it("matches known masses by units while excluding schematic coordinates",()=>{
    expect(physicsFigureIssues(questions(pulley,scene))).toEqual([]);
    const text="A projectile is launched at 18 m/s at an angle of 35° to the horizontal. Find its range.";
    expect(physicsFigureIssues(questions(projectile,text))).toEqual([]);
    expect(physicsFigureIssues(questions({...projectile,targetX:98765,targetY:-87654},text))).toEqual([]);
    expect(physicsFigureIssues(questions({...pulley,masses:{hanging:1500,onSurface:6}},scene)).length).toBeGreaterThan(0);
    expect(physicsFigureIssues(questions(pulley,scene.replace("1.5 kg","1500 g")))).toEqual([]);
  });
  it("rejects unrelated unit matches and swapped object roles",()=>{
    expect(physicsFigureIssues(questions(pulley,"The setup has a mass of 6 kg and is observed for 1.5 s.")).map(issue=>issue.detail).join()).toMatch(/masses.hanging/);
    expect(physicsFigureIssues(questions({...pulley,masses:{hanging:6,onSurface:1.5}},scene)).map(issue=>issue.detail).join()).toMatch(/role/);
    expect(physicsFigureIssues(questions(projectile,"A particle moves at 18 km/s at an angle of 35°.")).map(issue=>issue.detail).join()).toMatch(/speed/);
  });
  it("rejects completed answer labels and hidden numerical unknowns",()=>{
    const text="A ball is projected at 18 m/s at 35°. Determine its range.";
    expect(physicsFigureIssues(questions({...projectile,landingX:31.1},text)).map(issue=>issue.detail).join()).toMatch(/unknown projectile/);
    const collision=fixtureConfigs.find(config=>config.type==="collision")!;
    expect(physicsDiagramIssues({...collision,vA:2},"Determine the final velocities.")[0].detail).toMatch(/post-collision/);
    const ray=fixtureConfigs.find(config=>config.type==="ray_diagram")!;
    expect(physicsDiagramIssues({...ray,showImage:true},"Locate the image formed by the lens.")[0].detail).toMatch(/hide/);
  });
  it("rejects numeric declared unknowns across scalar fields even when their labels are hidden",()=>{
    const pendulum=fixtureConfigs.find(config=>config.type==="conical_pendulum")!;
    for(const omega of [9.9,"9.9 rad s^-1"])for(const unknown of ["omega","ω","angular velocity"])
      expect(physicsDiagramIssues({...pendulum,omega,unknowns:[unknown]}).map(issue=>issue.detail).join()).toMatch(/declared unknown Physics omega/);
    const body=fixtureConfigs.find(config=>config.type==="free_body")!;
    for(const appliedForce of [100,"100 N"])for(const unknown of ["appliedForce","F"])
      expect(physicsDiagramIssues({...body,appliedForce,unknowns:[unknown]}).map(issue=>issue.detail).join()).toMatch(/declared unknown Physics appliedForce/);
    expect(physicsDiagramIssues({...pendulum,mass:0.3,unknowns:["mass"]}).map(issue=>issue.detail).join()).toMatch(/declared unknown Physics mass/);
  });
  it("accepts symbolic declared unknowns and preserves independent schematic coordinates",()=>{
    const pendulum=fixtureConfigs.find(config=>config.type==="conical_pendulum")!;
    expect(physicsDiagramIssues({...pendulum,omega:"ω",mass:"m",unknowns:["angular velocity","mass"]})).toEqual([]);
    const body=fixtureConfigs.find(config=>config.type==="free_body")!;
    expect(physicsDiagramIssues({...body,appliedForce:"F",unknowns:["F"]})).toEqual([]);
    expect(physicsDiagramIssues({...body,unknowns:["constructor"]})).toEqual([]);
    expect(physicsDiagramIssues({...projectile,targetX:98765,targetY:-87654,unknowns:["range","maxHeight"]})).toEqual([]);
  });
  it("validates isotope data and never exposes inferred daughter answers",()=>{
    const decay=fixtureConfigs.find(config=>config.type==="nuclear_decay")!;
    const text="The nuclide C-14 has atomic number 6 and undergoes beta-minus decay. Determine the daughter nuclide.";
    expect(physicsFigureIssues(questions(decay,text))).toEqual([]);
    expect(physicsFigureIssues(questions({...decay,parentMassNumber:12},text)).map(issue=>issue.detail).join()).toMatch(/mass number/);
    expect(physicsFigureIssues(questions({...decay,daughterMassNumber:14,daughterAtomicNumber:7,daughterSymbol:"N"},text)).map(issue=>issue.detail).join()).toMatch(/Unknown nuclear/);
    expect(physicsDiagramIssues({...decay,daughterMassNumber:13,daughterAtomicNumber:8}).map(issue=>issue.detail).join()).toMatch(/conserve/);
  });
  it("fails closed when a saved variant cannot depict the actual setup",()=>{
    for(const config of [
      {...pulley,angle:30}, {...fixtureConfigs.find(config=>config.type==="ray_diagram"),variant:"converging_mirror"},
      {type:"wave_diagram",variant:"doppler"}, {type:"magnetic_field",variant:"earth_field"},
      {type:"nuclear_decay",variant:"fission",parentSymbol:"U",parentMassNumber:235,parentAtomicNumber:92},
    ]) expect(physicsDiagramIssues(config).length).toBeGreaterThan(0);
  });
});

describe("required figure generation marker",()=>{
  const none={type:"physics_no_figure",physics_figure_version:1,diagram_intent:"none"};
  it("enforces the marker from trusted generation context",()=>{
    expect(physicsFigureIssues({question_text:scene},{requireContract:true})[0].detail).toMatch(/require a saved diagram_config/);
    expect(physicsFigureIssues({question_text:scene,diagram_config:none},{requireContract:true})[0].detail).toMatch(/apparatus/);
    expect(readPhysicsFigureContract(questions(pulley,scene))).toEqual({version:1,intent:"setup",config:stored(pulley)});
  });
  it.each([
    "Define momentum.","A heater transfers 500 J in 20 s. Calculate its power.",
    "Use the velocity-time graph to determine distance travelled.","Draw a free-body diagram of a block on a rough surface.",
  ])("does not force a completed setup for %s",text=>{
    expect(needsPhysicsSetupFigure(text)).toBe(false);
    expect(physicsFigureIssues({question_text:text,diagram_config:none},{requireContract:true})).toEqual([]);
  });
  it("requires a real drawing task for student_draws and rejects extra sentinel data",()=>{
    expect(physicsFigureIssues({question_text:scene,diagram_config:{...none,diagram_intent:"student_draws"}})[0].detail).toMatch(/actual task/);
    expect(physicsFigureIssues({question_text:"Define force.",diagram_config:{...none,mass:3}})[0].detail).toMatch(/sentinel/);
    expect(physicsFigureIssues({question_text:"Draw a ray diagram for a diverging lens.",diagram_config:{...none,diagram_intent:"student_draws"}})).toEqual([]);
  });
  it("does not rewrite historical questions or invent a missing saved figure",()=>{
    expect(physicsFigureIssues({question_text:scene})).toEqual([]);
    expect(savedPhysicsDiagram({question_text:scene})).toBeNull();
    expect(savedPhysicsDiagram({question_text:scene,diagram_config:none})).toBeNull();
  });
});

describe("private evidence stays outside versioned public resources",()=>{
  const graph=()=>stored({type:"line_chart",xAxisLabel:"Time / s",yAxisLabel:"Potential difference / V",
    datasets:[{label:"Voltage",data:[{x:0,y:12},{x:2,y:7.3}]}]},"graph");
  const part=(resource:unknown)=>({question_number:"1",question_type:"short_answer",marks:2,
    question_text:"Describe the trend in potential difference shown by the graph.",
    correct_answer:"The potential difference decreases with time.",diagram_config:resource});
  it.each(["calculation_checks","worked_solution","mark_scheme","correct_answer","expected_answer","solution","solutions","private_key","answer_key","answers_key","correct_chart_data","plottingAnswer","expectedPath"])(
    "blocks recursive %s in a public graph before release",key=>{
      const resource={...graph(),datasets:[{label:"Voltage",data:[{x:0,y:12},{x:2,y:7.3}],metadata:{[key]:"private evidence"}}]};
      const result=validateQuestionCandidates([part(resource)],{physicsGeneration:true,scope:{subject:"Physics"}});
      expect(result.ok).toBe(false);expect(result.defects.some(issue=>issue.detail.includes(`Private Physics field ${key}`))).toBe(true);
    },
  );
  it("checks string aliases, auxiliary tables and legacy chart-options carried beside the main resource",()=>{
    const table={type:"data_table",headers:["Time / s","Voltage / V"],rows:[[0,12],[2,7.3]],metadata:{calculationChecks:[]}};
    for(const field of ["chart_data","table_data","options"] as const) {
      const question={...part(graph()),[field]:JSON.stringify(table)};
      expect(physicsFigureIssues(question).map(issue=>issue.detail).join()).toContain("Private Physics field calculationChecks");
    }
    expect(physicsFigureIssues(part(JSON.stringify({...graph(),worked_solution:"private"})))[0].detail).toContain("Private Physics field worked_solution");
    expect(physicsFigureIssues({...part(graph()),options:{graphType:"plotting",graphConfig:{},plottingAnswer:{expectedPath:[{x:1,y:2}]}}})[0].detail).toContain("Private Physics field plottingAnswer");
  });
  it("keeps ordinary graph/table data and private answer envelopes valid",()=>{
    const question={...part(graph()),chart_data:{type:"data_table",headers:["Time / s","Voltage / V"],rows:[[0,12],[2,7.3]]},
      correct_answer:JSON.stringify({answer:"The potential difference decreases with time.",calculation_checks:[]})};
    expect(physicsFigureIssues(question)).toEqual([]);
  });
  it("bounds deeply nested, cyclic and excessive public resource structures",()=>{
    let deep:unknown="data";for(let i=0;i<20;i++)deep={nested:deep};
    const cyclic:any={};cyclic.self=cyclic;
    for(const metadata of [deep,cyclic,Array(16_001).fill(0)])
      expect(physicsFigureIssues(part({...graph(),metadata}))[0].detail).toMatch(/bounded validation|acyclic JSON/);
  });
  it("preserves unversioned legacy graph conventions",()=>{
    const {physics_figure_version:_version,diagram_intent:_intent,...resource}=graph();
    expect(physicsFigureIssues(part({...resource,correct_chart_data:{expectedPath:[{x:0,y:12},{x:2,y:7.3}]}}))).toEqual([]);
  });
});
