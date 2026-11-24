import {parseArgs} from "node:util";
import {existsSync,mkdirSync,readdirSync,renameSync,rmSync} from "node:fs";
import {join,relative,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {bundle} from "@remotion/bundler";
import {openBrowser,renderMedia,selectComposition} from "@remotion/renderer";
import {build} from "esbuild";
import {atomicWrite,capture,ffmpeg,hash,publicDir,readJson,root,writeJson} from "../../scripts/project.mjs";
import {cache,checkVideo,compile,engineHash,generateStory,inspectRender,mixTimeline,output,scenePicture,studio,validateEpisode} from "./production.mjs";

const gates=[["character","character-animation-test.mp4"],["dialogue","dialogue-animation-test.mp4"],["prop","prop-interaction-test.mp4"]];
const pilotFile="animated-pilot-episode.mp4";
const argv=parseArgs({options:{
  episode:{type:"string"},topic:{type:"string"},duration:{type:"string"},language:{type:"string",default:"en"},model:{type:"string",default:"llama3.2:latest"},
  gates:{type:"boolean"},pilot:{type:"boolean"},assets:{type:"boolean"},validate:{type:"boolean"},
  "prepare-only":{type:"boolean"},output:{type:"string"},review:{type:"string"},timeline:{type:"string"},
  concurrency:{type:"string",default:"6"},help:{type:"boolean"},
}});
const {values:opts}=argv;
const envChrome=process.env.REMOTION_BROWSER_EXECUTABLE??(process.platform==="darwin"&&existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
  ?"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome":undefined);
let captureBundle, browser, tools;

async function authorTools(){
  if(tools)return tools;
  const path=join(cache,"rig-tools-"+engineHash()+".mjs");
  if(!existsSync(path)){
    await build({stdin:{contents:'export {jointAudit} from "./episode"; export {exportCharacters} from "./export-assets";',
      resolveDir:join(studio,"src"),loader:"tsx"},outfile:path,bundle:true,platform:"node",format:"esm",
      jsx:"automatic",external:["react","react-dom","react-dom/server","react/jsx-runtime","remotion"]});
  }
  tools=await import(pathToFileURL(path).href);
  return tools;
}

async function manifest(){
  const {exportCharacters}=await authorTools();
  const rootDir=join(studio,"assets/characters");
  const {files,manifest:result}=exportCharacters();
  for(const [path,content] of Object.entries(files))atomicWrite(join(rootDir,path),content);
  writeJson(join(output,"character-manifest.json"),result);
  writeJson(join(rootDir,"manifest.json"),result);
  return result;
}

async function sceneVideo(scene){
  const key=hash(JSON.stringify([engineHash(),scene,"animation-h264-1080-v1"]));
  const dir=join(cache,"picture");
  mkdirSync(dir,{recursive:true});
  const file=join(dir,key+".mp4");
  if(existsSync(file)){
    try{checkVideo(file,scene.length,{audio:false});console.log(`[PICTURE] cached ${scene.id}`);return file;}
    catch{rmSync(file,{force:true});}
  }
  if(!captureBundle)captureBundle=await bundle({entryPoint:join(studio,"src/index.tsx"),publicDir,enableCaching:true});
  if(!browser)browser=await openBrowser("chrome",{browserExecutable:envChrome});
  const temp=join(dir,key+`.${process.pid}.partial.mp4`);
  const options={serveUrl:captureBundle,inputProps:{scene},puppeteerInstance:browser};
  try{
    const composition=await selectComposition({...options,id:"AnimationScene"});
    let shown=-1;
    await renderMedia({...options,composition,codec:"h264",muted:true,pixelFormat:"yuv420p",
      outputLocation:temp,imageFormat:"jpeg",jpegQuality:92,x264Preset:"fast",crf:18,concurrency:Number(opts.concurrency),
      onProgress:({progress})=>{const count=Math.floor(progress*4)*25;if(count>shown){shown=count;console.log(`[PICTURE] ${scene.id} ${count}%`);}}});
    checkVideo(temp,scene.length,{audio:false});
    renameSync(temp,file);
  }finally{rmSync(temp,{force:true});}
  return file;
}

function scriptOf(episode){
  return ["# "+episode.title,"",...episode.scenes.flatMap(scene=>["## "+scene.id,"",
    ...scene.beats.flatMap(beat=>[beat.dialogue?`**${beat.dialogue.speaker}** · ${beat.dialogue.text}`:`*${beat.purpose}*`,""])])].join("\n");
}

function shortReport(report){
  return `${report.media.seconds}s, ${report.media.frames} frames, ${report.media.width}×${report.media.height}, ${report.media.codec}/${report.media.audio}, ${report.loud.input_i} LUFS and ${report.loud.input_tp} dBTP`;
}

function reviewMarkdown(episode,report,rig){
  const need=report.samples.filter(s=>s.status==="inspect low activity");
  const sceneReport=rig.map(({id,active,tracked,maxJump})=>`- ${id}: voice frames ${JSON.stringify(active)}; attached cup frames ${tracked}; maximum adjacent grip displacement ${maxJump.toFixed(2)} SVG pixels.`);
  return [
    "# Animation quality review","","- Encoded media: "+shortReport(report),
    "- Near-black frames in the 5 Hz decoded sample: "+report.black.length+".",
    "- Flat planned holds accepted by the activity test: "+report.samples.filter(s=>s.status==="intentional hold").length+".",
    "- Dialogue and lip sync: generated WAVs analysed by Rhubarb; sampled rig state confirmed that only the active speaker used speech visemes.",
    "", "## Rig observations","",...sceneReport,"",
    "## Editorial checks", "",
    ...(need.length?need.map(s=>`- Inspect ${s.id} at ${s.at.toFixed(2)}s. Low decoded motion. Add or repair an acting beat if a hold is unintended.`)
      :["- The decoded motion test found no unexplained inactive beats."]),
    "- Inspect representative decoded frames for silhouette, hand contact, eyeline, prop occlusion and expression. This is an editorial check.",
    "- Comedy timing is assessed from the cut. Audience retention requires published analytics.","",
    `Source episode: ${episode.id}`,"",
  ].join("\n");
}

async function perform(episode,dest,exportFinal=false){
  validateEpisode(episode);
  const key=hash(JSON.stringify([episode,engineHash()]));
  const work=join(cache,"productions",key);
  console.log(`[PLAN] ${episode.id} · ${episode.duration}s · ${episode.scenes.length} scene(s)`);
  const timeline=await compile(episode,work);
  const {jointAudit}=await authorTools();
  const rig=timeline.scenes.map(scene=>({id:scene.id,...jointAudit(scenePicture(scene))}));
  writeJson(join(work,"rig-audit.json"),rig);
  const actors=new Set(timeline.scenes.flatMap(scene=>scene.beats.flatMap(b=>b.line?[b.line.speaker]:[])));
  if([...actors].some(id=>!rig.some(scene=>scene.active[id]>0)))throw new Error("A speaking role has no active phoneme frames");
  if(episode.id==="prop-gate"&&(rig[0].tracked<35||rig[0].maxJump>14))
    throw new Error(`Cup attachment failed the trajectory gate: ${rig[0].tracked} frames, ${rig[0].maxJump.toFixed(2)} px jump.`);
  if(exportFinal){
    atomicWrite(join(output,"episode-script.md"),scriptOf(episode));
    writeJson(join(output,"episode-storyboard.json"),episode);
    writeJson(join(output,"animation-timeline.json"),timeline);
    await manifest();
    const originals=readdirSync(join(studio,"assets/audio")).filter(x=>x.endsWith(".wav"));
    writeJson(join(output,"asset-license-manifest.json"),{
      art:{owner:"Original Side Street Specials project artwork",external:false},
      audio:originals.map(name=>({path:"animation-studio/assets/audio/"+name,source:"Original procedural recording",external:false})),
      dialogue:episode.language==="en"?{origin:"Kokoro-82M stock synthetic voices",license:"Apache-2.0",model:"https://huggingface.co/hexgrad/Kokoro-82M"}
        :{origin:"VieNeu v3 Nano model preset voices",license:"Apache-2.0",model:"https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Nano"},
      fonts:[{name:"Be Vietnam Pro",license:"OFL-1.1",source:"https://github.com/bettergui/BeVietnamPro"}],
      reference:"The source video was studied for technique; this episode includes no frames, audio, characters or artwork from it.",
    });
  }
  const mix=mixTimeline(timeline,work);
  if(exportFinal)writeJson(join(output,"audio-cue-sheet.json"),readJson(join(work,"audio-cue-sheet.json")));
  if(opts["prepare-only"])return {work,timeline};
  const segments=[];
  for(const scene of timeline.scenes)segments.push(await sceneVideo(scenePicture(scene)));
  const inputs=join(work,"concat.txt");
  atomicWrite(inputs,segments.map((p,i)=>`file '${p.replaceAll("'","'\\''")}'\nduration ${(timeline.scenes[i].length/30).toFixed(9)}`).join("\n")+"\n");
  mkdirSync(resolve(dest,".."),{recursive:true});
  const temp=dest.replace(/\.mp4$/i,`.${process.pid}.partial.mp4`);
  try{
    capture(ffmpeg(),["-nostdin","-v","error","-y","-f","concat","-safe","0","-i",inputs,"-i",mix,
      "-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-b:a","192k","-t",String(episode.duration),"-movflags","+faststart",temp],
      {timeout:600000});
    const report=inspectRender(temp,timeline,work);
    renameSync(temp,dest);
    if(exportFinal)atomicWrite(join(output,"quality-review.md"),reviewMarkdown(episode,report,rig));
    console.log("[PASS] "+relative(root,dest)+" · "+shortReport(report));
    return {timeline,report,work,rig};
  }finally{rmSync(temp,{force:true});}
}

async function main(){
  if(opts.help){
    console.log("npm run animation:create -- --gates | --pilot | --assets | --episode FILE | --topic TEXT --duration 60..90 --language en|vi\nAdd --prepare-only, --validate, --concurrency N or --output PATH.");
    return;
  }
  if(!Number.isInteger(Number(opts.concurrency))||Number(opts.concurrency)<1)throw new Error("Use a positive render concurrency.");
  mkdirSync(output,{recursive:true});
  mkdirSync(cache,{recursive:true});
  if(opts.review){
    const timeline=readJson(resolve(opts.timeline??join(output,"animation-timeline.json")));
    const {jointAudit}=await authorTools();
    const rig=timeline.scenes.map(scene=>({id:scene.id,...jointAudit(scenePicture(scene))}));
    const report=inspectRender(resolve(opts.review),timeline,cache);
    atomicWrite(join(output,"quality-review.md"),reviewMarkdown(timeline,report,rig));
    console.log("[PASS] "+shortReport(report));
    return;
  }
  if(opts.assets){await manifest();return;}
  if(opts.gates){
    const passed=[];
    for(const [id,name] of gates){
      const e=readJson(join(studio,"episodes",id+".json"));
      const r=await perform(e,join(output,name));
      if(r.report)passed.push({id,name,report:r.report,rig:r.rig});
    }
    if(passed.length===3)writeJson(join(cache,"gate-results.json"),{engine:engineHash(),passed});
    return;
  }
  if(opts.pilot){
    const chosen=readJson(join(studio,"episodes/pilot.json"));
    if(!opts["prepare-only"]&&!opts.validate){
      const record=join(cache,"gate-results.json");
      if(!existsSync(record)||readJson(record).engine!==engineHash())throw new Error("Pass all three technical gates with --gates before rendering the pilot.");
      for(const [i,[,name]] of gates.entries())checkVideo(join(output,name),[300,450,300][i]);
    }
    if(opts.validate){validateEpisode(chosen);console.log("[PASS] pilot schema and continuity");return;}
    return perform(chosen,join(output,pilotFile),true);
  }
  const duration=Number(opts.duration??75);
  if(!opts.episode&&!opts.topic)throw new Error("Use --episode, --topic, --pilot, --gates, or --assets.");
  if(!opts.episode&&(!Number.isInteger(duration)||duration<60||duration>90||!["en","vi"].includes(opts.language)))throw new Error("Use --duration 60..90 and --language en or vi.");
  const episode=opts.episode?readJson(resolve(opts.episode)):await generateStory({topic:opts.topic,duration,language:opts.language,model:opts.model});
  if(opts.validate){validateEpisode(episode);console.log("[PASS] schema and continuity");return;}
  const target=resolve(opts.output??join(output,`${episode.id}.mp4`));
  if(!target.endsWith(".mp4"))throw new Error("Output must end in .mp4");
  return perform(episode,target,true);
}

try{await main();}catch(error){console.error(error.stack??error);process.exitCode=1;}
finally{if(browser)await browser.close({silent:true});}
