import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import {Composition, registerRoot} from "remotion";
import sample from "../storyboards/titanic-sample.json";
import {TitanicHook} from "./titanic-hook";
import type {HookProps} from "./titanic-hook";
import type {Scene} from "./types";

const defaultProps: HookProps = {
  scenes: [{id: "reveal", startFrame: 0, durationInFrames: 900, captions: []}],
  floodScene: sample.scenes[0] as Scene,
};

function Root() {
  return <Composition id="TitanicHook" component={TitanicHook} durationInFrames={900} width={1920} height={1080} fps={30}
    defaultProps={defaultProps} />;
}

registerRoot(Root);
