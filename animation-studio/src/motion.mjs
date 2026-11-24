export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const mix = (a, b, t) => a + (b - a) * t;
export const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
export const envelope = (frame, length, attack = 10, release = 10) =>
  ease(frame / attack) * ease((length - 1 - frame) / release);

export const joints = {
  head:[0,-193], leftShoulder:[-31,-148], rightShoulder:[31,-148], upper:49, lower:48,
  leftHip:[-17,-75], rightHip:[17,-75],
};
const baseline = {bob:0, head:0, shift:0, chest:1, l:108, r:72, le:-15, re:16, hip:0, stride:0};

export function animationState(clip, frame, length, hand = "right") {
  const t = frame / 30;
  const phase = Math.sin(t * Math.PI * 2);
  const e = envelope(frame, length);
  const q = {...baseline, bob: Math.sin(t * 2.6) * 1.25, chest:1 + Math.sin(t*2.6) * .016};
  const raise = (upper, lower) => hand === "right"
    ? {r:mix(q.r, upper,e),re:mix(q.re,lower,e)} : {l:mix(q.l,180-upper,e),le:mix(q.le,-lower,e)};
  switch (clip) {
    case "point": return {...q,...raise(-12,18),head:-5*e,shift:4*e};
    case "wave": return {...q,...raise(-52, -38 + 28*phase),head:6*e};
    case "shrug": return {...q,l:108+46*e,r:72-46*e,le:35*e,re:-35*e,bob:q.bob-7*e,head:7*e};
    case "nod": return {...q,head:11*e*Math.sin(t*9),bob:2.5*e*Math.sin(t*9)};
    case "shake-head": return {...q,head:9*e*Math.sin(t*13),shift:5*e*Math.sin(t*13)};
    case "talk": return {...q,...raise(12+8*phase,-50+15*phase),head:3*e*Math.sin(t*8)};
    case "look-left": return {...q,head:-7*e,shift:-5*e};
    case "look-right": return {...q,head:7*e,shift:5*e};
    case "walk": case "run": {
      const fast=clip==="run", swing=Math.sin(t*(fast?14:8));
      return {...q,bob:-Math.abs(swing)*(fast?9:4)*e,stride:swing*(fast?31:20)*e,shift:fast?6:2,l:108+24*swing*e,r:72-24*swing*e};
    }
    case "sit": case "stand-up": {
      const sit=clip==="sit"?ease(frame/19):1-ease(frame/19);
      return {...q,hip:48*sit,bob:40*sit,head:8*sit,...raise(48,-50)};
    }
    case "grab": return {...q,...raise(20,-23),head:6*e,shift:4*e};
    case "hold": return {...q,...raise(38,-99),head:-3*e};
    case "drink": return {...q,...raise(-12,-63),head:-10*e};
    case "eat": return {...q,...raise(18,-94),head:-5*e+2*phase*e};
    case "surprise": return {...q,bob:-20*Math.sin(Math.PI*ease(frame/20)),l:108+24*e,r:72-36*e,head:-8*e};
    case "anger": return {...q,...raise(10,-72),head:6*e,shift:7*e};
    case "laugh": return {...q,bob:Math.abs(phase)*7*e,head:9*e+4*phase*e};
    case "embarrassment": return {...q,bob:4*e,head:12*e,shift:-5*e};
    default:return q;
  }
}

const deg = a => a * Math.PI / 180;
const rad = a => a * 180 / Math.PI;
export function armEndpoint(origin, a, bend) {
  return [
    origin[0] + joints.upper*Math.cos(deg(a)) + joints.lower*Math.cos(deg(a+bend)),
    origin[1] + joints.upper*Math.sin(deg(a)) + joints.lower*Math.sin(deg(a+bend)),
  ];
}

export function solveArm(origin, target, hand) {
  const x=target[0]-origin[0], y=target[1]-origin[1];
  const d=clamp(Math.hypot(x,y),Math.abs(joints.upper-joints.lower)+.001,joints.upper+joints.lower-.001);
  const bend=(hand==="right"?1:-1)*Math.acos(clamp((d*d-joints.upper**2-joints.lower**2)/(2*joints.upper*joints.lower),-1,1));
  const upper=Math.atan2(y,x)-Math.atan2(joints.lower*Math.sin(bend),joints.upper+joints.lower*Math.cos(bend));
  return [rad(upper),rad(bend)];
}

export function beatAt(beats, frame) {
  const index=beats.findIndex(beat=>frame<beat.start+beat.length);
  return Math.max(0,index<0?beats.length-1:index);
}

export function propTrack(beats, id, frame, initial = []) {
  const events=[...initial.filter(cue=>cue.prop===id).map(cue=>({...cue,frame:-1000})),
    ...beats.flatMap(beat=>(beat.props??[]).filter(cue=>cue.prop===id)
      .map(cue=>({...cue,frame:beat.start+Math.round(cue.at*30)})))].sort((a,b)=>a.frame-b.frame);
  const index=events.findIndex(event=>event.frame>frame);
  const count=index<0?events.length:index;
  return {state:events[count-1],previous:events[count-2],next:events[count]};
}

export function blinkAt(id, frame, clip, local) {
  const step=id==="milo"?117:139;
  const elapsed=(frame+(id==="milo"?79:33))%step;
  const natural=elapsed<8?Math.sin(Math.PI*elapsed/8):0;
  const intentional=clip==="blink"&&local>=14&&local<23?Math.sin(Math.PI*(local-14)/9):0;
  return Math.max(natural,intentional);
}

export function mouthAt(line, character, frame) {
  if(!line || line.speaker!==character || frame<line.start || frame>=line.end) return "X";
  return line.mouthCues.find(cue=>frame>=cue.start&&frame<cue.end)?.value ?? "X";
}
