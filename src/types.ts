export type VisualType = "surface" | "trench" | "vents" | "brine" | "seep" | "whale" | "abyss" | "abstract";
export type CameraPreset = "ken-burns" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "dolly" | "drift";

export interface Scene {
  sceneId: string;
  chapter?: string;
  portrait?: boolean;
  soundDesign?: {
    mood: string;
    tempo: number;
    cue: string | null;
  };
  sportGraphic?: {
    kind: "score" | "trophy" | "timeline" | "pitch";
    heading: string;
    items: {label: string; value: string}[];
  } | null;
  keywords?: string[];
  title: string;
  kicker: string;
  displayNote: string;
  narration: string;
  visualDescription: string;
  duration: number;
  cameraMovement: CameraPreset;
  transition: "cut" | "fade";
  visualType: VisualType;
  visualDirection: {
    shotType: string;
    cameraAngle: string;
    lighting: string;
    colorPalette: string[];
    composition: string;
    foreground: string;
    midground: string;
    background: string;
    visualAssets: string[];
  };
  image: {path: string; credit: string; license: string; objectPosition: string} | null;
  sourceIds: string[];
  factChecks: {status: "verified" | "needs-verification" | "open-question"; note: string}[];
}

export interface Storyboard {
  title: string;
  topic: string;
  language: "vi";
  sources: {id: string; title: string; url: string}[];
  music: {path: string; credit: string; license: string} | null;
  scenes: Scene[];
}

export interface Caption {
  text: string;
  start: number;
  end: number;
}

export interface SceneTiming {
  durationInFrames: number;
  audio: string | null;
  captions: Caption[];
}

export type DocumentaryProps = {storyboard: Storyboard; timing: SceneTiming[]};
