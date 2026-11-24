import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from "remotion";
import {animationState, beatAt, clamp, ease, mix, mouthAt, propTrack} from "./motion.mjs";
import {CharacterController, CharacterRig, constrainHand} from "./rig";
import {EnvironmentLayer, InteractiveProp, propAnchor, setData} from "./set";
import type {CharacterId, Hand, Point, PropCue, PropId, StageProps, TimedBeat, TimedScene, Timeline} from "./types";

const roles:Record<CharacterId,{size:number;facing:number}>={milo:{size:1,facing:1},jun:{size:.89,facing:-1}};
const propIds=["door","window","table","chair","bowl","cup","phone","bag","food","sign","receipt"] as const;
const home=(scene:TimedScene,id:CharacterId):Point=>propAnchor(scene.set,id)??(id==="milo"?[410,604]:[874,563]);

function animationInputs(scene:TimedScene,beat:TimedBeat,previous:TimedBeat,id:CharacterId,frame:number){
  const local=frame-beat.start, spec=beat.poses?.[id], prev=previous.poses?.[id];
  const clip=spec?.clip??(beat.line?.speaker===id?"talk":"idle");
  const previousClip=prev?.clip??(previous.line?.speaker===id?"talk":"idle");
  const hand=spec?.hand??"right";
  const motion=CharacterController(id,animationState(clip,local,beat.length,hand),
    animationState(previousClip,previous.length-1,previous.length,prev?.hand),local);
  const [x,y]=home(scene,id), [dx,dy]=spec?.offset??[0,0];
  const movement=(clip==="walk"||clip==="run")?1-ease(local/(beat.length*.86)):1;
  const {size,facing}=roles[id];
  const position:Point=[x+movement*dx,y+movement*dy+motion.bob*size];
  const track=(prop:PropId)=>propTrack(scene.beats,prop,frame,scene.initialProps as PropCue[]|undefined);
  let lift:PropId|undefined;
  let liftHand:Hand=hand;
  let target:Point|null=null;
  let grasp=false, tilt=0;
  for (const prop of ["cup","receipt","bowl","phone","bag","food"] as const){
    const {state,previous:last,next}=track(prop);
    const rest=prop==="receipt"?(propAnchor(scene.set,"bowl")??[545,481]):propAnchor(scene.set,prop);
    if(!rest) continue;
    const owning=state?.character===id && (state.state==="held"||state.state==="drinking");
    const approaching=next?.character===id && next.state==="held" && next.frame-frame<=18 && !owning;
    if(!owning&&!approaching) continue;
    liftHand=(owning?state?.hand:next?.hand)??hand;
    const localTable:Point=[(rest[0]-position[0])/(size*facing),(rest[1]-position[1])/size];
    const tableHand=constrainHand(motion,liftHand,null).anchor;
    const lastPickup=state?.state==="held"&&owning&&last?.state!=="drinking"&&frame-state.frame<14;
    const toTable=next?.state==="on-table"?ease((18-(next.frame-frame))/18):0;
    const liftX=liftHand==="right"?79:-62, drinkX=liftHand==="right"?45:-42;
    const inMouth=prop==="receipt"&&owning&&clip==="eat";
    const drinking=state?.state==="drinking"&&owning?ease((frame-state.frame)/12):0;
    const fromDrink=state?.state==="held"&&owning&&last?.state==="drinking"
      ?1-ease((frame-state.frame)/12):0;
    const sip=inMouth?.85:Math.max(drinking,fromDrink);
    const pickup=lastPickup?ease((frame-state.frame)/14):owning?1:0;
    const grip:Point=[mix(liftX,drinkX,sip),mix(-117,-145,sip)];
    const toward=approaching?ease((18-(next!.frame-frame))/18):1;
    const p:Point=[mix(localTable[0],grip[0],pickup*(1-toTable)),mix(localTable[1],grip[1],pickup*(1-toTable))];
    target=[mix(tableHand[0],p[0],toward),mix(tableHand[1],p[1],toward)];
    if(owning){lift=prop;grasp=true;tilt=-104*sip*facing;}
    break;
  }
  const {arms,anchor}=constrainHand(motion,liftHand,target);
  let eyeTarget=spec?.eyeTarget??(id==="milo"?"jun":"milo");
  if(clip==="look-left")eyeTarget="camera";
  const targetX=eyeTarget==="camera"?x-facing*60:(propAnchor(scene.set,eyeTarget)?.[0]??x+facing*80);
  const gaze=clamp((targetX-position[0])*facing/135,-1,1);
  const grip:Point=[position[0]+anchor[0]*size*facing,position[1]+anchor[1]*size];
  return {id, position, motion, arms, clip, gaze, grip, lift, liftHand, grasp, tilt, local, facing, size,
    expression:spec?.expression??"neutral", previous:prev?.expression??"neutral",
    view:spec?.view??"three-quarter", viseme:mouthAt(beat.line,id,frame)};
}
type Puppet=ReturnType<typeof animationInputs>;
export const LipSyncController=mouthAt;
export const DialogueController=(beat:TimedBeat,frame:number)=>beat.line&&frame>=beat.line.start&&frame<beat.line.end?beat.line:undefined;

export function CameraController(scene:TimedScene,beat:TimedBeat,frame:number) {
  const id=(beat.target&&scene.cast.includes(beat.target as CharacterId)?beat.target:scene.cast[0]) as CharacterId;
  const [x,y]=home(scene,id);
  const headY=y-190*roles[id].size;
  const p=ease((frame-beat.start)/Math.max(1,beat.length-1));
  const amount=beat.move==="push"?1+p*.075:1;
  const at=(centerX:number,centerY:number,zoom:number)=>{
    const scale=zoom*amount;
    return {scale,x:640-centerX*scale,y:360-centerY*scale};
  };
  const prop=beat.target&&propIds.includes(beat.target as PropId)
    ?propAnchor(scene.set,beat.target)??(beat.target==="sign"?[852,211]:[640,450]):[640,450];
  switch(beat.shot){
    case "insert": case "point-of-view":return at(prop[0],prop[1],beat.target==="bowl"?2.25:2.55);
    case "extreme-close-up":return at(x,headY-7,4.3);
    case "close-up": case "reaction":return at(x+roles[id].facing*43,headY+18,2.85);
    case "over-the-shoulder":return at(x+(id==="milo"?149:-149),headY+39,1.92);
    case "medium": case "shot-reverse-shot":return at(x+roles[id].facing*65,headY+71,1.98);
    case "establishing":return at(640,360,.97);
    default:return at(640,360,1);
  }
}
function Rigs({puppets,frame}:{puppets:Puppet[];frame:number}) {
  return <>{puppets.map(p=><g key={p.id} transform={`translate(${p.position[0]} ${p.position[1]}) scale(${p.size*p.facing} ${p.size})`}>
    <CharacterRig id={p.id} view={p.view} frame={frame} local={p.local} clip={p.clip} motion={p.motion}
      arms={p.arms} hand={p.liftHand} grasp={p.grasp} expression={p.expression} previous={p.previous} gaze={p.gaze}
      viseme={p.viseme} active={p.viseme!=="X"}/>
  </g>)}</>;
}

export function SceneTransition({scene,frame}:{scene:TimedScene;frame:number}){
  if(scene.transition==="cut") return null;
  const opacity=1-Math.min(ease(frame/9),ease((scene.length-1-frame)/9));
  return <AbsoluteFill style={{background:"#283144",opacity,pointerEvents:"none"}}/>;
}

export function AnimationScene({scene}:StageProps){
  const frame=useCurrentFrame();
  const ix=beatAt(scene.beats,frame), beat=scene.beats[ix], previous=scene.beats[Math.max(0,ix-1)];
  const puppets=scene.cast.map(id=>animationInputs(scene,beat,previous,id,frame));
  const camera=CameraController(scene,beat,frame);
  const rawProps=scene.visibleProps??(scene.set==="food-stall"
    ?["door","table","chair","cup","bowl","sign","receipt"]:(setData(scene.set).props as PropId[]));
  const props=rawProps as PropId[];
  const tag=(id:PropId)=>{
    const owner=puppets.find(p=>p.lift===id);
    if(owner)return <InteractiveProp key={id} id={id} set={scene.set} state="held" position={owner.grip} tilt={owner.tilt}/>;
    const {state}=propTrack(scene.beats,id,frame,scene.initialProps as PropCue[]|undefined);
    const elapsed=frame-(state?.frame??-99);
    const transition=ease(elapsed/18);
    const propState=state?.state==="closed"?1-transition:state?.state==="open"?transition:ease(elapsed/36);
    return <InteractiveProp key={id} id={id} set={scene.set} state={state?.state} progress={propState}/>;
  };
  const far=props.filter(id=>["door","window","sign","bag"].includes(id));
  const front=props.filter(id=>!far.includes(id)&&id!=="table"&&id!=="chair");
  const takeBehind=(puppet:Puppet)=>scene.set==="food-stall"&&puppet.id==="jun";
  return <AbsoluteFill style={{background:"#f4d3a0"}}>
    <svg width="100%" height="100%" viewBox="0 0 1280 720" aria-hidden style={{display:"block"}}>
      <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}>
        <EnvironmentLayer set={scene.set} time={scene.time} layer="background"/>
        <EnvironmentLayer set={scene.set} time={scene.time} layer="midground">{far.map(tag)}</EnvironmentLayer>
        <Rigs puppets={puppets.filter(takeBehind)} frame={scene.start+frame}/>
        <EnvironmentLayer set={scene.set} time={scene.time} layer="foreground"/>
        {props.filter(id=>id==="table"||id==="chair").map(tag)}
        <Rigs puppets={puppets.filter(p=>!takeBehind(p))} frame={scene.start+frame}/>
        {front.map(tag)}
        {beat.shot==="over-the-shoulder"&&scene.cast.length>1&&
          <path d={beat.target==="milo"?"M895 557Q975 482 1085 507Q1201 536 1259 669V900H865Z":"M35 907V617Q94 508 258 530L363 681V898Z"}
            fill="#354657" stroke="#263747" strokeWidth="9" opacity=".91"/>}
      </g>
    </svg>
    <SceneTransition scene={scene} frame={frame}/>
  </AbsoluteFill>;
}

export function AudioMixer({path}:{path?:string}) {
  return path?<Audio src={staticFile(path)}/>:null;
}
export function AnimatedEpisode({timeline,mixAudio}:{timeline:Timeline;mixAudio?:string}) {
  return <AbsoluteFill>
    {timeline.scenes.map(scene=><Sequence key={scene.id} from={scene.start} durationInFrames={scene.length} name={scene.id}>
      <AnimationScene scene={{...scene,beats:scene.beats.map(beat=>({...beat,start:beat.start-scene.start,
        line:beat.line&&{...beat.line,start:beat.line.start-scene.start,end:beat.line.end-scene.start,
          mouthCues:beat.line.mouthCues.map(cue=>({...cue,start:cue.start-scene.start,end:cue.end-scene.start}))}}))}}/>
    </Sequence>)}
    <AudioMixer path={mixAudio}/>
  </AbsoluteFill>;
}

export function jointAudit(scene:TimedScene) {
  const active:Record<string,number> = {};
  let maxJump=0, previous:Point|undefined, lastOwner:string|undefined, tracked=0;
  for(let frame=0;frame<scene.length;frame++){
    const i=beatAt(scene.beats,frame), beat=scene.beats[i], prev=scene.beats[Math.max(0,i-1)];
    for(const id of scene.cast){
      const rig=animationInputs(scene,beat,prev,id,frame);
      if(!rig.grip.every(Number.isFinite))throw new Error(`${scene.id} invalid FK ${id} ${frame}`);
      if(rig.viseme!=="X"){
        if(!beat.line||beat.line.speaker!==id)throw new Error(`${scene.id} moving listener mouth`);
        active[id]=(active[id]??0)+1;
      }
      if(rig.lift==="cup"){
        if(previous&&lastOwner===id)maxJump=Math.max(maxJump,Math.hypot(rig.grip[0]-previous[0],rig.grip[1]-previous[1]));
        previous=rig.grip;lastOwner=id;tracked++;
      } else if(lastOwner===id){previous=undefined;lastOwner=undefined;}
    }
  }
  return {active,tracked,maxJump};
}
