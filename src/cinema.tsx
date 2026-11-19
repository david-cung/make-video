import type {CSSProperties, ReactNode} from "react";
import {AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig} from "remotion";
import type {CameraPreset, Caption} from "./types";

const cameraPaths: Record<CameraPreset, [number, number, number, number, number, number]> = {
  "ken-burns": [1.06, 1.16, 24, -32, 10, -21],
  "zoom-in": [1.045, 1.16, 0, -18, 0, -13],
  "zoom-out": [1.16, 1.045, -30, 1, -17, 0],
  "pan-left": [1.10, 1.12, 55, -53, -10, 8],
  "pan-right": [1.10, 1.12, -55, 52, 12, -5],
  dolly: [1.045, 1.17, -16, -29, -23, 32],
  drift: [1.11, 1.055, 30, -27, -11, 12],
};

export function CameraMotion({preset, duration, depth, hold, children}: {
  preset: CameraPreset; duration: number; depth: number; hold: boolean; children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const [start, end, x0, x1, y0, y1] = cameraPaths[preset];
  const progress = interpolate(hold ? duration - 1 : frame, [0, duration - 1], [0, 1], {
    easing: Easing.inOut(Easing.sin), extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const scale = start + (end - start) * progress;
  const seconds = Math.min(frame, duration - 1) / fps;
  const x = (x0 + (x1 - x0) * progress) * depth + Math.sin(seconds * 2.1) * 1.1 * depth;
  const y = (y0 + (y1 - y0) * progress) * depth + Math.cos(seconds * 1.7) * 0.7 * depth;
  return <AbsoluteFill style={{transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`, transformOrigin: "68% 48%"}}>{children}</AbsoluteFill>;
}

export function ParallaxLayers({preset, duration, hold, layers}: {
  preset: CameraPreset; duration: number; hold: boolean; layers: ReactNode[];
}) {
  return layers.map((layer, index) =>
    <CameraMotion key={index} preset={preset} duration={duration} hold={hold} depth={[0.22, 0.72, 1.2][index]}>
      {layer}
    </CameraMotion>);
}

const particles = Array.from({length: 85}, (_, index) => {
  const seed = (property: string) => random(`marine:${property}:${index}`);
  return {x: seed("x") * 1920, y: seed("y") * 1080, r: 0.7 + seed("size") * 2.4, alpha: 0.12 + seed("alpha") * 0.40};
});

const sparseParticles = particles.slice(0, 24);

export function AtmosphericParticles({color, sparse = false}: {color: string; sparse?: boolean}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;
  if (sparse) return <svg viewBox="0 0 1920 1080" style={{position: "absolute", inset: 0, width: "100%", height: "100%",
    transform: `translate(${Math.sin(time * 0.25) * 24}px, ${Math.sin(time * 0.32) * 17}px)`}} aria-hidden>
    {sparseParticles.map((p, index) => <circle key={index} cx={p.x} cy={p.y} r={p.r} fill={color} opacity={p.alpha * 0.7} />)}
  </svg>;
  return <svg viewBox="0 0 1920 1080" style={{position: "absolute", inset: 0, width: "100%", height: "100%"}} aria-hidden>
    {particles.map((p, index) => <circle key={index}
      cx={(p.x + time * (4 + p.r * 3)) % 1920}
      cy={(p.y + time * (8 + p.r * 4)) % 1080}
      r={p.r} fill={color} opacity={p.alpha} />)}
  </svg>;
}

const noise = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".94" numOctaves="2" stitchTiles="stitch"/></filter><path fill="#fff" filter="url(#n)" d="M0 0h144v144H0z"/></svg>')}`;

export function FilmGrain({animated = true}: {animated?: boolean}) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{pointerEvents: "none", backgroundImage: `url("${noise}")`,
    backgroundPosition: animated ? `${frame * 29 % 144}px ${frame * 53 % 144}px` : "0 0",
    opacity: animated ? 0.12 : 0.075, mixBlendMode: animated ? "soft-light" : "normal"}} />;
}

export function Vignette() {
  return <AbsoluteFill style={{pointerEvents: "none", background: "radial-gradient(ellipse at 68% 46%, transparent 28%, #02061362 78%, #010307a8 100%)"}} />;
}

export function CinematicTitle({title, kicker, note, color, cover, chapter}: {
  title: string; kicker: string; note: string; color: string; cover: boolean; chapter?: string;
}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = spring({frame: frame - 5, fps, durationInFrames: 32, config: {damping: 24, stiffness: 85, mass: 0.9}});
  const opacity = interpolate(reveal, [0, 0.8], [0, 1], {extrapolateRight: "clamp"});
  const style: CSSProperties = {position: "absolute", top: 280, left: 132, width: cover ? 900 : 775, color: "#f2f6f2",
    opacity, transform: `translateY(${23 * (1 - reveal)}px)`, textShadow: "0 4px 36px #01060990"};
  return <section style={style}>
    {chapter && <div style={{fontSize: 18, color: "#e7e8ef", fontWeight: 600, letterSpacing: ".19em", marginBottom: 15}}>{chapter}</div>}
    <div style={{display: "flex", alignItems: "center", gap: 20, color, marginBottom: 31, fontSize: 18, fontWeight: 600, letterSpacing: "0.23em"}}>
      <div style={{width: 56, height: 1, backgroundColor: color, flexShrink: 0}} />{kicker}
    </div>
    <h1 style={{fontFamily: chapter ? '"Be Vietnam Pro", sans-serif' : '"Playfair Display", Georgia, serif',
      fontWeight: 600, fontSize: chapter ? (cover ? 105 : 78) : (cover ? 109 : 91),
      lineHeight: 1.06, letterSpacing: "-0.04em", textWrap: "balance", margin: 0}}>{title}</h1>
    {note && <div style={{fontSize: 17, color: "#d5e4e5", fontWeight: 500, letterSpacing: "0.16em", marginTop: 35}}>{note}</div>}
  </section>;
}

export function SubtitleOverlay({captions, keywords = []}: {captions: Caption[]; keywords?: string[]}) {
  const frame = useCurrentFrame();
  const cue = captions.find(({start, end}) => start <= frame && frame < end);
  if (!cue) return null;
  const expression = keywords.length ? new RegExp(`(${keywords.map((word) => word.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&")).join("|")})`, "giu") : null;
  const content = expression ? cue.text.split(expression).map((part, i) =>
    i % 2 ? <span key={i} style={{color: "#ffdb67", fontWeight: 600}}>{part}</span> : part) : cue.text;
  return <div style={{position: "absolute", bottom: 91, left: 245, right: 245, textAlign: "center", display: "flex", justifyContent: "center"}}>
    <div style={{maxWidth: 1220, padding: "14px 26px 16px", background: "#030911e8", borderRadius: 6,
      color: "#f5f8fa", fontSize: 32, fontWeight: 500, lineHeight: 1.42, textWrap: "balance"}}>{content}</div>
  </div>;
}

export function SceneTransition({frames, children}: {frames: number; children: ReactNode}) {
  const frame = useCurrentFrame();
  const opacity = frames ? interpolate(frame, [0, frames], [0, 1], {
    easing: Easing.inOut(Easing.sin), extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }) : 1;
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
}
