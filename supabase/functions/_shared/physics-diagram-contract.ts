import { z } from "zod";
import type { MechanicsConfig } from "../../../src/components/mechanics/types.ts";
import type { PhysicsDiagramConfig } from "../../../src/components/physics/types.ts";
import type { CircuitConfig, CircuitComponentType } from "../../../src/components/circuit/types.ts";
import type { ResourceIssue, ResourceQuestion } from "./question-resources.ts";
import { ALL_CIRCUIT_COMPONENTS } from "./circuit-validation.ts";
import { extractPhysicsQuantities, parsePhysicsQuantity, physicsQuantitiesEquivalent, samePhysicsDimension, type PhysicsQuantity } from "./physics-quantities.ts";

/** Stored in diagram_config, including an explicit sentinel when no figure is appropriate. */
export const PHYSICS_FIGURE_CONTRACT_VERSION = 1 as const;
export const PHYSICS_NO_FIGURE = "physics_no_figure" as const;
export type PhysicsFigureIntent = "setup" | "none" | "student_draws" | "graph";
export type PhysicsFigureConfig = MechanicsConfig | PhysicsDiagramConfig | CircuitConfig;

const finite = z.number().finite().min(-1e9).max(1e9);
const positive = finite.gt(0);
const nonnegative = finite.min(0);
const nullableFinite = z.custom<number|null>(value=>value===null||finite.safeParse(value).success,"Expected a finite number or null for an unknown");
const angle = finite.min(-180).max(180);
const slopeAngle = finite.min(0).max(89);
const label = z.string().trim().min(1).max(100).refine(
  value => !/[<>\u0000-\u001f\u007f]/.test(value) && !/(?:javascript:|data:|https?:\/\/)/i.test(value),
  "Use a short plain-text scientific label, without markup, control characters or URLs.",
);
// z.custom retains required scalar keys with the app's strictNullChecks:false
// compiler setting (ZodUnion otherwise marks these object keys optional).
const scalar = z.custom<number|string>(value => finite.safeParse(value).success || label.safeParse(value).success,
  "Expected a finite number or safe scientific symbol/label");
const unknowns = z.array(label).max(16);
const surface = z.enum(["rough", "smooth"]);
const bool = z.boolean();
const position = nonnegative;
const pointLabel = z.object({position, label}).strict();

const circuitSchema = z.object({
  type: z.literal("circuit"), gridSpacing: finite.min(60).max(200),
  nodes: z.array(z.object({id: label, col: finite.min(-20).max(20), row: finite.min(-20).max(20)}).strict()).min(2).max(64),
  wires: z.array(z.object({
    from: label, to: label, component: z.custom<CircuitComponentType>(value => typeof value === "string" && ALL_CIRCUIT_COMPONENTS.includes(value), "Unsupported circuit component"),
    label: label.optional(),
  }).strict()).min(3).max(96),
  junctions: z.array(z.object({at: label}).strict()).max(64).optional(),
  showLabels: bool, showCurrentArrows: bool.optional(), highlightLabel: label.optional(),
}).strict();
const liftSchema = z.object({
  type: z.literal("vertical_lift"), mass: scalar, height: scalar,
  time: scalar.optional(), unknowns: unknowns.optional(),
}).strict();

/** Narrow runtime shapes deliberately share the renderer interfaces; no detector values are used. */
export const physicsDiagramConfigSchema = z.discriminatedUnion("type", [
  z.object({type:z.literal("slope"), angle:slopeAngle, mass:scalar, surface,
    showNormal:bool,showWeight:bool,showFriction:bool,showComponents:bool,showLabels:bool}).strict(),
  z.object({type:z.literal("free_body"),angle, mass:scalar,appliedForce:scalar.optional(),
    appliedForceDir:z.enum(["horizontal","up-slope"]).optional(),slopeAngle:slopeAngle.optional(),surface,unknowns,showLabels:bool}).strict(),
  z.object({type:z.literal("conical_pendulum"),stringLength:scalar,angle:slopeAngle,mass:scalar,omega:scalar,
    showTension:bool,showWeight:bool,showRadius:bool,unknowns,showLabels:bool}).strict(),
  z.object({type:z.literal("vertical_motion"),initialSpeed:scalar,direction:z.enum(["up","down"]),mass:scalar,unknowns,showLabels:bool}).strict(),
  z.object({type:z.literal("pulley"),surface,angle:slopeAngle,
    masses:z.object({hanging:positive,onSurface:positive}).strict(),showLabels:bool,showForces:bool,friction:bool}).strict(),
  z.object({type:z.literal("beam"),length:positive,
    pivot:z.object({type:z.enum(["support","wall","hinge"]),position}).strict(),
    loads:z.array(z.object({position,magnitude:scalar,label}).strict()).max(24),
    reactions:z.array(z.object({position,label,isUnknown:bool.optional()}).strict()).min(1).max(12),showLabels:bool,
    endLabels:z.object({left:label.optional(),right:label.optional()}).strict().optional(),
    pointLabels:z.array(pointLabel).max(24).optional(),distributedMass:pointLabel.optional()}).strict(),
  z.object({type:z.literal("projectile"),speed:scalar,angle:scalar,launchHeight:nonnegative,targetX:finite,targetY:finite,
    showComponents:bool,showLabels:bool,landingX:scalar.optional(),timeToMax:scalar.optional(),unknowns:unknowns.optional(),speedLabel:label.optional(),angleLabel:label.optional()}).strict(),
  z.object({type:z.literal("rod"),angle:slopeAngle,mass:scalar,length:scalar,wallType:surface,floorType:surface,showForces:bool,showLabels:bool}).strict(),
  liftSchema,
  z.object({type:z.literal("phasor_diagram"),title:label.optional(),phasors:z.array(z.object({magnitude:nonnegative,angleDeg:angle,label,colour:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()}).strict()).min(1).max(12)}).strict(),
  z.object({type:z.literal("delta_wye_comparison")}).strict(),
  z.object({type:z.literal("connected_particles"),massA:positive,massB:positive,angle:slopeAngle,surface}).strict(),
  z.object({type:z.literal("spring_mass"),mass:positive,extension:nonnegative,naturalLength:positive.optional(),springConstant:positive.nullable().optional(),orientation:z.enum(["vertical","horizontal"]).optional()}).strict(),
  z.object({type:z.literal("collision"),massA:positive,massB:positive,uA:finite,uB:finite,vA:nullableFinite,vB:nullableFinite,collisionType:z.enum(["elastic","perfectly inelastic","explosion","collision"])}).strict(),
  z.object({type:z.literal("dual"),left:circuitSchema,right:liftSchema}).strict(),
  circuitSchema,
  z.object({type:z.literal("ray_diagram"),variant:z.enum(["converging_lens","diverging_lens","converging_mirror","diverging_mirror","flat_mirror","refraction_block","prism_dispersion","optical_fibre","eye_long_sight","eye_short_sight"]),
    objectPosition:z.enum(["inside_f","at_f","between_f_2f","at_2f","beyond_2f"]).optional(),focalLength:positive.optional(),objectHeight:positive.optional(),
    showConstruction:bool.optional(),showImage:bool.optional(),showNormals:bool.optional(),showAngles:bool.optional(),mediumLabel:label.optional(),refractiveIndex:finite.min(1).max(10).optional(),title:label.optional(),
    labels:z.object({principal:label.optional(),focalPoint:label.optional(),centre:label.optional()}).strict().optional()}).strict(),
  z.object({type:z.literal("wave_diagram"),variant:z.enum(["transverse","longitudinal","superposition","standing_wave","interference","doppler","diffraction"]),
    amplitude:positive.max(1.5).optional(),wavelength:positive.optional(),frequency:positive.optional(),period:positive.optional(),amplitude2:positive.max(1.5).optional(),wavelength2:positive.optional(),phaseShift:finite.min(-2*Math.PI).max(2*Math.PI).optional(),harmonicNumber:z.number().int().min(1).max(12).optional(),gapWidth:positive.optional(),
    showAmplitudeLabel:bool.optional(),showWavelengthLabel:bool.optional(),showPeriodLabel:bool.optional(),showNodeLabels:bool.optional(),title:label.optional(),waveType:z.enum(["water","sound","light","em","string"]).optional()}).strict(),
  z.object({type:z.literal("magnetic_field"),variant:z.enum(["bar_magnet","two_bar_magnets_attract","two_bar_magnets_repel","current_straight_wire","current_solenoid","current_loop","motor_effect","electromagnet","earth_field"]),
    northOnLeft:bool.optional(),currentDirection:z.enum(["into_page","out_of_page","left","right","up","down"]).optional(),forceDirection:z.enum(["up","down","left","right","into_page","out_of_page"]).optional(),numberOfCoils:z.number().int().min(1).max(30).optional(),fieldDirection:z.enum(["left_to_right","right_to_left","top_to_bottom","bottom_to_top"]).optional(),
    showFieldLines:bool.optional(),showArrows:bool.optional(),showCurrentSymbols:bool.optional(),showForceArrow:bool.optional(),labelN:bool.optional(),labelS:bool.optional(),title:label.optional()}).strict(),
  z.object({type:z.literal("nuclear_decay"),variant:z.enum(["alpha_decay","beta_minus_decay","beta_plus_decay","gamma_decay","decay_chain","half_life_graph","nuclear_equation","fission","fusion"]),
    parentSymbol:label.optional(),parentMassNumber:z.number().int().min(1).max(350).optional(),parentAtomicNumber:z.number().int().min(0).max(118).optional(),daughterSymbol:label.optional(),daughterMassNumber:z.number().int().min(1).max(350).optional(),daughterAtomicNumber:z.number().int().min(0).max(118).optional(),decayParticle:z.enum(["alpha","beta_minus","beta_plus","gamma","neutron"]).optional(),
    chain:z.array(z.object({symbol:label,massNumber:z.number().int().min(1).max(350),atomicNumber:z.number().int().min(0).max(118),decayType:z.enum(["alpha","beta_minus","beta_plus","gamma"])}).strict()).min(2).max(12).optional(),
    showPenetration:bool.optional(),showIonisation:bool.optional(),showDeflection:bool.optional(),title:label.optional()}).strict(),
  z.object({type:z.literal("electromagnetic_spectrum"),highlightRegion:z.enum(["radio","microwave","infrared","visible","ultraviolet","xray","gamma"]).optional(),showWavelength:bool.optional(),showFrequency:bool.optional(),showUses:bool.optional(),showProperties:bool.optional(),title:label.optional()}).strict(),
]);

// A renderer change that makes this assignment fail needs a matching runtime contract change.
const rendererCompatible = (value:z.output<typeof physicsDiagramConfigSchema>):PhysicsFigureConfig => value;
void rendererCompatible;
const diagramTypes = new Set(physicsDiagramConfigSchema.options.map(schema => schema.shape.type.value));
export const isPhysicsDiagramType = (type:unknown):boolean => typeof type === "string" && diagramTypes.has(type as PhysicsFigureConfig["type"]);
const object = (value:unknown):Record<string,any>|null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string,any> : null;
const rawObject = (value:unknown):Record<string,any>|null => {
  if (typeof value === "string") { if (value.length > 24_000) return null; try {return object(JSON.parse(value));} catch {return null;} }
  return object(value);
};
const stable = (value:unknown):string => JSON.stringify(value,(_key,item) => object(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))) : item);
const configFrom = (value:unknown):Record<string,any>|null => {
  const record = rawObject(value);
  return record && ("diagram_config" in record || "diagramConfig" in record) ? rawObject(record.diagram_config ?? record.diagramConfig) : record;
};

export function readPhysicsFigureContract(value:unknown):{version:1;intent:PhysicsFigureIntent;config:Record<string,any>}|null {
  const config = configFrom(value);
  return config?.physics_figure_version === 1 && ["setup","none","student_draws","graph"].includes(config.diagram_intent)
    ? {version:1,intent:config.diagram_intent,config} : null;
}

export function parsePhysicsDiagramConfig(input:unknown):
  {success:true;config:PhysicsFigureConfig} | {success:false;issues:string[]} {
  const record = rawObject(input);
  if (!record) return {success:false,issues:["A Physics figure must be a JSON object (at most 24 KB)."]};
  try {if (JSON.stringify(record).length > 24_000) return {success:false,issues:["Physics figure exceeds the 24 KB configuration limit."]};}
  catch {return {success:false,issues:["Physics figure must be serializable JSON."]};}
  const {physics_figure_version:_version,diagram_intent:_intent,...config} = record;
  const parsed = physicsDiagramConfigSchema.safeParse(config);
  return parsed.success ? {success:true,config:parsed.data} : {success:false,issues:parsed.error.issues.slice(0,12).map(issue=>`${issue.path.join(".") || "figure"}: ${issue.message}`)};
}

/** Exact saved configuration only. Caller may use a detector for unmarked historical questions. */
export function savedPhysicsDiagram(question:ResourceQuestion):PhysicsFigureConfig|null {
  const candidates = [question.diagram_config,question.diagramConfig].map(rawObject).filter((value):value is Record<string,any>=>!!value && isPhysicsDiagramType(value.type));
  if (!candidates.length || (candidates.length > 1 && stable(candidates[0]) !== stable(candidates[1]))) return null;
  const contract = readPhysicsFigureContract(candidates[0]);
  if (contract && contract.intent !== "setup") return null;
  const parsed = parsePhysicsDiagramConfig(candidates[0]);
  return parsed.success ? parsed.config : null;
}

const plain = (value:unknown):string => String(value ?? "").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();
const invalid = (detail:string):ResourceIssue => ({code:"invalid_resource",detail});
const mismatch = (detail:string):ResourceIssue => ({code:"conflicting_resource_data",detail});

const privateResourceKeys = new Set([
  "calculationchecks", "correctanswer", "expectedanswer", "modelanswer", "finalanswer", "answer",
  "workedsolution", "working", "markscheme", "markingscheme", "rubric", "solution", "solutions",
  "privatekey", "answerkey", "answerskey", "correctchartdata", "plottinganswer", "expectedpath", "expecteddata", "expectedpoints",
]);
/** A public graph/table must not become a second private marking-key store.
 * Apply only to versioned generation so historical resource conventions remain
 * readable. Bound recursion and visits even for non-JSON caller fixtures. */
function privatePhysicsResourceIssues(question:ResourceQuestion):ResourceIssue[] {
  const roots = [question.diagram_config,question.diagramConfig,question.chart_data,question.table_data];
  const optionChart = rawObject(question.options);
  if (optionChart && ["type","graphType","graphConfig","plottingAnswer","interpretationFields","expectedPath"].some(key=>key in optionChart)) roots.push(optionChart);
  let visits = 0;
  const ancestors = new Set<object>();
  const inspect = (value:unknown,depth:number):string|null => {
    if (++visits>16_000 || depth>16) return "Public Physics resources exceed the bounded validation limits.";
    if (!value || typeof value!=="object") return null;
    if (ancestors.has(value)) return "Public Physics resources must be acyclic JSON.";
    ancestors.add(value);
    const entries = Object.entries(value);
    if (entries.length>16_000) return "Public Physics resources exceed the bounded validation limits.";
    for (const [key,item] of entries) {
      if (privateResourceKeys.has(key.toLowerCase().replace(/[^a-z0-9]/g,"")))
        return `Private Physics field ${key.slice(0,80)} cannot be saved in a public resource. Keep calculation evidence, solutions and expected answers in the private answer key.`;
      const issue=inspect(item,depth+1); if (issue) return issue;
    }
    ancestors.delete(value);
    return null;
  };
  for (const root of roots) {
    let decoded=root;
    if (typeof decoded==="string" && /^\s*[\[{]/.test(decoded)) {
      if(decoded.length>1_000_000)return [invalid("Public Physics resources exceed the bounded validation limits.")];
      try {decoded=JSON.parse(decoded);} catch {continue;}
    }
    const issue=inspect(decoded,0);if(issue)return [invalid(issue)];
  }
  return [];
}

/** Detect missing apparatus only; this never supplies a type, parameter or picture. */
export function needsPhysicsSetupFigure(questionText:string):boolean {
  const text = plain(questionText);
  if (!text || /\b(?:define|state the meaning|what is meant|recall|list)\b/i.test(text.slice(0,80))) return false;
  const figureReference = /\b(?:figure|diagram|apparatus|setup)(?:\s+(?:\d+[a-z]?|[A-Z]))?\s+(?:shows?|illustrates?|depicts?|represents?|below|above|given|provided)\b|\b(?:use|using|refer to|from|in|on)\s+(?:the\s+)?(?:figure|diagram)(?:\s+(?:\d+[a-z]?|[A-Z]))?\b/i.test(text);
  if (figureReference) return true;
  if (/\b(?:draw|sketch|complete|construct)\b[^.!?]{0,90}\b(?:diagram|ray|field lines?|free.body|apparatus|circuit|wavefront|graph)\b/i.test(text) && !/\b(?:diagram|figure|apparatus)\s+(?:shown|below|above|given)\b/i.test(text)) return false;
  if (/\b(?:graph|plot|curve)\b/i.test(text) && !/\b(?:diagram|apparatus|setup|figure)\s+(?:shown|below|above|given)\b/i.test(text)) return false;
  return /\b(?:diagram|apparatus|setup|figure)\s+(?:shown|below|above|given)\b|\b(?:shown|illustrated)\s+in\s+(?:the\s+)?(?:diagram|figure)\b/i.test(text) ||
    /\b(?:pulley|connected particles|conical pendulum|beam|rod|ladder)\b[^.!?]{0,120}\b(?:hang|support|hinge|pivot|lean|wall|mass|light string)\b/i.test(text) ||
    /\b(?:block|particle|mass)\b[^.!?]{0,100}\b(?:inclined plane|rough slope|smooth slope|connected by|attached to a spring)\b/i.test(text) ||
    /\b(?:projectile|ball|particle)\b[^.!?]{0,100}\b(?:projected|launched)\b[^.!?]{0,70}\b(?:angle|horizontal|height)\b/i.test(text) ||
    /\b(?:object|ray)\b[^.!?]{0,100}\b(?:in front of|incident on|enters|passes through)\b[^.!?]{0,60}\b(?:lens|mirror|glass block|prism)\b/i.test(text) ||
    /\b(?:resistors?|lamps?|capacitors?|components?)\b[^.!?]{0,90}\b(?:connected|arranged)\s+(?:in\s+)?(?:series|parallel)\b/i.test(text);
}

interface VisibleQuantity {field:string; value:number|string; unit:string}
/** Units describe labels, not SVG coordinates, schematic sizes or hidden solution quantities. */
function visibleQuantities(config:PhysicsFigureConfig):VisibleQuantity[] {
  const quantities:VisibleQuantity[] = [];
  const add = (field:string,value:number|string|undefined|null,unit:string,shown=true) => {
    if (shown && value !== undefined && value !== null) quantities.push({field,value,unit});
  };
  switch(config.type) {
    case "slope": add("mass",config.mass,"kg",config.showLabels);add("angle",config.angle,"deg",config.showLabels);break;
    case "pulley": add("masses.hanging",config.masses.hanging,"kg",config.showLabels);add("masses.onSurface",config.masses.onSurface,"kg",config.showLabels);break;
    case "free_body": add("mass",config.mass,"kg",config.showLabels);add("appliedForce",config.appliedForce,"N",config.showLabels && !config.unknowns.includes("appliedForce"));break;
    case "conical_pendulum": add("mass",config.mass,"kg",config.showLabels&&config.showWeight);add("angle",config.angle,"deg",config.showLabels&&!config.unknowns.includes("angle"));break;
    case "vertical_motion": add("initialSpeed",config.initialSpeed,"m/s",config.showLabels&&!config.unknowns.some(value=>["speed","velocity","initialSpeed","u","U"].includes(value)));break;
    case "vertical_lift": add("mass",config.mass,"kg");add("height",config.height,"m");add("time",config.time,"s");break;
    case "projectile":
      add("speed",config.speed,"m/s",config.showLabels);add("angle",config.angle,"deg",config.showLabels);
      add("landingX",config.landingX,"m",!config.unknowns?.some(value=>["range","landingX"].includes(value)));
      add("timeToMax",config.timeToMax,"s",!config.unknowns?.some(value=>["time","timeToMax"].includes(value)));break;
    case "rod":add("mass",config.mass,"kg",config.showForces&&config.showLabels);add("length",config.length,"m",config.showLabels);add("angle",config.angle,"deg",config.showLabels);break;
    case "beam": {
      const points = [...(config.endLabels?.left?[0]:[]),...(config.pointLabels?.map(point=>point.position)??[]),...(config.endLabels?.right?[config.length]:[])].sort((a,b)=>a-b);
      for (let i=1;i<points.length;i++) if(points[i]>points[i-1]) add(`span[${i-1}]`,points[i]-points[i-1],"m");
      break;
    }
    case "connected_particles":add("massA",config.massA,"kg");add("massB",config.massB,"kg");add("angle",config.angle,"deg");break;
    case "spring_mass":add("mass",config.mass,"kg");add("springConstant",config.springConstant,"N/m");break;
    case "collision":add("massA",config.massA,"kg");add("massB",config.massB,"kg");add("uA",config.uA,"m/s");add("uB",config.uB,"m/s");add("vA",config.vA,"m/s");add("vB",config.vB,"m/s");break;
    case "phasor_diagram":
      for (const [i,phasor] of config.phasors.entries()) {
        const unit=phasor.label.match(/\/\s*([A-Za-zΩμ]+)\s*$/)?.[1];
        if (unit) add(`phasors[${i}].magnitude`,phasor.magnitude,unit);
        if (i>0 && phasor.angleDeg!==0) add(`phasors[${i}].angleDeg`,phasor.angleDeg,"deg");
      }break;
    case "dual":return [...visibleQuantities(config.left),...visibleQuantities(config.right)];
  }
  // Only explicitly unit-bearing textual labels are scientific givens. Identifiers
  // such as R1, dimensions in SVG coordinates and symbolic A/λ are not numbers.
  const labels:string[] = [];
  if ("title" in config && config.title) labels.push(config.title);
  if (config.type === "circuit" && config.showLabels) labels.push(...config.wires.map(wire=>wire.label??""));
  if (config.type === "beam" && config.showLabels) labels.push(...config.loads.map(load=>load.label),...config.reactions.map(reaction=>reaction.label),config.distributedMass?.label??"");
  if (config.type === "projectile" && config.showLabels) labels.push(config.speedLabel??"",config.angleLabel??"");
  if (config.type === "phasor_diagram") labels.push(...config.phasors.map(phasor=>phasor.label));
  for (const text of labels) for (const quantity of extractPhysicsQuantities(text)) quantities.push({field:"label",value:quantity.raw,unit:""});
  return quantities;
}

function asQuantity(value:number|string,unit:string):PhysicsQuantity|null {
  if (typeof value === "number") return parsePhysicsQuantity(`${value} ${unit}`);
  // A symbol is an unknown, never a numerical answer. Numeric strings with no
  // unit use the renderer field's documented unit; explicit units stay explicit.
  const explicit=parsePhysicsQuantity(value),expected=unit?parsePhysicsQuantity(`1 ${unit}`):null;
  if(explicit) return !expected || samePhysicsDimension(explicit.dimension,expected.dimension) ? explicit:null;
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()) ? parsePhysicsQuantity(`${value} ${unit}`) : null;
}

/** Validation is deliberately conservative; unsupported variants enter repair. */
export function physicsDiagramIssues(input:unknown,questionText="",options:{requireGivenLabels?:boolean}={}):ResourceIssue[] {
  const parsed = parsePhysicsDiagramConfig(input);
  if (parsed.success === false) return parsed.issues.map(detail=>invalid(`Physics figure ${detail}`));
  const config = parsed.config, text = plain(questionText), issues:ResourceIssue[] = [];
  const reject = (detail:string) => issues.push(invalid(detail));
  if (config.type === "dual") return [...physicsDiagramIssues(config.left,text,options),...physicsDiagramIssues(config.right,text,options)];
  if ("unknowns" in config && Array.isArray(config.unknowns)) {
    const canonical=(value:string)=>value.normalize("NFKC").toLowerCase().replace(/[\s_{}-]/g,"");
    const aliases:Record<string,string[]>={
      omega:["omega"],"ω":["omega"],angularvelocity:["omega"],angularspeed:["omega"],
      appliedforce:["appliedForce"],force:["appliedForce"],f:["appliedForce"],
      speed:["initialSpeed","speed"],velocity:["initialSpeed","speed"],initialspeed:["initialSpeed","speed"],initialvelocity:["initialSpeed","speed"],u:["initialSpeed","speed"],
      angle:["angle"],"α":["angle"],"θ":["angle"],theta:["angle"],alpha:["angle"],
      length:["length","stringLength"],stringlength:["stringLength"],l:["length","stringLength"],
      mass:["mass"],m:["mass"],height:["height"],h:["height"],
      time:["time","timeToMax"],t:["time","timeToMax"],timetomax:["timeToMax"],
      range:["landingX"],landingx:["landingX"],launchheight:["launchHeight"],
    };
    for (const unknown of config.unknowns) {
      const key=canonical(unknown), fields=Object.prototype.hasOwnProperty.call(aliases,key) ? aliases[key] : Object.keys(config).filter(field=>canonical(field)===key);
      const field=fields.find(field=>Object.prototype.hasOwnProperty.call(config,field));
      if(!field)continue;
      const value=(config as unknown as Record<string,unknown>)[field];
      if(typeof value==="number" || typeof value==="string" && parsePhysicsQuantity(value))
        reject(`The declared unknown Physics ${field} must be a symbol, null or omitted, without a public numerical value even when the renderer hides it.`);
    }
  }
  if (config.type === "pulley" && config.angle !== 0) reject("The pulley renderer supports a horizontal table only. Do not save an inclined-plane pulley as a horizontal apparatus.");
  if (config.type === "pulley") {
    // Only unambiguous nearby role statements are compared. This is a
    // validation witness, never an apparatus parser or a source of defaults.
    const mass="([0-9]+(?:\\.[0-9]+)?\\s*(?:kg|g))";
    const hanging=text.match(new RegExp(`\\bhanging\\s+(?:mass|block|particle)\\s*(?:of\\s*)?(?:mass\\s*)?${mass}`,"i"))?.[1]
      ?? text.match(new RegExp(`${mass}\\s+(?:mass|block|particle)\\s+(?:hangs|is suspended)`,"i"))?.[1];
    const onSurface=text.match(new RegExp(`\\b(?:block|particle|mass)\\s+(?:of\\s+)?(?:mass\\s+)?${mass}\\s+(?:rests|lies|sits|is placed)\\s+on\\s+(?:a\\s+)?(?:smooth\\s+|rough\\s+|horizontal\\s+)*(?:table|surface)`,"i"))?.[1];
    for (const [role,stated] of [["hanging",hanging],["onSurface",onSurface]] as const) if (stated) {
      const quantity=parsePhysicsQuantity(stated),saved=parsePhysicsQuantity(`${config.masses[role]} kg`);
      if(quantity&&saved&&!physicsQuantitiesEquivalent(quantity,saved)) issues.push(mismatch(`The saved pulley ${role} mass disagrees with the explicitly stated object's role.`));
    }
  }
  if (config.type === "free_body" && (config.angle !== 0 || /\b(?:inclined plane|inclined surface|on a slope)\b/i.test(text))) reject("This free-body renderer has a horizontal surface. Use the slope setup for an inclined plane.");
  if (config.type === "spring_mass" && config.orientation === "horizontal") reject("The spring-mass renderer currently supports vertical springs only.");
  if (config.type === "phasor_diagram" && !config.phasors.some(phasor=>phasor.magnitude>0)) reject("A phasor figure needs at least one nonzero magnitude.");
  if (config.type === "phasor_diagram" && options.requireGivenLabels && config.phasors.some(phasor=>!phasor.label.match(/\/\s*([A-Za-zΩμ]+)\s*$/))) reject("Every numerical phasor magnitude needs an explicit quantity unit in its saved label (for example V₁ / V).");
  for (const field of ["mass","massA","massB","length","stringLength","speed","initialSpeed","height","time","omega","appliedForce"] as const) {
    if (!(field in config)) continue;
    const value = (config as unknown as Record<string, unknown>)[field];
    if (typeof value === "number" && (value < 0 || ["mass","massA","massB","length","stringLength"].includes(field) && value===0)) reject(`Physics figure ${field} must have a physically valid positive/nonnegative value.`);
    if (typeof value === "string" && /\d/.test(value) && !/^[A-Za-zΑ-Ωα-ω?][A-Za-zΑ-Ωα-ω_{}₀-₉0-9]*$/.test(value) && !parsePhysicsQuantity(value) && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) reject(`Physics figure ${field} must contain one explicit quantity or an unknown symbol, without a calculated expression.`);
  }
  if (config.type === "beam") {
    const positions = [config.pivot.position,...config.loads.map(load=>load.position),...config.reactions.map(reaction=>reaction.position),...(config.pointLabels?.map(point=>point.position)??[]),...(config.distributedMass?[config.distributedMass.position]:[])];
    if (positions.some(value=>value>config.length)) reject("Every beam support, load and point label must lie within the stated beam length.");
    if (config.reactions.some(reaction=>reaction.isUnknown && /\d\s*(?:N|kN)\b/.test(reaction.label))) reject("An unknown beam reaction must retain a symbol, without a numerical answer.");
    for (const load of config.loads) {
      const magnitude=asQuantity(load.magnitude,"N");
      const quantity = magnitude && extractPhysicsQuantities(load.label).find(value=>physicsQuantitiesEquivalent(value,magnitude));
      if (/\d\s*(?:N|kN)\b/.test(load.label) && !quantity) issues.push(mismatch("A beam load label disagrees with its saved force magnitude."));
    }
  }
  if (config.type === "circuit") {
    const ids = new Set(config.nodes.map(node=>node.id));
    if (ids.size !== config.nodes.length) reject("Circuit node IDs must be unique.");
    if (new Set(config.nodes.map(node=>`${node.col},${node.row}`)).size !== config.nodes.length) reject("Distinct circuit nodes must not occupy the same grid location.");
    if (config.wires.some(wire=>!ids.has(wire.from)||!ids.has(wire.to)||wire.from===wire.to)) reject("Every circuit component must join two distinct saved nodes.");
    if (config.junctions?.some(junction=>!ids.has(junction.at))) reject("Circuit junctions must refer to saved node IDs.");
  }
  if (config.type === "ray_diagram") {
    if (["converging_mirror","diverging_mirror","eye_long_sight","eye_short_sight"].includes(config.variant)) reject("This optical variant has no faithful assessment renderer. Use a supported setup or repair the question and resource together.");
    if (["converging_lens","diverging_lens"].includes(config.variant) && !config.objectPosition) reject("A lens setup must explicitly state the object's position relative to F and 2F.");
    const askedImage = /\b(?:draw|sketch|locate|find|determine|describe|state)\b[^.!?]{0,80}\b(?:image|rays?|ray diagram)\b/i.test(text);
    if (askedImage && (config.showImage !== false || config.showConstruction !== false)) reject("The optical setup must hide the image and construction rays when the student must supply them.");
    if (/\bconverging lens\b/i.test(text) && config.variant === "diverging_lens" || /\bdiverging lens\b/i.test(text) && config.variant === "converging_lens") issues.push(mismatch("The lens type in the saved figure disagrees with the question."));
  }
  if (config.type === "wave_diagram" && ["interference","doppler","diffraction"].includes(config.variant)) reject("This wave variant has no faithful assessment renderer; a generic transverse wave cannot represent it.");
  if (config.type === "magnetic_field") {
    if (["current_loop","electromagnet","earth_field"].includes(config.variant)) reject("This field variant currently renders a placeholder and cannot be used as an assessment resource.");
    if (config.variant === "current_straight_wire" && !["into_page","out_of_page"].includes(config.currentDirection??"")) reject("A straight-wire cross-section must explicitly specify current into or out of the page.");
    if (config.variant === "current_straight_wire" && /\b(?:find|determine|state|predict|deduce)\b[^.!?]{0,70}\bcurrent\b/i.test(text)) reject("This straight-wire setup cannot hide its current-direction symbol; do not supply it when the student must infer current direction.");
    if (config.variant === "motor_effect" && (config.currentDirection && config.currentDirection!=="down" || config.forceDirection && config.forceDirection!=="right")) reject("This motor-effect renderer supports downward current, field into the page and rightward force only.");
    if (/\b(?:draw|sketch|complete)\b[^.!?]{0,70}\bfield lines?\b/i.test(text) && (config.showFieldLines!==false||config.showArrows!==false)) reject("A field-line drawing task must not expose the completed field lines or arrows.");
    if (/\b(?:find|determine|state|predict)\b[^.!?]{0,60}\b(?:force|motion|movement)\b/i.test(text) && config.showForceArrow!==false) reject("A force-direction task must hide the force arrow.");
  }
  if (config.type === "nuclear_decay") {
    if (["decay_chain","half_life_graph","nuclear_equation","fission","fusion"].includes(config.variant)) reject("This nuclear variant has no faithful assessment renderer. A generic equation or fixed fission products cannot stand in for the requested data.");
    if (!config.showPenetration && (!config.parentSymbol || config.parentMassNumber===undefined || config.parentAtomicNumber===undefined)) reject("A nuclear equation requires an explicit parent symbol, mass number and atomic number; no default isotope is allowed.");
    if (config.parentMassNumber!==undefined && config.parentAtomicNumber!==undefined && config.parentAtomicNumber>config.parentMassNumber || config.daughterMassNumber!==undefined && config.daughterAtomicNumber!==undefined && config.daughterAtomicNumber>config.daughterMassNumber) reject("An atomic number cannot exceed its nuclide's mass number.");
    const changes:Record<string,[number,number]> = {alpha_decay:[-4,-2],beta_minus_decay:[0,1],beta_plus_decay:[0,-1],gamma_decay:[0,0]};
    const change=changes[config.variant];
    if (change && config.parentMassNumber!==undefined && config.parentAtomicNumber!==undefined &&
      (config.daughterMassNumber!==undefined && config.daughterMassNumber!==config.parentMassNumber+change[0] || config.daughterAtomicNumber!==undefined && config.daughterAtomicNumber!==config.parentAtomicNumber+change[1])) issues.push(mismatch("The saved nuclear equation does not conserve nucleon number and charge for the declared decay."));
    if (/\b(?:find|determine|calculate|complete|identify|write)\b[^.!?]{0,90}\b(?:daughter|product|atomic number|mass number|equation|nuclide)\b/i.test(text) && (config.daughterMassNumber!==undefined||config.daughterAtomicNumber!==undefined||config.daughterSymbol && config.daughterSymbol!=="?")) reject("Unknown nuclear products must remain omitted or '?' in the public setup; do not save calculated daughter answers.");
    if(options.requireGivenLabels && !config.showPenetration) {
      const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      const symbol=escape(config.parentSymbol??"?");
      const mass=config.parentMassNumber,atomic=config.parentAtomicNumber;
      const notation = mass!==undefined && atomic!==undefined && new RegExp(`\\^\\s*\\{?${mass}\\}?\\s*_\\s*\\{?${atomic}\\}?\\s*${symbol}\\b`).test(text);
      if (mass!==undefined && !notation && !new RegExp(`(?:\\bmass number\\s*(?:of|is|=)?\\s*${mass}\\b|\\b${symbol}\\s*-\\s*${mass}\\b)`,"i").test(text)) issues.push(mismatch("The nuclear parent mass number must match explicitly stated isotope notation or a labelled mass number."));
      if (atomic!==undefined && !notation && !new RegExp(`\\b(?:atomic|proton) number\\s*(?:of|is|=)?\\s*${atomic}\\b`,"i").test(text)) issues.push(mismatch("The visible parent atomic number must match an explicitly stated atomic/proton number or isotope notation."));
    }
  }
  if (config.type === "projectile") {
    if (typeof config.angle === "number" && (config.angle<0||config.angle>90)) reject("The projectile setup supports launch angles from 0 to 90 degrees.");
    if (/\b(?:find|calculate|determine)\b[^.!?]{0,70}\b(?:range|horizontal distance)\b/i.test(text) && typeof config.landingX === "number") reject("The unknown projectile range must remain a symbol or be omitted, not a saved numerical answer.");
    if (/\b(?:find|calculate|determine)\b[^.!?]{0,70}\btime\b/i.test(text) && typeof config.timeToMax === "number") reject("The unknown projectile time must remain a symbol or be omitted.");
    for (const [field,names] of [["speed",["speed","U"]],["angle",["angle","α"]],["landingX",["range","landingX"]],["timeToMax",["time","timeToMax"]]] as const) if(config.unknowns?.some(name=>(names as readonly string[]).includes(name)) && typeof config[field] === "number") reject(`The unknown projectile ${field} must be a symbol or omitted, not a hidden numerical value.`);
  }
  if (config.type === "vertical_motion" && config.unknowns.some(name=>["speed","velocity","initialSpeed","u","U"].includes(name)) && typeof config.initialSpeed === "number") reject("An unknown initial speed must be stored as a symbol, without a numerical placeholder or answer.");
  if (config.type === "collision" && /\b(?:find|calculate|determine)\b[^.!?]{0,80}\b(?:final|after|following|velocity|velocities|speed)\b/i.test(text) && (config.vA!==null||config.vB!==null)) reject("Unknown post-collision velocities must be null so the public figure displays question marks.");
  if (options.requireGivenLabels) {
    const givens = extractPhysicsQuantities(text);
    for (const shown of visibleQuantities(config)) {
      const quantity = asQuantity(shown.value,shown.unit);
      if ((typeof shown.value === "number" || typeof shown.value==="string" && /^\s*[+-]?(?:\d|\.\d)/.test(shown.value)) && !quantity) reject(`The numerical ${shown.field} label must have the field's supported physical unit.`);
      // Rest and a horizontal baseline are qualitative givens, not invented
      // numeric labels. All other visible numbers must be grounded with units.
      if (quantity && !(quantity.siValue===0 && /\b(?:at rest|stationary|horizontal|from rest)\b/i.test(text)) && !givens.some(given=>physicsQuantitiesEquivalent(quantity,given)))
        issues.push(mismatch(`The visible Physics figure value ${shown.field}=${shown.value}${shown.unit?` ${shown.unit}`:""} is not an equivalent stated quantity with matching units. Repair the stem, figure and private key together; do not match unrelated numbers or SVG coordinates.`));
    }
  }
  return issues.filter((issue,index)=>issues.findIndex(other=>other.code===issue.code&&other.detail===issue.detail)===index);
}

/** Called from the generation validator, including the existing repair loop. */
export function physicsFigureIssues(question:ResourceQuestion,options:{requireContract?:boolean}={}):ResourceIssue[] {
  const raw = rawObject(question.diagram_config ?? question.diagramConfig), text=plain(question.question_text);
  const marked = !!raw && ("physics_figure_version" in raw || "diagram_intent" in raw || raw.type===PHYSICS_NO_FIGURE);
  if (!marked && !options.requireContract) return raw && isPhysicsDiagramType(raw.type) ? physicsDiagramIssues(raw,text) : [];
  const contract = readPhysicsFigureContract(raw);
  if (!contract) return [invalid("New Physics questions require a saved diagram_config with physics_figure_version:1 and explicit diagram_intent. Missing or malformed setup figures must enter repair, not renderer inference.")];
  const privateFields=privatePhysicsResourceIssues(question);
  if(privateFields.length)return privateFields;
  if (question.diagram_config && question.diagramConfig && stable(rawObject(question.diagram_config))!==stable(rawObject(question.diagramConfig))) return [mismatch("The saved Physics diagram aliases disagree. Keep one exact figure contract.")];
  if (contract.intent === "none" || contract.intent === "student_draws") {
    if (raw!.type!==PHYSICS_NO_FIGURE || Object.keys(raw!).some(key=>!["type","physics_figure_version","diagram_intent"].includes(key))) return [invalid("A no-figure/student-drawing intent must use only the physics_no_figure sentinel and its two contract markers.")];
    if (contract.intent === "student_draws" && !/\b(?:draw|sketch|complete|construct|design)\b[^.!?]{0,100}\b(?:diagram|graph|circuit|rays?|field lines?|wavefront|apparatus|free.body)\b/i.test(text)) return [invalid("student_draws intent requires an actual task asking the student to supply a figure; it cannot bypass a missing setup figure.")];
    return contract.intent === "none" && needsPhysicsSetupFigure(text) ? [invalid("This question describes apparatus or a visual setup but has diagram_intent:none. Supply a matching explicit saved setup figure or repair the task; do not silently omit the required apparatus.")] : [];
  }
  if (contract.intent === "graph") return ["line_chart","bar_chart","data_table","histogram","scatter","scatter_plot"].includes(raw!.type) ? [] : [invalid("Graph intent requires an explicit saved graph or table resource.")];
  if (!isPhysicsDiagramType(raw!.type)) return [invalid("Setup intent requires one supported explicit Physics/mechanics/circuit configuration.")];
  const extraChart=rawObject(question.chart_data);
  if(extraChart && extraChart.type!=="data_table") return [mismatch("A versioned Physics setup cannot also carry a separate graph/chart resource in chart_data. Save one unambiguous public setup per part so screen and PDF use the same figure.")];
  return physicsDiagramIssues(raw,text,{requireGivenLabels:true});
}

/** Examples are renderer configurations, never defaults or automatic apparatus. */
export const PHYSICS_FIGURE_EXAMPLES = {
  slope:{type:"slope",angle:30,mass:4,surface:"rough",showNormal:false,showWeight:false,showFriction:false,showComponents:false,showLabels:true},
  free_body:{type:"free_body",angle:0,mass:4,appliedForce:12,appliedForceDir:"horizontal",surface:"smooth",unknowns:["normal","weight"],showLabels:true},
  conical_pendulum:{type:"conical_pendulum",stringLength:1.2,angle:30,mass:0.2,omega:"ω",showTension:false,showWeight:false,showRadius:true,unknowns:["tension","omega"],showLabels:true},
  vertical_motion:{type:"vertical_motion",initialSpeed:12,direction:"up",mass:"m",unknowns:["maxHeight"],showLabels:true},
  pulley:{type:"pulley",surface:"smooth",angle:0,masses:{hanging:2,onSurface:4},showLabels:true,showForces:false,friction:false},
  beam:{type:"beam",length:4,pivot:{type:"support",position:0},loads:[{position:4,magnitude:20,label:"20 N"}],reactions:[{position:0,label:"R",isUnknown:true}],showLabels:true,endLabels:{left:"A",right:"B"}},
  projectile:{type:"projectile",speed:20,angle:30,launchHeight:0,targetX:40,targetY:20,showComponents:false,showLabels:true,unknowns:["range","timeToMax"]},
  rod:{type:"rod",angle:60,mass:5,length:3,wallType:"smooth",floorType:"rough",showForces:false,showLabels:true},
  vertical_lift:{type:"vertical_lift",mass:20,height:3,time:"t",unknowns:["time"]},
  phasor_diagram:{type:"phasor_diagram",phasors:[{magnitude:3,angleDeg:0,label:"V₁ / V"},{magnitude:4,angleDeg:90,label:"V₂ / V"}]},
  delta_wye_comparison:{type:"delta_wye_comparison"},
  connected_particles:{type:"connected_particles",massA:2,massB:3,angle:30,surface:"smooth"},
  spring_mass:{type:"spring_mass",mass:0.2,extension:0.1,naturalLength:0.5,springConstant:null,orientation:"vertical"},
  collision:{type:"collision",massA:2,massB:3,uA:4,uB:0,vA:null,vB:null,collisionType:"collision"},
  dual:{type:"dual",left:{type:"circuit",gridSpacing:80,nodes:[{id:"a",col:0,row:0},{id:"b",col:2,row:0},{id:"c",col:2,row:2},{id:"d",col:0,row:2}],wires:[{from:"a",to:"b",component:"battery",label:"12 V"},{from:"b",to:"c",component:"motor"},{from:"c",to:"d",component:"wire"},{from:"d",to:"a",component:"wire"}],showLabels:true},right:{type:"vertical_lift",mass:20,height:3,time:"t"}},
  circuit:{type:"circuit",gridSpacing:80,nodes:[{id:"a",col:0,row:0},{id:"b",col:2,row:0},{id:"c",col:2,row:2},{id:"d",col:0,row:2}],wires:[{from:"a",to:"b",component:"battery",label:"12 V"},{from:"b",to:"c",component:"resistor",label:"6 Ω"},{from:"c",to:"d",component:"switch_open"},{from:"d",to:"a",component:"wire"}],junctions:[],showLabels:true,showCurrentArrows:false},
  ray_diagram:{type:"ray_diagram",variant:"converging_lens",objectPosition:"between_f_2f",showConstruction:false,showImage:false,showNormals:false,showAngles:false},
  wave_diagram:{type:"wave_diagram",variant:"transverse",amplitude:1,showAmplitudeLabel:true,showWavelengthLabel:true,showNodeLabels:false},
  magnetic_field:{type:"magnetic_field",variant:"bar_magnet",northOnLeft:true,showFieldLines:true,showArrows:true,labelN:true,labelS:true},
  nuclear_decay:{type:"nuclear_decay",variant:"alpha_decay",parentSymbol:"U",parentMassNumber:238,parentAtomicNumber:92,daughterSymbol:"?",showPenetration:false},
  electromagnetic_spectrum:{type:"electromagnetic_spectrum",highlightRegion:"visible",showWavelength:false,showFrequency:false,showUses:false,showProperties:false},
} satisfies {[T in PhysicsFigureConfig["type"]]:Extract<PhysicsFigureConfig,{type:T}>};

export const PHYSICS_FIGURE_PROMPT = `
PHYSICS SAVED FIGURE CONTRACT (version 1; applies to every new Physics question)
Return exactly one diagram_config JSON object. Persist physics_figure_version:1 and diagram_intent in this object, alongside the renderer configuration. Do not put these markers only at the question's top level.
- Apparatus/setup required: {physics_figure_version:1,diagram_intent:"setup",type:<supported type>,...exact saved renderer fields}. A pulley, projectile, slope, beam, optical apparatus or other visual setup must have its own explicit configuration. Its absence is a repair error. Never ask a renderer/detector to reconstruct apparatus from prose.
- No visual setup (definition, recall, ordinary single-formula calculation): {type:"physics_no_figure",physics_figure_version:1,diagram_intent:"none"}.
- Student supplies the diagram itself: {type:"physics_no_figure",physics_figure_version:1,diagram_intent:"student_draws"}. Do not attach the completed free-body/ray/field/circuit drawing as the question stimulus. A partially supplied optical setup may instead use setup with showImage:false and showConstruction:false.
- Graph/table task: store the complete existing graph/table schema, with physics_figure_version:1 and diagram_intent:"graph". Keep both axis quantities and units; a graph task does not justify an unrelated circuit/apparatus.
Repeat every numerical quantity visibly labelled by the setup in the question stem with its unit, using identical values or exact equivalent SI units. Match each object's role (e.g. hanging mass versus mass on the table). SVG coordinates, schematic targetX/targetY, layout spacing and dimensionless drawing scales are not experimental givens. Never put a derived numerical answer into any public figure field, even if a renderer would hide it. Use an allowed symbol or null for unknowns, and keep numerical answers in correct_answer/marking guidance only.
All configuration fields are strict: finite bounded numbers, supported enum variants, short plain-text scientific labels, no HTML/URLs and no invented extra keys. Save explicit booleans/unknowns; do not rely on renderer defaults. Circuit nodes use {id,col,row}; junctions use {at:id}; every wire references distinct existing nodes and an exact supported component. Open switches/circuits are allowed.
Current assessment support: mechanics types below; horizontal-table pulley only (angle:0); horizontal free_body only; vertical spring only. Optics: converging_lens/diverging_lens/flat_mirror/refraction_block/prism_dispersion/optical_fibre only. Waves: transverse/longitudinal/superposition/standing_wave only. Magnetic: bar_magnet/two_bar_magnets_attract/two_bar_magnets_repel/current_straight_wire/current_solenoid/motor_effect only. Nuclear: alpha_decay/beta_minus_decay/beta_plus_decay/gamma_decay only; save explicit parent isotope, and omit daughter values when students must determine them. Unsupported mirrors/eye models, wave diffraction/interference/Doppler, field placeholders, decay chains/half-life graphs/equation/fission/fusion must be represented by an appropriate validated graph/table or a question that does not claim an unavailable figure. Do not substitute a generic picture.
The following exact shapes are examples, not suggested question data. Choose values and flags for the actual generated question. Add the two version/intent markers to every example used. Include all required fields; do not invent data to fill a shape:
${JSON.stringify(PHYSICS_FIGURE_EXAMPLES)}
`;
