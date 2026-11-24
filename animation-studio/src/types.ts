export type CharacterId = "milo" | "jun";
export type Language = "en" | "vi";
export type View = "front" | "three-quarter" | "side" | "back";
export type Point = [number, number];
export type Hand = "left" | "right";
export type Viseme = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "X";
export type Expression = "neutral" | "happy" | "angry" | "confused" | "suspicious" | "shocked" | "sad"
  | "annoyed" | "embarrassed" | "excited" | "smug" | "deadpan";
export type Clip = "idle" | "breathing" | "blink" | "look-left" | "look-right" | "nod" | "shake-head" | "talk"
  | "point" | "wave" | "shrug" | "walk" | "run" | "sit" | "stand-up" | "grab" | "hold" | "eat" | "drink"
  | "surprise" | "anger" | "laugh" | "embarrassment";
export type ShotKind = "establishing" | "wide" | "medium" | "close-up" | "extreme-close-up"
  | "over-the-shoulder" | "point-of-view" | "reaction" | "shot-reverse-shot" | "insert";
export type PropId = "door" | "window" | "table" | "chair" | "bowl" | "cup" | "phone" | "bag" | "food" | "sign" | "receipt";
export type Effect = "door" | "footstep" | "place" | "sip" | "eat" | "cloth" | "notify" | "printer" | "accent" | "transition";
export type Mood = "light" | "awkward" | "suspense" | "playful" | "tender" | "silence";
export type Pose = {
  clip?: Clip; expression?: Expression; eyeTarget?: CharacterId | PropId | "camera";
  offset?: Point; view?: View; hand?: Hand;
};
export type PropCue = {
  prop: PropId; at: number; state: "on-table" | "held" | "drinking" | "open" | "closed" | "printing" | "unspooled";
  character?: CharacterId; hand?: Hand;
};
export type Beat = {
  id: string; seconds: number; purpose: string; shot: ShotKind; target?: CharacterId | PropId;
  move?: "still" | "push"; deliberateHold?: boolean; mood?: Mood;
  dialogue?: {speaker: CharacterId; text: string; rate?: number; delivery?: string};
  poses?: Partial<Record<CharacterId, Pose>>;
  props?: PropCue[];
  effects?: {at: number; name: Effect; gain?: number}[];
};
export type Scene = {
  id: string; set: string; time: "day" | "night"; cast: CharacterId[]; transition: "cut" | "dip";
  music: Mood; beats: Beat[]; visibleProps?: PropId[];
};
export type Episode = {id: string; title: string; topic: string; language: Language; duration: number; scenes: Scene[]};
export type MouthCue = {start: number; end: number; value: Viseme};
export type Line = {speaker: CharacterId; text: string; start: number; end: number; audioFile: string; lipSyncFile: string; mouthCues: MouthCue[]};
export type TimedBeat = Beat & {start: number; length: number; line?: Line};
export type TimedScene = Omit<Scene, "beats"> & {start: number; length: number; beats: TimedBeat[]; initialProps?: PropCue[]};
export type Timeline = Omit<Episode, "scenes"> & {frames: number; fps: 30; scenes: TimedScene[]};
export type StageProps = {scene: TimedScene; mixAudio?: string};
