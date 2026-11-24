import Ajv from "ajv";
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,rmSync,statSync} from "node:fs";
import {join,relative,resolve} from "node:path";
import {atomicWrite,audioDuration,capture,command,ffmpeg,hash,probe,publicDir,readJson,root,writeJson} from "../../scripts/project.mjs";
import {buildDocumentaryMix,measureLoudness} from "../../scripts/documentary-audio.mjs";
import {characters,episodeSchema,fps,props} from "../src/contracts.mjs";

export const studio=join(root,"animation-studio"), cache=join(root,".cache","animation");
export const output=join(root,"output");
const voiceDir=join(publicDir,"animation-runs","voice");
export const sets=readJson(join(studio,"configs/sets.json")), cast=readJson(join(studio,"configs/cast.json"));
export const python=process.env.KOKORO_PYTHON??join(root,".venv",process.platform==="win32"?"Scripts/python.exe":"bin/python");
const validator=new Ajv({allErrors:true,strict:true}).compile(episodeSchema);
const known=new Set(props);
const armable=new Set(["bowl","cup","phone","bag","food","receipt"]);
const seconds=frames=>frames/fps;

export function validateEpisode(episode) {
  if(!validator(episode))throw new Error("Episode schema: "+new Ajv().errorsText(validator.errors,{separator:"; "}));
  const used=new Set(), consumed=new Set();
  for(const scene of episode.scenes){
    if(used.has(scene.id))throw new Error(`Duplicate scene: ${scene.id}`);
    used.add(scene.id);
    const set=Object.hasOwn(sets,scene.set)&&sets[scene.set];
    if(!set)throw new Error(`Unknown set ${scene.set}`);
    const present=new Set(scene.cast);
    if(present.size!==scene.cast.length)throw new Error(`Duplicate cast in ${scene.id}`);
    const supported=new Set(scene.visibleProps??(scene.set==="food-stall"?["door","table","chair","cup","bowl","sign","receipt"]:set.props));
    for(const id of supported)if(!set.props.includes(id))throw new Error(`${id} has no placement in ${scene.set}`);
    const holdings=new Map();
    for(const beat of scene.beats){
      const fail=message=>{throw new Error(`${scene.id}/${beat.id}: ${message}`);};
      if(consumed.has(beat.id))fail("Beat ID already used");
      consumed.add(beat.id);
      if(beat.dialogue && !present.has(beat.dialogue.speaker))fail("Speaker absent");
      if(beat.target && !(present.has(beat.target)||supported.has(beat.target)))fail("Camera target absent");
      for(const [id,pose] of Object.entries(beat.poses??{})){
        if(!present.has(id))fail(`Pose for absent character ${id}`);
        if(pose.eyeTarget && pose.eyeTarget!=="camera" && !present.has(pose.eyeTarget) && !supported.has(pose.eyeTarget))
          fail(`Missing eye target ${pose.eyeTarget}`);
      }
      const timestamps=new Set();
      for(const cue of [...(beat.props??[])].sort((a,b)=>a.at-b.at)){
        if(cue.at>=beat.seconds)fail("Prop cue must fall inside its beat");
        if(!known.has(cue.prop)||!supported.has(cue.prop))fail(`Prop ${cue.prop} is unavailable`);
        const key=cue.prop+":"+cue.at;
        if(timestamps.has(key))fail("Two states for a prop at the same time");
        timestamps.add(key);
        if(cue.character&&!present.has(cue.character))fail("Prop owner absent");
        if(cue.state==="held"||cue.state==="drinking"){
          if(!armable.has(cue.prop)||!cue.character)fail("This interaction needs a movable prop and visible character");
          const slot=cue.character+":"+(cue.hand??"right");
          if([...holdings].some(([prop,owner])=>prop!==cue.prop&&owner===slot))fail("Two props competing for one hand");
          if(cue.state==="drinking"&&holdings.get(cue.prop)!==slot)fail("A cup must be held before drinking");
          holdings.set(cue.prop,slot);
        }else holdings.delete(cue.prop);
      }
      for(const cue of beat.effects??[])if(cue.at>=beat.seconds)fail("Foley cue must fall inside its beat");
    }
    if(holdings.has("cup"))throw new Error(`${scene.id}: put the cup down or specify owned props in the next scene instead of cutting it loose.`);
  }
  return episode;
}

async function prepareVoices(episode,work){
  const files=episode.language==="en"?["kokoro-v1.0.onnx","voices-v1.0.bin"]:[];
  const modelDir=resolve(process.env.KOKORO_MODEL_DIR??join(root,".cache/kokoro"));
  const identity=files.map(name=>{
    const p=join(modelDir,name), stat=statSync(p,{throwIfNoEntry:false});
    if(!stat?.isFile())throw new Error(`Install Kokoro weights first: ${p}`);
    return [stat.size,stat.mtimeMs];
  });
  const adapter=episode.language==="en"?"kokoro":"vieneu";
  const jobs=new Map(), lines=new Map();
  const adapterSource=readFileSync(join(studio,"scripts/voices.py"),"utf8");
  for(const scene of episode.scenes)for(const beat of scene.beats){
    if(!beat.dialogue)continue;
    const {speaker,text,rate}=beat.dialogue, voice=cast[speaker].voices[episode.language];
    let speech=text;
    for(const [term,pronunciation] of Object.entries(voice.pronunciation))speech=speech.replaceAll(term,pronunciation);
    const job={speech,voice:voice.voice,locale:voice.locale,rate:rate??voice.rate};
    const key=hash(JSON.stringify([job,adapter,identity,adapterSource]));
    const path=join(voiceDir,key+".wav");
    jobs.set(key,{...job,path,ffmpeg:ffmpeg()});
    lines.set(beat.id,{key,speaker,text,path});
  }
  const pending=[...jobs.values()].filter(({path})=>{
    if(!existsSync(path))return true;
    try{return audioDuration(path)<.12;}catch{return true;}
  });
  if(pending.length){
    const executable=adapter==="kokoro"?python:process.env.ANIMATION_VI_PYTHON??join(root,".cache/animation-vi/bin/python");
    if(!existsSync(executable)&&executable.includes("/"))throw new Error(`Missing ${adapter} interpreter: ${executable}`);
    const file=join(work,`tts-${process.pid}.json`);
    writeJson(file,pending);
    try{
      console.log(`[VOICE] ${pending.length} uncached ${adapter} dialogue lines`);
      await command(executable,[join(studio,"scripts/voices.py"),file,"--adapter",adapter,"--model-dir",modelDir],{
        env:{...process.env,PYTHONUTF8:"1",HF_HOME:process.env.HF_HOME??join(root,".cache/huggingface-vieneu")},
      });
    }finally{rmSync(file,{force:true});}
  }
  return lines;
}

export function alignLine(line,language,work){
  const binary=process.env.RHUBARB_BIN??(process.platform==="darwin"&&existsSync(join(root,".cache/animation-tools/Rhubarb-Lip-Sync-1.14.0-macOS/rhubarb"))
    ?join(root,".cache/animation-tools/Rhubarb-Lip-Sync-1.14.0-macOS/rhubarb"):"rhubarb");
  let version;
  try{version=capture(binary,["--version"]).stdout.trim();}
  catch(error){throw new Error("Rhubarb is required. Install it or set RHUBARB_BIN. No synthetic mouth timing will be substituted.",{cause:error});}
  const alignmentKey=hash(JSON.stringify([line.key,line.text,version,language,statSync(line.path).size]));
  const rawPath=join(voiceDir,alignmentKey+".json");
  if(!existsSync(rawPath)){
    const input=join(work,`${alignmentKey}.txt`);
    const temporary=join(work,`${alignmentKey}-${process.pid}.json`);
    atomicWrite(input,line.text+"\n");
    const recognizer=language==="en"?"pocketSphinx":"phonetic";
    try{
      const args=["-q","--threads","2","-r",recognizer,"-f","json","-o",temporary];
      if(language==="en")args.push("-d",input);
      capture(binary,[...args,line.path],{timeout:90000});
      const data=readJson(temporary);
      if(!Array.isArray(data.mouthCues))throw new Error("Rhubarb returned no cue array");
      renameSync(temporary,rawPath);
    }finally{rmSync(temporary,{force:true});rmSync(input,{force:true});}
  }
  return {rawPath,cues:readJson(rawPath).mouthCues,duration:audioDuration(line.path),version};
}

export async function compile(episode,work){
  validateEpisode(episode);
  mkdirSync(work,{recursive:true});
  const source=await prepareVoices(episode,work);
  const marked=new Map();
  const rel=p=>relative(publicDir,p).split("\\").join("/");
  for(const [id,line] of source){
    const aligned=alignLine(line,episode.language,work);
    const span=Math.ceil(aligned.duration*fps);
    let prior=0;
    const mouthCues=aligned.cues.flatMap(({start,end,value})=>{
      if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||start<prior-.011||end<start||
         !/^[A-HX]$/.test(value)||end>aligned.duration+.09)throw new Error(`Invalid Rhubarb data on ${id}`);
      prior=end;
      const a=Math.min(span,Math.round(start*fps)),b=Math.min(span,Math.round(end*fps));
      return b>a?[{start:a,end:b,value}]:[];
    });
    const active=mouthCues.filter(cue=>cue.value!=="X");
    if(new Set(active.map(cue=>cue.value)).size<2)throw new Error(`The recognizer found too little speech on ${id}`);
    marked.set(id,{speaker:line.speaker,text:line.text,span,mouthCues,
      audioFile:rel(line.path),lipSyncFile:rel(aligned.rawPath),backend:aligned.version});
  }
  const beats=episode.scenes.flatMap(scene=>scene.beats);
  const minima=beats.map(beat=>Math.max(Math.round(beat.seconds*fps),(marked.get(beat.id)?.span??0)+14));
  const target=episode.duration*fps, used=minima.reduce((s,n)=>s+n,0);
  if(used>target)throw new Error(`Measured dialogue and authored holds need ${seconds(used).toFixed(2)}s, beyond ${episode.duration}s. Edit the lines or beat lengths.`);
  const elastic=beats.map(b=>b.deliberateHold?1.8:b.dialogue?1.0:.5);
  const denominator=elastic.reduce((s,n)=>s+n,0);
  let count=0,padding=0,frame=0,index=0,previousSet="",previousTime="";
  const state=new Map();
  const timeline={...episode,frames:target,fps,scenes:episode.scenes.map(scene=>{
    const start=frame;
    if(previousSet!==scene.set||previousTime!==scene.time)state.clear();
    const initialProps=[...state.values()];
    const compiled=scene.beats.map(beat=>{
      count+=elastic[index];
      const extra=Math.round(count/denominator*(target-used));
      const length=minima[index++]+extra-padding;
      padding=extra;
      const start=frame;
      frame+=length;
      const data=marked.get(beat.id), offset=start+6;
      const line=data&&{speaker:data.speaker,text:data.text,start:offset,end:offset+data.span,
        audioFile:data.audioFile,lipSyncFile:data.lipSyncFile,
        mouthCues:data.mouthCues.map(cue=>({...cue,start:offset+cue.start,end:offset+cue.end})),
        backend:data.backend};
      for(const cue of [...(beat.props??[])].sort((a,b)=>a.at-b.at))state.set(cue.prop,cue);
      return {...beat,start,length,...(line?{line}:{})};
    });
    previousSet=scene.set;previousTime=scene.time;
    return {...scene,start,length:frame-start,beats:compiled,initialProps};
  })};
  if(frame!==target)throw new Error("Timeline allocation did not preserve the frame budget.");
  writeJson(join(work,"timeline.json"),timeline);
  return timeline;
}

export function cuesFor(timeline){
  const narration=[],music=[],effects=[],ambience=[],windows=[];
  const audio=name=>join(studio,"assets/audio",name+".wav");
  const place=(path,start,duration,gainDb=0,loop=false)=>({path,start,duration,gainDb,loop,
    fadeIn:Math.min(.16,duration/5),fadeOut:Math.min(.23,duration/5)});
  for(const scene of timeline.scenes){
    let score;
    ambience.push(place(audio("room"),seconds(scene.start),seconds(scene.length),-18,true));
    for(const beat of scene.beats){
      const at=seconds(beat.start), len=seconds(beat.length), mood=beat.mood??scene.music;
      if(mood!=="silence"){
        const bed=audio("score-"+mood);
        if(score?.path===bed&&Math.abs(score.start+score.duration-at)<.001)score.duration+=len;
        else{score=place(bed,at,len,-10,true);music.push(score);}
      }else score=undefined;
      if(beat.line){
        const {audioFile,start,end}=beat.line;
        const duration=audioDuration(join(publicDir,audioFile));
        narration.push({path:join(publicDir,audioFile),start:seconds(start),duration,gainDb:0,fadeIn:.007,fadeOut:.013});
        windows.push({start:seconds(start),end:seconds(end)});
      }
      for(const cue of beat.effects??[]){
        const t=at+seconds(Math.round(cue.at*fps));
        const file=audio(cue.name), duration=Math.min(audioDuration(file),seconds(timeline.frames)-t);
        effects.push({...place(file,t,duration,cue.gain??-6),fadeIn:0,fadeOut:Math.min(.08,duration/8)});
      }
    }
  }
  return {narration,music,effects,ambience,windows};
}

export function mixTimeline(timeline,work){
  const data=cuesFor(timeline);
  const result=buildDocumentaryMix({...data,duration:seconds(timeline.frames),workDir:work,effectsDuckDb:-4,tailFade:.15});
  const printable=groups=>Object.fromEntries(Object.entries(groups).map(([name,arr])=>
    [name,arr.map(x=>x.path?{...x,path:relative(root,x.path)}:x)]));
  const sheet={episode:timeline.id,fps,cues:printable(data),
    stems:Object.fromEntries(Object.entries(result.stems).map(([name,file])=>[name,relative(root,file)])),loudness:result.loudness};
  writeJson(join(work,"audio-cue-sheet.json"),sheet);
  return result.output;
}

export async function generateStory({topic,duration,language,model}) {
  const settings={topic,duration,language,model,writer:"exchanges-v2"};
  const file=join(cache,"stories",hash(JSON.stringify(settings))+".json");
  if(existsSync(file))return validateEpisode(readJson(file));
  const string=(min,max)=>({type:"string",minLength:min,maxLength:max});
  const object=properties=>({type:"object",additionalProperties:false,properties,required:Object.keys(properties)});
  const exchange=object({milo:string(4,105),jun:string(3,105)});
  const format=object({
    title:string(5,130),set:{type:"string",enum:Object.keys(sets)},night:{type:"boolean"},
    opening:exchange, escalation:{type:"array",minItems:3,maxItems:5,items:exchange}, reversal:exchange,
    payoff:exchange, finalGesture:{type:"string",enum:["shrug","blink","shake-head","nod","laugh","surprise"]},
    finalExpression:{type:"string",enum:["deadpan","shocked","smug","embarrassed","happy"]},
  });
  const instruction=`Write an original short SIDE STREET SPECIALS animated comedy about the requested topic.
Use the requested English or Vietnamese language. Milo is a methodical neighbour; Jun sells things with cheerful deadpan logic.
Both characters SPEAK in every exchange. Values for milo and jun are spoken dialogue, not directions.
Begin with the situation immediately. Use each escalation to change the stakes. Let a final body gesture strengthen the visual punchline.
Dialogue is concise, no filler, typically 5–9 words per line. No narrator, no quotes around the lines. Reply with the required JSON.
Available sets: ${Object.keys(sets).join(", ")}.`;
  const response=await fetch("http://127.0.0.1:11434/api/chat",{
    method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(300000),
    body:JSON.stringify({model,stream:false,think:false,format,options:{temperature:.35,num_predict:3000},
      messages:[{role:"system",content:instruction},{role:"user",content:JSON.stringify(settings)}]})
  }).catch(error=>{throw new Error("Local Ollama connection failed. Start your local server or supply --episode.",{cause:error});});
  if(!response.ok)throw new Error(`Local Ollama request failed: HTTP ${response.status}`);
  const raw=JSON.parse((await response.json()).message.content);
  const check=new Ajv({allErrors:true}).compile(format);
  if(!check(raw))throw new Error("The local model returned an incomplete dialogue draft: "+new Ajv().errorsText(check.errors));
  let beatNo=0;
  const beatId=()=>`beat-${++beatNo}`;
  const reaction=(id,expression,gesture="blink")=>({
    id:beatId(),seconds:2.4,purpose:"Silent visual reaction",shot:"reaction",target:id,deliberateHold:true,
    mood:"silence",poses:{[id]:{clip:gesture,expression,eyeTarget:id==="milo"?"jun":"milo"}},
  });
  const lines=(section,pair,index)=>characters.map((speaker,i)=>{
    const other=characters[1-i],text=pair[speaker].trim();
    return {id:beatId(),seconds:Math.min(3.8,Math.max(1.6,text.split(/\s+/).length/3+.4)),purpose:section,
      shot:i?"shot-reverse-shot":index%2?"close-up":"over-the-shoulder",target:speaker,dialogue:{speaker,text},
      poses:{[speaker]:{clip:i?"nod":index%2?"shrug":"talk",expression:i?"smug":index%2?"confused":"neutral",eyeTarget:other},
        [other]:{clip:"idle",expression:i?"suspicious":"happy",eyeTarget:speaker}}};
  });
  const scene=(id,beats,music)=>({id,set:raw.set,time:raw.night?"night":"day",cast:[...characters],transition:"cut",music,beats});
  const draft={id:"episode-"+hash(JSON.stringify(settings)).slice(0,8),title:raw.title,topic,duration,language,scenes:[
    scene("setup",[{id:beatId(),seconds:1.35,purpose:"Establish place and screen direction",shot:"wide"},
      ...lines("Introduce the dispute",raw.opening,0)],"light"),
    scene("escalation",raw.escalation.flatMap((pair,i)=>[...lines("Complicate the dispute",pair,i),
      ...(i%2===1?[reaction("milo","suspicious")]:[])]),"awkward"),
    scene("payoff",[...lines("Turn the situation around",raw.reversal,1),reaction("jun","shocked"),
      ...lines("Deliver the callback",raw.payoff,2),reaction("milo",raw.finalExpression,raw.finalGesture)],"playful"),
  ]};
  validateEpisode(draft);
  writeJson(file,draft);
  return draft;
}

export function scenePicture(scene){
  return {...scene,start:scene.start,beats:scene.beats.map(beat=>({...beat,
    start:beat.start-scene.start,line:beat.line&&{...beat.line,
      start:beat.line.start-scene.start,end:beat.line.end-scene.start,
      mouthCues:beat.line.mouthCues.map(cue=>({...cue,start:cue.start-scene.start,end:cue.end-scene.start})),
    }}))};
}

export function engineHash(){
  const files=["src","configs"].flatMap(folder=>readdirSync(join(studio,folder)).sort().map(file=>join(studio,folder,file)));
  return hash(files.filter(p=>statSync(p).isFile()).map(p=>readFileSync(p,"utf8")).join("\n"));
}

export function checkVideo(path,frames,{audio=true}={}){
  const meta=probe(path);
  const video=meta.streams.find(x=>x.codec_type==="video"), sound=meta.streams.find(x=>x.codec_type==="audio");
  if(!video||video.width!==1920||video.height!==1080||video.codec_name!=="h264"||
     video.avg_frame_rate!=="30/1"||Number(video.nb_frames)!==frames||
     Math.abs(Number(meta.format.duration)-seconds(frames))>.035||
     (audio&&(sound?.codec_name!=="aac"||Math.abs(Number(sound.duration)-seconds(frames))>.035)))
    throw new Error(`Unexpected media stream: ${path}`);
  return {width:video.width,height:video.height,fps:30,frames,seconds:seconds(frames),audio:sound?.codec_name??null,codec:video.codec_name};
}

export function inspectRender(path,timeline,work){
  const media=checkVideo(path,timeline.frames);
  const loud=measureLoudness(path);
  if(!Number.isFinite(Number(loud.input_i))||Number(loud.input_tp)>-.8)throw new Error("Encoded audio peak or loudness failed.");
  const samples=[];
  // Decode once at 5 Hz. Compare frames inside each editorial beat to flag frozen shots.
  const w=96,h=54,pixels=w*h;
  const {stdout:frames}=capture(ffmpeg(),["-v","error","-i",path,"-an","-vf",`fps=5,scale=${w}:${h},format=gray`,
    "-c:v","rawvideo","-threads:v","1","-f","rawvideo","pipe:1"],{encoding:null,maxBuffer:21_000_000});
  const available=Math.floor(frames.length/pixels);
  if(available<Math.floor(timeline.frames/6)-1)throw new Error("Incomplete picture decode");
  const black=[];
  for(let i=0;i<available;i++){
    const offset=i*pixels;
    let bright=0;
    for(let p=0;p<pixels;p++)if(frames[offset+p]>15)bright++;
    if(bright<pixels*.025)black.push(i/5);
  }
  if(black.length) throw new Error(`Near-black frames at ${black.join(", ")}`);
  for(const scene of timeline.scenes)for(const beat of scene.beats){
    const first=Math.ceil((beat.start+4)/6),last=Math.min(available-1,Math.floor((beat.start+beat.length-5)/6));
    let activity=0;
    for(let i=first+1;i<=last;i++){
      let sum=0;
      for(let p=0;p<pixels;p++)sum+=Math.abs(frames[i*pixels+p]-frames[(i-1)*pixels+p]);
      activity=Math.max(activity,sum/pixels);
    }
    const status=activity>=.023?"active":beat.deliberateHold?"intentional hold":"inspect low activity";
    samples.push({id:beat.id,at:seconds(beat.start),shot:beat.shot,activity:Number(activity.toFixed(5)),status});
  }
  const report={media,loud,black,samples};
  writeJson(join(work,"review.json"),report);
  return report;
}
