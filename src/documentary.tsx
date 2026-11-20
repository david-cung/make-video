import {AbsoluteFill, Audio, Sequence, staticFile} from "remotion";
import {AtmosphericParticles, CinematicTitle, FilmGrain, ImageFirstTitle, ParallaxLayers, SceneTransition, SubtitleOverlay, Vignette} from "./cinema";
import {ArchiveAtmosphere, OceanBackdrop, SceneForeground, SceneSubject, scenePalette} from "./illustrations";
import {FADE_FRAMES, FPS, opensChapter} from "./timeline.mjs";
import type {Caption, DocumentaryProps, Scene, SceneTiming, SoundCue} from "./types";
import {SportsGraphic, StadiumAtmosphere} from "./sports";
import {DocumentarySubtitles, TitanicPicture} from "./titanic";
import {supportsIntelScene, TitanicIntelPicture} from "./titanic-intel";

function voiceDuck(frame: number, spans: {start: number; end: number}[], rest: number, speaking: number) {
  const ramp = 6;
  const active = spans.find(({start, end}) => frame >= start - ramp && frame < end + ramp);
  if (!active) return rest;
  const weight = Math.min(1, (frame - active.start + ramp) / ramp, (active.end + ramp - frame) / ramp);
  return rest + (speaking - rest) * weight;
}

export function SoundCueTimeline({cues, captions, frames}: {cues: SoundCue[]; captions: Caption[]; frames: number}) {
  return cues.map(({path, start, duration, gain, loop}, index) => {
    const from = Math.round(start * FPS);
    const length = Math.min(frames - from, Math.round(duration * FPS));
    if (length < 1) return null;
    return <Sequence key={`${path}-${index}`} from={from} durationInFrames={length} name={path}>
      <Audio src={staticFile(path)} loop={loop}
        volume={(frame) => voiceDuck(frame + from, captions, gain, gain * 0.37) *
          Math.min(1, (frame + 1) / 4, (length - frame) / 9)} />
    </Sequence>;
  });
}

export function CinematicScene({scene, timing, cover, illustrationLabel, subtitle, imageFirst = false, chapterOpening = cover, hold = false, historicalStyle}: {
  scene: Scene; timing: SceneTiming; cover: boolean; illustrationLabel: string; subtitle?: string;
  imageFirst?: boolean; chapterOpening?: boolean; hold?: boolean;
  historicalStyle?: DocumentaryProps["storyboard"]["historicalStyle"];
}) {
  const {durationInFrames, audio, captions} = timing;
  const palette = scenePalette(scene);
  const id = `${scene.sceneId}${hold ? "-hold" : ""}`;
  const archive = scene.visualType === "abstract" && Boolean(scene.image);
  const sports = Boolean(scene.chapter);
  const {cue, cues} = scene.soundDesign ?? {};
  const sound = !hold && cues && <SoundCueTimeline cues={cues} captions={audio ? captions : []} frames={durationInFrames} />;
  if (scene.historical) {
    return <AbsoluteFill style={{overflow: "hidden", fontFamily: '"Be Vietnam Pro", sans-serif', background: palette.dark}}>
      {historicalStyle === "intel-uhd" && supportsIntelScene(scene)
        ? <TitanicIntelPicture scene={scene} duration={durationInFrames} captions={captions} hold={hold} />
        : <TitanicPicture scene={scene} duration={durationInFrames} hold={hold} palette={palette} cover={cover} subtitle={subtitle}
            imageFirst={imageFirst} chapterOpening={chapterOpening} />}
      {!hold && <DocumentarySubtitles captions={captions} />}
      {!hold && audio && <Audio src={staticFile(audio)} />}
      {!hold && cue && <Audio src={staticFile(cue)} volume={(frame) => voiceDuck(frame, captions, 0.22, 0.08)} />}
      {sound}
    </AbsoluteFill>;
  }
  return <AbsoluteFill style={{overflow: "hidden", fontFamily: '"Be Vietnam Pro", sans-serif', background: palette.dark}}>
    <ParallaxLayers preset={scene.cameraMovement} duration={durationInFrames} hold={hold} layers={[
      archive || sports ? <AbsoluteFill style={{background: `linear-gradient(136deg, ${palette.dark} 18%, ${palette.middle}85)`}} /> : <OceanBackdrop palette={palette} visual={scene.visualType} id={id} />,
      sports && !scene.image ? null : <SceneSubject palette={palette} scene={scene} id={id} archive={archive} sports={sports} fullBleed={imageFirst} />,
      sports ? <StadiumAtmosphere accent={palette.light} secondary={palette.middle} /> :
        archive ? <ArchiveAtmosphere palette={palette}><AtmosphericParticles color={palette.light} /></ArchiveAtmosphere> :
        <SceneForeground palette={palette} photographic={Boolean(scene.image)} />,
    ]} />
    {sports ? <AtmosphericParticles color={palette.light} sparse /> : !archive && <AtmosphericParticles color={palette.light} />}
    <FilmGrain animated={!sports} />
    <Vignette />
    {!imageFirst && <AbsoluteFill style={{background: sports
      ? "linear-gradient(90deg, #07090ee6 0%, #07090eb8 26%, #07090e51 48%, transparent 67%)"
      : archive
      ? "linear-gradient(90deg, #0b0806f2 0%, #100d08cb 25%, #100d084f 55%, transparent 78%)"
      : "linear-gradient(90deg, #020610d1 0%, #02061066 33%, #02061000 69%)"}} />}
    {imageFirst
      ? <ImageFirstTitle scene={scene} chapterOpening={chapterOpening} color={palette.light} />
      : <CinematicTitle title={scene.title} kicker={scene.kicker} note={scene.displayNote} color={palette.light} cover={cover} chapter={scene.chapter} />}
    {scene.sportGraphic && <SportsGraphic graphic={scene.sportGraphic} accent={palette.light} centered={imageFirst} />}
    <div style={{position: "absolute", right: 130, bottom: imageFirst || archive || sports ? 48 : 176, color: "#c2d3df", fontSize: 16, letterSpacing: "0.045em",
      textShadow: "0 2px 8px #020609", padding: "6px 12px", background: "#030916b0", borderRadius: 3}}>
      {imageFirst && scene.image && scene.displayNote && <span style={{marginRight: 16}}>{scene.displayNote}</span>}
      {scene.image ? scene.image.credit : illustrationLabel}
    </div>
    {!hold && <SubtitleOverlay captions={captions} keywords={scene.keywords} />}
    {!hold && audio && <Audio src={staticFile(audio)} />}
    {!hold && cue && <Audio src={staticFile(cue)} volume={(frame) => voiceDuck(frame, captions, 0.28, 0.085)} />}
    {sound}
  </AbsoluteFill>;
}

export function Documentary({storyboard, timing}: DocumentaryProps) {
  let from = 0;
  const imageFirst = storyboard.visualStyle === "image-first";
  const illustrationLabel = storyboard.language === "en" ? "Illustration" : "Minh họa";
  const total = timing.reduce((sum, scene) => sum + scene.durationInFrames, 0);
  const hasVoice = timing.some(({audio}) => audio);
  let audioStart = 0;
  const speech = storyboard.scenes.some(({soundDesign}) => soundDesign) ? timing.flatMap((scene) => {
    const start = audioStart;
    audioStart += scene.durationInFrames;
    return scene.audio ? scene.captions.map((caption) => ({start: start + caption.start, end: start + caption.end})) : [];
  }) : [];
  let musicStart = 0;
  const musicLevels = storyboard.scenes.map((scene, index) => {
    const start = musicStart;
    musicStart += timing[index].durationInFrames;
    return {start, end: musicStart, gain: scene.soundDesign?.musicGain ?? 1};
  });
  const musicGain = (frame: number) => {
    const index = musicLevels.findIndex(({end}) => frame < end);
    if (index < 0) return 0;
    const {start, gain} = musicLevels[index];
    const previous = musicLevels[index - 1]?.gain ?? gain;
    return previous + (gain - previous) * Math.min(1, (frame - start) / 6);
  };
  return <AbsoluteFill style={{backgroundColor: "#04101c"}}>
    {storyboard.music && <Audio src={staticFile(storyboard.music.path)} loop
      volume={(frame) => (speech.length ? voiceDuck(frame, speech, 0.29, 0.10) : hasVoice ? 0.18 : 0.32) * musicGain(frame) *
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
            <CinematicScene scene={storyboard.scenes[index - 1]} timing={previous} cover={index === 1}
              illustrationLabel={illustrationLabel} subtitle={storyboard.subtitle}
              imageFirst={imageFirst} historicalStyle={storyboard.historicalStyle}
              chapterOpening={opensChapter(storyboard.scenes, index - 1)} hold />
          </Sequence>
        </Sequence>}
        <SceneTransition frames={fade}>
          <CinematicScene scene={scene} timing={current} cover={index === 0}
            illustrationLabel={illustrationLabel} subtitle={storyboard.subtitle}
            imageFirst={imageFirst} historicalStyle={storyboard.historicalStyle}
            chapterOpening={opensChapter(storyboard.scenes, index)} />
        </SceneTransition>
      </Sequence>;
    })}
  </AbsoluteFill>;
}
