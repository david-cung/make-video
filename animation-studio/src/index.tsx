import "@fontsource/be-vietnam-pro/700.css";
import {Composition, registerRoot} from "remotion";
import {AnimatedEpisode, AnimationScene} from "./episode";
import type {StageProps, Timeline} from "./types";
const scene:StageProps["scene"] = {
  id:"preview",set:"food-stall",cast:["milo","jun"],time:"day",transition:"cut",music:"light",start:0,length:120,
  beats:[{id:"settle",purpose:"Studio default view",seconds:4,shot:"wide",start:0,length:120}],
};
const base={width:1920,height:1080,fps:30};
const timeline:Timeline={id:"preview",title:"Side Street Specials",topic:"Studio default",language:"en",duration:4,frames:120,fps:30,scenes:[scene]};
function Root(){
  return <>
    <Composition id="AnimationScene" component={AnimationScene} defaultProps={{scene}} durationInFrames={120} {...base}
      calculateMetadata={({props})=>({durationInFrames:props.scene.length})}/>
    <Composition id="AnimatedEpisode" component={AnimatedEpisode} defaultProps={{timeline}} durationInFrames={120} {...base}
      calculateMetadata={({props})=>({durationInFrames:props.timeline.frames})}/>
  </>;
}
registerRoot(Root);
