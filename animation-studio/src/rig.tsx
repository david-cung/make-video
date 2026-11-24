import type {ReactNode} from "react";
import cast from "../configs/cast.json";
import {animationState, armEndpoint, blinkAt, clamp, ease, joints, mix, solveArm} from "./motion.mjs";
import type {CharacterId, Expression, Hand, Point, View, Viseme} from "./types";

export const ink = "#283144";
export type Design = (typeof cast)[CharacterId];
export const partNames = [
  "head","hair","left-eye","right-eye","pupils","eyelids","eyebrows","mouth","torso",
  "left-upper-arm","left-forearm","left-hand","right-upper-arm","right-forearm","right-hand","legs","feet","accessories",
] as const;
export type PartName = typeof partNames[number];
const outlines = {stroke:ink,strokeWidth:3.6,strokeLinejoin:"round",strokeLinecap:"round"} as const;
type Face = {brow:number; slant:number; open:number; tilt:number; blush:number; smile:number};
export const expressions: Record<Expression, Face> = {
  neutral:{brow:0,slant:0,open:1,tilt:0,blush:0,smile:0},
  happy:{brow:-3,slant:13,open:.75,tilt:-4,blush:.27,smile:.92},
  angry:{brow:6,slant:-26,open:.63,tilt:7,blush:.65,smile:-.8},
  confused:{brow:-7,slant:-16,open:1.02,tilt:10,blush:.06,smile:-.42},
  suspicious:{brow:4,slant:-11,open:.52,tilt:-4,blush:0,smile:-.25},
  shocked:{brow:-12,slant:13,open:1.27,tilt:-7,blush:0,smile:0},
  sad:{brow:-3,slant:29,open:.64,tilt:6,blush:.12,smile:-.93},
  annoyed:{brow:7,slant:-20,open:.48,tilt:4,blush:.08,smile:-.56},
  embarrassed:{brow:-6,slant:20,open:.72,tilt:13,blush:.81,smile:-.14},
  excited:{brow:-10,slant:9,open:1.15,tilt:-4,blush:.45,smile:1},
  smug:{brow:-4,slant:-15,open:.48,tilt:-7,blush:.06,smile:.7},
  deadpan:{brow:6,slant:0,open:.47,tilt:0,blush:0,smile:-.08},
};

export function ExpressionController(current: Expression, previous: Expression, frame: number): Face {
  const from=expressions[previous], to=expressions[current], p=ease(frame/7);
  return {brow:mix(from.brow,to.brow,p),slant:mix(from.slant,to.slant,p),open:mix(from.open,to.open,p),
    tilt:mix(from.tilt,to.tilt,p),blush:mix(from.blush,to.blush,p),smile:mix(from.smile,to.smile,p)};
}

function EyeWhite({x,open,far}: {x:number;open:number;far:boolean}) {
  return <ellipse cx={x} cy="-8" rx={far?11:15} ry={Math.max(1.2,12*open)} fill="#fff9eb" stroke={ink} strokeWidth="3"/>;
}

export function CharacterEyes({direction, blink, open, view}: {direction:number;blink:number;open:number;view:View}) {
  if(view==="back")return null;
  const openness=Math.max(.03,open*(1-blink)), profile=view==="side";
  const pupil=(x:number,far:boolean)=><ellipse cx={x+direction*(far?4:6)} cy="-7" rx={far?3.8:5.2} ry={6.5*openness} fill={ink}/>;
  return <>
    {!profile&&<g data-layer="left-eye"><EyeWhite x={-15} open={openness} far={view==="three-quarter"}/></g>}
    <g data-layer="right-eye"><EyeWhite x={profile?17:17} open={openness} far={false}/></g>
    <g data-layer="pupils" opacity={1-blink}>{!profile&&pupil(-15,true)}{pupil(17,false)}</g>
    <g data-layer="eyelids" opacity={Math.max(0,blink-.65)*2.8} stroke={ink} strokeWidth="3.8" strokeLinecap="round">
      {!profile&&<path d="M-29-8q12 5 22 0"/>}<path d="M2-8q15 5 29 0"/>
    </g>
  </>;
}

export function CharacterMouth({viseme, smile, skin, active}: {viseme:Viseme;smile:number;skin:string;active?:boolean}) {
  const lip={stroke:ink,strokeWidth:3.2,strokeLinecap:"round",strokeLinejoin:"round"} as const;
  if(viseme==="X"||viseme==="A")return <g data-layer="mouth" transform="translate(11 32)">
    <path d={`M-13 ${smile*-3} Q 0 ${smile*13+1} 13 ${smile*-4}`} fill="none" {...lip}/>
    {active&&<path d="M-5 3Q3 6 8 1" fill="none" stroke={skin} strokeWidth="2"/>}
  </g>;
  const shapes:Record<Exclude<Viseme,"A"|"X">,{d:string; teeth?:string; tongue?:string}>={
    B:{d:"M-15-4Q1-7 17-4Q7 10-10 5Z",teeth:"M-14-4Q0-7 16-4l-3 4h-26Z"},
    C:{d:"M-16-4Q0-13 17-5Q19 12-1 14Q-14 12-16-4Z",tongue:"M-8 10Q0 4 12 10Q2 15-8 10Z"},
    D:{d:"M-17-6Q-2-13 16-8Q22 17 0 22Q-19 20-17-6Z",tongue:"M-11 16Q0 7 13 15Q4 24-11 16Z"},
    E:{d:"M-11-6Q-1-13 11-6Q18 9 4 15Q-10 13-11-6Z"},
    F:{d:"M-8-5Q1-13 10-5Q16 10 1 13Q-12 9-8-5Z"},
    G:{d:"M-13-5Q0-9 15-4Q6 8-8 7Z",teeth:"M-12-5Q0-9 14-4l-4 5-19 1Z"},
    H:{d:"M-14-5Q0-10 18-6Q18 8 0 13Q-14 8-14-5Z",tongue:"M-8 7Q3-4 13 5Q4 12-8 7Z"},
  };
  const shape=shapes[viseme];
  return <g data-layer="mouth" transform="translate(11 29)">
    <path d={shape.d} fill="#4c2942" {...lip}/>
    {shape.teeth&&<path d={shape.teeth} fill="#fff9ed"/>}
    {shape.tongue&&<path d={shape.tongue} fill="#eb8193"/>}
  </g>;
}

function CharacterFace({id,view,face,viseme,eyeDirection,blink,active}: {
  id:CharacterId; view:View; face:Face; viseme:Viseme; eyeDirection:number; blink:number; active:boolean;
}) {
  const d=cast[id], compact=d.silhouette==="compact", side=view==="side", back=view==="back", front=view==="front";
  const profile=side?"M-36-31Q-25-63 12-56Q29-51 39-18L50-1 40 8 39 24Q36 45 16 52Q-23 56-38 34Z":
    compact?"M-53-29Q-58-48-32-57Q1-72 38-56Q59-46 53-11L52 22Q41 53 16 57Q-23 62-49 34Q-61 15-53-29Z":
    "M-46-32Q-43-60-12-58Q29-63 43-39L48-10Q54 17 39 41Q26 62-2 54Q-33 52-46 24Z";
  return <g>
    <g data-layer="head">
      <ellipse cx={side?-33:-46} cy="9" rx="12" ry="15" fill={d.skin} {...outlines}/>
      {front&&<ellipse cx="47" cy="9" rx="11" ry="15" fill={d.skin} {...outlines}/>}
      <path d={profile} fill={d.skin} {...outlines}/>
      {!back&&!side&&<path d="M11 4q15 5 17 14q-5 5-14 2" fill="none" stroke="#7a5549" strokeWidth="2.7" strokeLinecap="round"/>}
      {!back&&<ellipse cx={side?29:38} cy="22" rx={8+face.blush*6} ry="5" fill="#d45665" opacity={face.blush}/>}
      {!back&&!side&&<ellipse cx="-27" cy="22" rx="8" ry="5" fill="#d45665" opacity={face.blush*.79}/>}
    </g>
    <g data-layer="hair" fill={d.hair} {...outlines}>
      {back?<path d={profile}/>:compact
        ?<path d="M-54 3Q-68-61-22-65Q-14-80 2-70Q28-76 41-55Q67-54 54-6L47 5 42-30Q13-24-18-38L-36-12-39 16Z"/>
        :<path d="M-47 12Q-62-11-49-42Q-42-55-25-59Q-30-76-6-79Q29-72 47-43Q21-30-7-44L-27-26-36-10-38 19Z"/>}
      {back&&<path d="M-35 29Q3 39 41 24" stroke="#56617d" fill="none" strokeWidth="2.4"/>}
      {!back&&<path d={compact?"M-40-49Q4-50 40-37":"M-23-57Q11-65 31-49"} stroke="#56617d" fill="none" strokeWidth="2.4"/>}
    </g>
    {!back&&<>
      <g data-layer="eyebrows" fill="none" stroke={ink} strokeWidth={compact?4.5:4.1} strokeLinecap="round">
        {!side&&<path d="M-29-27q12-5 22 0" transform={`translate(0 ${face.brow}) rotate(${face.slant} -18 -27)`}/>}
        <path d="M5-27q12-6 25 0" transform={`translate(0 ${face.brow+(face.tilt>5?4:0)}) rotate(${-face.slant} 17 -27)`}/>
      </g>
      <CharacterEyes direction={eyeDirection} blink={blink} open={face.open} view={view}/>
      <CharacterMouth viseme={viseme} smile={face.smile} skin={d.skin} active={active}/>
    </>}
  </g>;
}

export function CharacterHands({skin, grasp}: {skin:string;grasp?:boolean}) {
  return <g fill={skin} {...outlines}>
    <path d={grasp?"M-9-3Q-4-13 8-9L17-5Q21 4 13 11L0 12Q-9 10-9-3Z":
      "M-9-9Q-7-15 0-13L9-8Q21-5 19 3L13 11 3 14-7 10Q-12 2-9-9Z"}/>
    <path d={grasp?"M4-3q3 6 8 4":"M3-3q6 1 9 5"} fill="none" stroke="#86584c" strokeWidth="2"/>
  </g>;
}

function ArmArt({id,hand,upper,bend,grasp}: {id:CharacterId;hand:Hand;upper:number;bend:number;grasp:boolean}) {
  const d=cast[id], origin=hand==="right"?joints.rightShoulder:joints.leftShoulder;
  return <g transform={`translate(${origin[0]} ${origin[1]}) rotate(${upper})`}>
    <g data-layer={`${hand}-upper-arm`}><path d="M-5-12Q11-16 47-10L54-3 47 10Q17 14-7 12Q-14-2-5-12Z" fill={d.shirt} {...outlines}/></g>
    <g transform={`translate(${joints.upper} 0) rotate(${bend})`}>
      <g data-layer={`${hand}-forearm`}><path d="M-5-9Q11-11 48-7L52 0 48 8Q27 11-5 9Q-13 0-5-9Z" fill={id==="jun"?d.skin:d.shirt} {...outlines}/></g>
      <g data-layer={`${hand}-hand`} transform={`translate(${joints.lower} 0)`}><CharacterHands skin={d.skin} grasp={grasp}/></g>
    </g>
  </g>;
}

function Outfit({id,view,chest}: {id:CharacterId;view:View;chest:number}) {
  const d=cast[id], compact=id==="jun";
  return <g transform={`translate(0 -123) scale(${view==="side"?.78:1} ${chest})`}>
    <g data-layer="torso">
      <path d={compact?"M-34-37Q0-47 37-34L47 42Q25 59-10 58L-43 49Q-53 12-34-37Z":
        "M-31-40Q-9-50 34-36L43 49Q18 63-41 49L-43 5Z"} fill={d.shirt} {...outlines}/>
      <path d="M-17-39Q-6-25 13-36" fill="none" stroke={d.trim} strokeWidth="6"/>
      <path d="M-32 38q32 10 63 0" stroke={d.trim} opacity=".56" fill="none" strokeWidth="3"/>
    </g>
    <g data-layer="accessories">
      {compact?<><path d={view==="back"?"M-32 1L32 47M32 1L-32 47":"M-22-30L-29 44Q0 58 35 43L23-29 13-27 19 8-18 8-12-29Z"}
        fill={view==="back"?"none":d.pants} {...outlines}/>{view!=="back"&&<path d="M-13 26Q3 41 19 27M18 14q0-9 8-14" fill="none" stroke="#85b7a7" strokeWidth="3"/>}</>:
        <><path d="M-33 19-45 49-28 62-20 59-7 33Z" fill="#9a6e59" {...outlines}/><path d="M-30-35-13 47" stroke="#b3836b" strokeWidth="7"/></>}
    </g>
  </g>;
}

function Legs({id,stride,hip}:{id:CharacterId;stride:number;hip:number}) {
  const d=cast[id];
  return <>
    <g data-layer="legs" fill={d.pants} {...outlines}>
      <path d={`M-33-81-8-82-8 ${-37+hip*.6} ${-13+stride*.55} -11 ${-33+stride*.55} -11-33-42Z`}/>
      <path d={`M7-82 35-83 33 ${-43+hip*.6} ${34-stride*.55} -9 ${15-stride*.55} -9 9-42Z`}/>
    </g>
    <g data-layer="feet" fill={d.shoe} {...outlines}>
      <path transform={`translate(${stride*.55} 0)`} d="M-34-13-13-13-4-8Q6-7 6-2-10 6-35 2Z"/>
      <path transform={`translate(${-stride*.55} 0)`} d="M13-12 33-13 45-8Q57-4 55 2L12 3Z"/>
    </g>
  </>;
}

export type RigMotion = ReturnType<typeof animationState>;
export const idleMotion=animationState("idle",0,120);
export type ArmPair={l:number;r:number;le:number;re:number};

export function CharacterSkeleton({id,view,motion,arms,hand,grasp,children}: {
  id:CharacterId;view:View;motion:RigMotion;arms:ArmPair;hand?:Hand;grasp:boolean;children:ReactNode;
}) {
  return <>
    <Legs id={id} stride={motion.stride} hip={motion.hip}/>
    <ArmArt id={id} hand="left" upper={arms.l} bend={arms.le} grasp={grasp&&hand==="left"}/>
    <Outfit id={id} view={view} chest={motion.chest}/>
    <ArmArt id={id} hand="right" upper={arms.r} bend={arms.re} grasp={grasp&&hand==="right"}/>
    <g transform={`translate(${joints.head[0]+motion.shift} ${joints.head[1]})`}>{children}</g>
  </>;
}

export function CharacterRig({id,view,frame,local,clip,motion,arms,hand,grasp,expression,previous,
  gaze,viseme,active=false}: {
  id:CharacterId;view:View;frame:number;local:number;clip:string;motion:RigMotion;arms:ArmPair;hand?:Hand;grasp:boolean;
  expression:Expression;previous:Expression;gaze:number;viseme:Viseme;active?:boolean;
}) {
  const face=ExpressionController(expression,previous,local);
  return <CharacterSkeleton id={id} view={view} motion={motion} arms={arms} hand={hand} grasp={grasp}>
    <g transform={`rotate(${motion.head+face.tilt})`}>
      <g transform={`scale(${view==="side"?.88:view==="front"?.98:1} 1)`}>
        <CharacterFace id={id} view={view} face={face} viseme={viseme} eyeDirection={gaze} blink={blinkAt(id,frame,clip,local)} active={active}/>
      </g>
    </g>
  </CharacterSkeleton>;
}

export function constrainHand(motion:RigMotion, hand:Hand, target:Point|null):{arms:ArmPair;anchor:Point} {
  const origin = hand==="right"?joints.rightShoulder:joints.leftShoulder;
  const [upper,bend]=target?solveArm(origin,target,hand):hand==="right"?[motion.r,motion.re]:[motion.l,motion.le];
  const arms=hand==="right"?{...motion,r:upper,re:bend}:{...motion,l:upper,le:bend};
  return {arms,anchor:armEndpoint(origin,upper,bend) as Point};
}

export function CharacterController(id:CharacterId,current:RigMotion,previous:RigMotion,local:number) {
  const p=ease(clamp(local/7));
  return Object.fromEntries(Object.entries(current).map(([key,value])=>
    [key,mix(previous[key as keyof RigMotion]??value,value,p)])) as RigMotion;
}

export const AnimationStateMachine = animationState;
