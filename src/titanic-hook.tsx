import type {ReactNode} from "react";
import {AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame} from "remotion";
import {FilmGrain} from "./cinema";
import {DocumentarySubtitles, ShipSilhouette} from "./titanic";
import {TitanicIntelPicture} from "./titanic-intel";
import type {Caption, Scene} from "./types";

export type HookShot = {
  id: "reveal" | "engine" | "corridor" | "flooding" | "countdown" | "sinking" | "question";
  startFrame: number;
  durationInFrames: number;
  captions: Caption[];
  eventFrame?: number;
};
export type HookProps = {scenes: HookShot[]; floodScene: Scene};

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;
const frameStyle = {position: "absolute", inset: 0, width: "100%", height: "100%"} as const;
const brass = "#e3bb87";

function ramp(frame: number, from: number, to: number) {
  return interpolate(frame, [from, Math.max(from + 1, to)], [0, 1], clamp);
}

function Canvas({children}: {children: ReactNode}) {
  return <svg viewBox="0 0 1920 1080" style={frameStyle} aria-hidden>{children}</svg>;
}

function Label({children = "Illustrated reconstruction"}: {children?: ReactNode}) {
  return <div style={{position: "absolute", right: 92, bottom: 43, color: "#c7d6dc", fontSize: 17,
    background: "#050e17c4", padding: "6px 11px", letterSpacing: ".04em"}}>{children}</div>;
}

function Sea({sinking = false, empty = false, duration, impact = 14}: {
  sinking?: boolean; empty?: boolean; duration: number; impact?: number;
}) {
  const frame = useCurrentFrame();
  const progress = ramp(frame, 0, duration - 1);
  const shock = frame >= impact && !sinking && !empty
    ? Math.sin((frame - impact) * 1.6) * Math.exp(-(frame - impact) / 6) * 7 : 0;
  const horizon = sinking ? 644 : 630;
  const y = horizon - 19 + (sinking ? 95 * progress : 0);
  const scale = sinking ? 1.22 : .97 + .10 * progress;
  const shipId = sinking ? "hook-sinking" : "hook-reveal";
  return <AbsoluteFill style={{backgroundColor: "#061019", overflow: "hidden"}}>
    <Img src={staticFile("titanic-intel/sky.jpg")} style={{...frameStyle,
      transform: `translateX(${-18 * progress}px) scale(1.06)`, opacity: sinking ? .88 : .7}} />
    <Img src={staticFile("titanic-intel/far-water.jpg")} style={{position: "absolute", top: horizon,
      width: "100%", height: 1080 - horizon, transform: `translateX(${-36 * progress}px) scale(1.08)`,
      maskImage: "linear-gradient(transparent, black 10%)", opacity: .74}} />
    <AbsoluteFill style={{opacity: empty ? .27 : .5,
      background: `radial-gradient(ellipse 59% 5% at ${61 - progress * 6}% 57%, #7ca2b05e, transparent 85%), radial-gradient(ellipse 42% 16% at 58% 56%, #4160786f, transparent)`}} />
    {!empty && <Canvas>
      <defs>
        <clipPath id={`${shipId}-level`}><path d={`M0 0H1920V${horizon + 9}Q1070 ${horizon + 16} 0 ${horizon + 9}Z`} /></clipPath>
        <radialGradient id={`${shipId}-fog`}>
          <stop stopColor="#768f9b" stopOpacity=".22" /><stop offset="1" stopColor="#43556b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={960 - 90 * progress} cy={horizon - 10} rx="750" ry="104" fill={`url(#${shipId}-fog)`} />
      <g clipPath={`url(#${shipId}-level)`} opacity={sinking ? 1 - progress * .35 : 1}>
        <g transform={`translate(${sinking ? 420 - 68 * progress : 494 + 29 * progress + shock} ${y}) rotate(${sinking ? 9 + 11 * progress : -2} 440 0) scale(${scale})`}>
          <ShipSilhouette id={shipId} dark="#142632" light="#c2d1d2" detailed />
        </g>
      </g>
      <path d={`M0 ${horizon + 11}Q910 ${horizon - 2} 1920 ${horizon + 13}`} stroke="#94c0c9"
        strokeWidth="2" opacity=".27" fill="none" />
    </Canvas>}
    <Img src={staticFile("titanic-intel/near-water.png")} style={{position: "absolute", left: -122, bottom: -22,
      width: 2184, height: 330, opacity: empty ? .72 : .51,
      transform: `translate3d(${-98 * progress + shock}px,${2 * Math.sin(frame / 11)}px,0)`}} />
    <AbsoluteFill style={{background: "linear-gradient(0deg,#030911cf,transparent 39%),radial-gradient(ellipse at 54% 55%,transparent 44%,#030912ad)"}} />
  </AbsoluteFill>;
}

function EngineRoom({duration}: {duration: number}) {
  const frame = useCurrentFrame();
  const t = ramp(frame, 0, duration);
  const shake = 6 * Math.sin(frame * 1.8) * Math.exp(-frame / 10);
  return <AbsoluteFill style={{background: "#050c12"}}>
    <Canvas>
      <defs>
        <radialGradient id="hook-engine-space"><stop stopColor="#45515a" /><stop offset="1" stopColor="#0b1019" /></radialGradient>
        <linearGradient id="hook-engine-cylinder"><stop stopColor="#09151b" /><stop offset=".46" stopColor="#50616a" />
          <stop offset=".62" stopColor="#303c45" /><stop offset="1" stopColor="#0b1921" /></linearGradient>
        <radialGradient id="hook-engine-lamp"><stop stopColor="#ffcf88" stopOpacity=".47" /><stop offset="1" stopColor="#c28b54" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#hook-engine-space)" />
      <g transform={`translate(${-100 * t + shake} 0)`}>
        <path d="M-80 155H2020M-80 173H2020M-80 252H2020M-80 292H2020" stroke="#67747b" strokeWidth="7" opacity=".5" />
        <path d="M-90 408H2000M-70 817H2020" stroke="#132027" strokeWidth="31" />
        {[170, 495, 830, 1165, 1500, 1815].map((x, i) => <g key={x}>
          <path d={`M${x} 77v228q0 39 37 39h47v121`} fill="none" stroke="#536879" strokeWidth="17" />
          <path d={`M${x + 18} 201H${x + 178}v104`} stroke="#a4a685" strokeWidth="5" fill="none" opacity=".46" />
          <rect x={x - 57} y="369" width="233" height="380" rx="91" fill="url(#hook-engine-cylinder)" stroke="#67777a" strokeWidth="4" />
          <ellipse cx={x + 50} cy="551" rx="90" ry="112" fill="#1a2930" stroke="#788380" strokeWidth="9" />
          <ellipse cx={x + 50} cy="551" rx="70" ry="89" fill="#101a20" stroke="#2f4346" strokeWidth="8" />
          <ellipse cx={x + 50} cy="584" rx="48" ry="40" fill="url(#hook-engine-lamp)" opacity={.64 + .09 * Math.sin(frame / 12 + i)} />
          <path d={`M${x + 41} 557h31m-17 -14v28`} stroke="#847f70" strokeWidth="7" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <circle key={n}
            cx={x + 50 + 80 * Math.cos(n * Math.PI / 4)} cy={551 + 102 * Math.sin(n * Math.PI / 4)} r="5" fill="#a0a19a" />)}
        </g>)}
        <path d="M-50 750H2010M-50 813H2010" stroke="#a2a69b" strokeWidth="6" opacity=".45" />
        {Array.from({length: 24}, (_, i) => <path key={i} d={`M${i * 90} 750v86l-74 175`} stroke="#5b696b" strokeWidth="4" opacity=".55" />)}
      </g>
      <ellipse cx={1380 - t * 167} cy="465" rx="750" ry="530" fill="url(#hook-engine-lamp)" opacity=".42" />
      <g transform={`translate(${-192 * t + shake} 0)`} fill="#071216" opacity=".9">
        <path d="M-75 108h138v972H-75Zm1870 0h82v972h-82z" />
        <path d="M0 279H2040v28H0ZM0 872H2040v24H0Z" />
      </g>
    </Canvas>
    <AbsoluteFill style={{background: "radial-gradient(ellipse at 55% 54%,transparent 40%,#03080dcc),linear-gradient(0deg,#03090fb0,transparent 28%)"}} />
  </AbsoluteFill>;
}

function Corridor({duration}: {duration: number}) {
  const frame = useCurrentFrame();
  const t = ramp(frame, 0, duration);
  const center = 998 + 15 * t;
  const distance = [1, .68, .46, .31, .21, .14, .095];
  return <AbsoluteFill style={{background: "#1a1819"}}>
    <Canvas>
      <defs>
        <linearGradient id="hook-wall"><stop stopColor="#886b50" /><stop offset="1" stopColor="#302925" /></linearGradient>
        <linearGradient id="hook-floor" x2="0" y2="1"><stop stopColor="#514134" /><stop offset="1" stopColor="#1f1a1f" /></linearGradient>
        <radialGradient id="hook-corridor-light"><stop stopColor="#f7ce91" stopOpacity=".5" /><stop offset="1" stopColor="#bd846b" stopOpacity="0" /></radialGradient>
      </defs>
      <path d={`M0 0L${center - 53} 468v141L0 1080z`} fill="url(#hook-wall)" />
      <path d={`M1920 0L${center + 53} 468v141L1920 1080z`} fill="#665144" />
      <path d={`M0 1080l${center - 53} -471h106L1920 1080Z`} fill="url(#hook-floor)" />
      <path d={`M0 0h1920L${center+53} 468h-106Z`} fill="#423b32" opacity=".84" />
      <rect x={center-54} y="465" width="108" height="145" fill="#34261c" />
      {distance.slice().reverse().map((d, i) => {
        const scale = d * (1 + .27 * t);
        const x = 840 * scale;
        const top = 530 - 455 * scale;
        const bottom = 545 + 403 * scale;
        const left = center - x;
        const right = center + x;
        return <g key={d}>
          <path d={`M${left} ${bottom}V${top}H${right}V${bottom}`} stroke="#332925" strokeWidth={17 * scale + 1} fill="none" />
          <path d={`M${left + 14*scale} ${bottom}V${top + 14*scale}H${right - 14*scale}V${bottom}`}
            stroke="#bc9a71" strokeWidth={2.7 * scale + .6} fill="none" opacity=".53" />
          <path d={`M${left} ${bottom}H${right}M${left} ${top + 630*scale}H${left + 141*scale}v${151*scale}
            M${right} ${top + 630*scale}H${right - 141*scale}v${151*scale}`} stroke="#41302a" strokeWidth={6 * scale} fill="none" />
          <ellipse cx={center} cy={top + 84*scale} rx={468*scale} ry={292*scale}
            fill="url(#hook-corridor-light)" opacity={.61 - (i%3)*.05} />
          <rect x={center - 26*scale} y={top + 68*scale} width={52*scale} height={10*scale}
            rx={4*scale} fill="#ffd59e" opacity=".83" />
          <circle cx={left + 102*scale} cy={top + 480*scale} r={4.4*scale} fill={brass} />
          <circle cx={right - 102*scale} cy={top + 480*scale} r={4.4*scale} fill={brass} />
        </g>;
      })}
      <path d={`M${center - 22} 615 585 1080m${center+22-585} -465L1450 1080`}
        stroke="#a88767" strokeWidth="4" opacity=".29" fill="none" />
    </Canvas>
    <AbsoluteFill style={{background: "radial-gradient(ellipse at 54% 51%,transparent 36%,#06090dc0),linear-gradient(0deg,#0e1016ad,transparent 34%)"}} />
  </AbsoluteFill>;
}

function Countdown({duration, captions}: {duration: number; captions: Caption[]}) {
  const frame = useCurrentFrame();
  const progress = ramp(frame, 3, duration - 1);
  const aboard = ramp(frame, captions[1]?.start ?? duration * .55, (captions[1]?.start ?? duration * .55) + 11);
  return <AbsoluteFill style={{background: "radial-gradient(ellipse at 50% 44%,#26333c,#09141d 72%)"}}>
    <Canvas>
      <circle cx="960" cy="453" r="353" fill="none" stroke="#728a90" strokeWidth="1" opacity=".37" />
      <circle cx="960" cy="453" r="331" fill="none" stroke="#a38257" strokeWidth="5" opacity=".22" />
      <circle cx="960" cy="453" r="331" fill="none" stroke={brass} strokeWidth="5" pathLength="1"
        transform="rotate(-90 960 453)" strokeDasharray={`${Math.max(.001, progress*.84)} 1`} />
      <g transform="translate(960 453)">
        {Array.from({length: 60}, (_, i) => <path key={i} d={i % 5 ? "M0-327v10" : "M0-327v23"}
          transform={`rotate(${i*6})`} stroke="#849398" opacity={i % 5 ? ".35" : ".76"} strokeWidth={i % 5 ? 1.5 : 3} />)}
        <path d="M0-300v31" transform={`rotate(${progress*302})`} stroke={brass} strokeWidth="5" />
      </g>
    </Canvas>
    <div style={{position: "absolute", top: 305, width: "100%", textAlign: "center", color: "#edf0eb",
      opacity: ramp(frame, 0, 12), transform: `translateY(${9 * (1 - progress)}px)`}}>
      <div style={{fontSize: 176, fontWeight: 600, lineHeight: .95, fontVariantNumeric: "tabular-nums"}}>160</div>
      <div style={{fontSize: 36, letterSpacing: 13, color: brass, marginTop: 14}}>MINUTES</div>
      <div style={{fontSize: 27, letterSpacing: 4, opacity: aboard, marginTop: 38}}>2,000+ ABOARD</div>
    </div>
  </AbsoluteFill>;
}

function ShotPicture({scene, floodScene}: {scene: HookShot; floodScene: Scene}) {
  const frame = useCurrentFrame();
  const {id, durationInFrames: duration, captions, eventFrame} = scene;
  const covered = id === "reveal" ? ramp(frame, 6, 24) : 1;
  const body: Record<HookShot["id"], ReactNode> = {
    reveal: <Sea duration={duration} impact={eventFrame} />,
    engine: <EngineRoom duration={duration} />,
    corridor: <Corridor duration={duration} />,
    flooding: <TitanicIntelPicture scene={floodScene} duration={duration} captions={captions} hold={false} />,
    countdown: <Countdown duration={duration} captions={captions} />,
    sinking: <Sea duration={duration} sinking />,
    question: <Sea duration={duration} empty />,
  };
  const title = ramp(frame, Math.max(0, (captions[1]?.start ?? 10) - 4), (captions[1]?.start ?? 10) + 8);
  return <AbsoluteFill style={{background: "#000", overflow: "hidden", fontFamily: '"Be Vietnam Pro", sans-serif'}}>
    <AbsoluteFill style={{opacity: covered}}>{body[id]}<FilmGrain animated={false} /></AbsoluteFill>
    {id === "question" && <div style={{position: "absolute", top: "41%", width: "100%", opacity: title,
      transform: `translateY(${14*(1-title)}px)`, textAlign: "center", color: "#f1eee6", fontSize: 88,
      letterSpacing: ".035em", fontWeight: 600, textShadow: "0 4px 21px #000"}}>HOW DID THIS HAPPEN?</div>}
    {id !== "flooding" && id !== "countdown" && covered > .77 && <Label />}
    <DocumentarySubtitles captions={captions} />
  </AbsoluteFill>;
}

export function TitanicHook({scenes, floodScene}: HookProps) {
  return <AbsoluteFill style={{backgroundColor: "#000"}}>
    {scenes.map((scene) => <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames} name={scene.id}>
      <ShotPicture scene={scene} floodScene={floodScene} />
    </Sequence>)}
  </AbsoluteFill>;
}
