import {AbsoluteFill, Audio, Sequence, staticFile} from "remotion";
import {AtmosphericParticles, CinematicTitle, FilmGrain, ParallaxLayers, SceneTransition, SubtitleOverlay, Vignette} from "./cinema";
import {ArchiveAtmosphere, OceanBackdrop, SceneForeground, SceneSubject, scenePalette} from "./illustrations";
import {FADE_FRAMES, FPS} from "./timeline.mjs";
import type {DocumentaryProps, Scene, SceneTiming} from "./types";
import {SportsGraphic, StadiumAtmosphere} from "./sports";

function voiceDuck(frame: number, spans: {start: number; end: number}[], rest: number, speaking: number) {
  const ramp = 6;
  const active = spans.find(({start, end}) => frame >= start - ramp && frame < end + ramp);
  if (!active) return rest;
  const weight = Math.min(1, (frame - active.start + ramp) / ramp, (active.end + ramp - frame) / ramp);
  return rest + (speaking - rest) * weight;
}

export function CinematicScene({scene, timing, cover, hold = false}: {
  scene: Scene; timing: SceneTiming; cover: boolean; hold?: boolean;
}) {
  const {durationInFrames, audio, captions} = timing;
  const palette = scenePalette(scene);
  const id = `${scene.sceneId}${hold ? "-hold" : ""}`;
  const archive = scene.visualType === "abstract" && Boolean(scene.image);
  const sports = Boolean(scene.chapter);
  const cue = scene.soundDesign?.cue;
  return <AbsoluteFill style={{overflow: "hidden", fontFamily: '"Be Vietnam Pro", sans-serif', background: palette.dark}}>
    <ParallaxLayers preset={scene.cameraMovement} duration={durationInFrames} hold={hold} layers={[
      archive || sports ? <AbsoluteFill style={{background: `linear-gradient(136deg, ${palette.dark} 18%, ${palette.middle}85)`}} /> : <OceanBackdrop palette={palette} visual={scene.visualType} id={id} />,
      sports && !scene.image ? null : <SceneSubject palette={palette} scene={scene} id={id} archive={archive} sports={sports} />,
      sports ? <StadiumAtmosphere accent={palette.light} secondary={palette.middle} /> :
        archive ? <ArchiveAtmosphere palette={palette}><AtmosphericParticles color={palette.light} /></ArchiveAtmosphere> :
        <SceneForeground palette={palette} photographic={Boolean(scene.image)} />,
    ]} />
    {sports ? <AtmosphericParticles color={palette.light} sparse /> : !archive && <AtmosphericParticles color={palette.light} />}
    <FilmGrain animated={!sports} />
    <Vignette />
    <AbsoluteFill style={{background: sports
      ? "linear-gradient(90deg, #07090ee6 0%, #07090eb8 26%, #07090e51 48%, transparent 67%)"
      : archive
      ? "linear-gradient(90deg, #0b0806f2 0%, #100d08cb 25%, #100d084f 55%, transparent 78%)"
      : "linear-gradient(90deg, #020610d1 0%, #02061066 33%, #02061000 69%)"}} />
    <CinematicTitle title={scene.title} kicker={scene.kicker} note={scene.displayNote} color={palette.light} cover={cover} chapter={scene.chapter} />
    {scene.sportGraphic && <SportsGraphic graphic={scene.sportGraphic} accent={palette.light} />}
    <div style={{position: "absolute", right: 130, bottom: archive || sports ? 48 : 176, color: "#c2d3df", fontSize: 16, letterSpacing: "0.045em",
      textShadow: "0 2px 8px #020609", padding: "6px 12px", background: "#030916b0", borderRadius: 3}}>
      {scene.image ? scene.image.credit : "Minh họa"}
    </div>
    {!hold && <SubtitleOverlay captions={captions} keywords={scene.keywords} />}
    {!hold && audio && <Audio src={staticFile(audio)} />}
    {!hold && cue && <Audio src={staticFile(cue)} volume={(frame) => voiceDuck(frame, captions, 0.28, 0.085)} />}
  </AbsoluteFill>;
}

export function Documentary({storyboard, timing}: DocumentaryProps) {
  let from = 0;
  const total = timing.reduce((sum, scene) => sum + scene.durationInFrames, 0);
  const hasVoice = timing.some(({audio}) => audio);
  let audioStart = 0;
  const speech = storyboard.scenes.some(({soundDesign}) => soundDesign) ? timing.flatMap((scene) => {
    const start = audioStart;
    audioStart += scene.durationInFrames;
    return scene.audio ? scene.captions.map((caption) => ({start: start + caption.start, end: start + caption.end})) : [];
  }) : [];
  return <AbsoluteFill style={{backgroundColor: "#04101c"}}>
    {storyboard.music && <Audio src={staticFile(storyboard.music.path)} loop
      volume={(frame) => (speech.length ? voiceDuck(frame, speech, 0.29, 0.10) : hasVoice ? 0.18 : 0.32) *
        Math.min(1, frame / FPS, Math.max(0, (total - 1 - frame) / (2 * FPS)))} />}
    {storyboard.scenes.map((scene, index) => {
      const current = timing[index];
      const previous = timing[index - 1];
      const start = from;
      from += current.durationInFrames;
      const fade = previous && scene.transition === "fade" ? FADE_FRAMES : 0;
      return <Sequence key={scene.sceneId} from={start} durationInFrames={current.durationInFrames} name={scene.title}>
        {fade > 0 && <Sequence from={0} durationInFrames={fade} name="Dissolve">
          <Sequence from={-(previous.durationInFrames - 1)}>
            <CinematicScene scene={storyboard.scenes[index - 1]} timing={previous} cover={index === 1} hold />
          </Sequence>
        </Sequence>}
        <SceneTransition frames={fade}>
          <CinematicScene scene={scene} timing={current} cover={index === 0} />
        </SceneTransition>
      </Sequence>;
    })}
  </AbsoluteFill>;
}
