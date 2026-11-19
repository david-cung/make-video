import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/playfair-display/600.css";
import {Composition, registerRoot} from "remotion";
import sample from "../storyboards/ocean.json";
import {Documentary} from "./documentary";
import {COMPOSITION, FPS, HEIGHT, WIDTH, silentTiming} from "./timeline.mjs";
import type {DocumentaryProps, Storyboard} from "./types";

const storyboard = sample as Storyboard;
const defaultProps: DocumentaryProps = {storyboard, timing: silentTiming(storyboard)};

function Root() {
  return <Composition id={COMPOSITION} component={Documentary} width={WIDTH} height={HEIGHT} fps={FPS}
    durationInFrames={2250} defaultProps={defaultProps} calculateMetadata={({props}) => {
      if (props.storyboard.scenes.length !== props.timing.length) {
        throw new Error("Scene list and timing list differ in length.");
      }
      return {durationInFrames: props.timing.reduce((sum, scene) => sum + scene.durationInFrames, 0)};
    }} />;
}

registerRoot(Root);
