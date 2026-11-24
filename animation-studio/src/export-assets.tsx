import {renderToStaticMarkup} from "react-dom/server";
import cast from "../configs/cast.json";
import {CharacterRig,idleMotion,partNames} from "./rig";
import type {CharacterId,View} from "./types";
import {joints} from "./motion.mjs";

const views:View[]=["front","three-quarter","side","back"];
export function exportCharacters(){
  const items=[];
  const files:Record<string,string>={};
  for (const id of Object.keys(cast) as CharacterId[]){
    const profile=cast[id];
    const poses=[];
    for (const view of views){
      const source=<CharacterRig id={id} view={view} frame={0} local={16} clip="idle" motion={idleMotion} arms={idleMotion}
        grasp={false} expression="neutral" previous="neutral" gaze={0} viseme="X"/>;
      const base=`${id}/${view}`;
      const serialize=(layer?:string)=>renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width="300" height="360" viewBox="-150 -312 300 360">
        {layer&&<style>{`[data-layer]:not([data-layer="${layer}"]) { display: none; }`}</style>}
        {source}
      </svg>);
      files[base+"/turnaround.svg"]=serialize()+"\n";
      for(const layer of partNames)files[base+"/"+layer+".svg"]=serialize(layer)+"\n";
      poses.push({view,path:`animation-studio/assets/characters/${id}/${view}/turnaround.svg`,
        layers:Object.fromEntries(partNames.map(part=>[part,`animation-studio/assets/characters/${id}/${view}/${part}.svg`]))});
    }
    items.push({id,...profile,joints,origin:[0,0],parts:partNames,poses,
      hierarchy:{root:["legs","left-shoulder","torso","right-shoulder","head"],
        "left-shoulder":["left-forearm"],"left-forearm":["left-hand"],"right-shoulder":["right-forearm"],
        "right-forearm":["right-hand"],head:["hair","left-eye","right-eye","pupils","eyelids","eyebrows","mouth"]}});
  }
  return {files,manifest:{schemaVersion:1,unit:"SVG pixels",rig:"animation-studio/src/rig.tsx",characters:items}};
}
