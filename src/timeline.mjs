export const FPS = 30;
export const MIN_DOCUMENTARY_SECONDS = 20;
export const MAX_DOCUMENTARY_SECONDS = 600;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const COMPOSITION = "Documentary";
export const FADE_FRAMES = 18;
export const LEAD_FRAMES = 19;
export const GAP_FRAMES = 5;
export const TAIL_FRAMES = 15;

export function splitSentences(narration) {
  return narration.match(/(?:\d+[.,](?=\d)|[^.!?])+[.!?]*|[.!?]+/gu)?.map((part) => part.trim()).filter(Boolean) ?? [];
}

export function captionLines(text) {
  if (text.length <= 62 || !text.includes(" ")) return text;
  let split = text.indexOf(" ");
  for (let index = split; index < text.length; index++) {
    if (text[index] === " " && Math.abs(index - text.length / 2) < Math.abs(split - text.length / 2)) {
      split = index;
    }
  }
  return text.slice(0, split) + "\n" + text.slice(split + 1);
}

export function silentTiming(storyboard) {
  return storyboard.scenes.map((scene) => {
    const durationInFrames = Math.round(scene.duration * FPS);
    const sentences = splitSentences(scene.narration);
    const weights = sentences.map((sentence) => sentence.split(/\s+/).length);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const reading = durationInFrames - LEAD_FRAMES - TAIL_FRAMES - GAP_FRAMES * (sentences.length - 1);
    let consumed = 0;
    const captions = sentences.map((text, index) => {
      const start = LEAD_FRAMES + index * GAP_FRAMES + Math.round(reading * consumed / total);
      consumed += weights[index];
      const end = LEAD_FRAMES + index * GAP_FRAMES + Math.round(reading * consumed / total);
      return {text, start, end};
    });
    return {durationInFrames, captions, audio: null};
  });
}
