import type {CSSProperties, ReactNode} from "react";
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from "remotion";
import {FPS} from "./timeline.mjs";
import {ShipSilhouette} from "./titanic";
import type {Caption, Scene} from "./types";

const directory = "titanic-intel";
const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;
const full = {position: "absolute", width: 1920, height: 1080} as const;
const amber = "#e8b580";

function phase(frame: number, start: number, end: number) {
  return interpolate(frame, [start, Math.max(start + 1, end)], [0, 1], clamp);
}

function Plane({x = 0, y = 0, scale = 1, children}: {
  x?: number; y?: number; scale?: number; children: ReactNode;
}) {
  return <AbsoluteFill style={{transform: `translate3d(${x}px,${y}px,0) scale(${scale})`}}>{children}</AbsoluteFill>;
}

function Plate({file, style}: {file: string; style: CSSProperties}) {
  return <Img src={staticFile(`${directory}/${file}`)} style={{position: "absolute", display: "block", ...style}} />;
}

function Label({children}: {children: ReactNode}) {
  return <div style={{position: "absolute", right: 89, bottom: 45, padding: "7px 11px",
    fontSize: 17, color: "#dce8e8", background: "#101c25e5", borderRadius: 2}}>{children}</div>;
}

function project(lon: number, lat: number): [number, number] {
  return [150 + (lon + 83) * 16.4, 116 + (66 - lat) * 23.4];
}

const ports = [
  {name: "NEW YORK", coordinate: [-74.01, 40.71], dx: 16, dy: 46},
  {name: "QUEENSTOWN", coordinate: [-8.292, 51.848], dx: -154, dy: -22},
  {name: "SOUTHAMPTON", coordinate: [-1.404, 50.91], dx: 19, dy: -19},
  {name: "CHERBOURG", coordinate: [-1.62, 49.64], dx: 19, dy: 38},
];
const [distressX, distressY] = project(-50 - 14 / 60, 41 + 46 / 60);
const line = [[-1.404, 50.91], [-1.62, 49.64], [-8.292, 51.848], [-22, 49.4], [-36.5, 45.8], [-50 - 14 / 60, 41 + 46 / 60]]
  .map(([lon, lat]) => project(lon, lat).join(",")).join(" ");

function AtlanticChart({stage, duration}: {stage: number; duration: number}) {
  const frame = useCurrentFrame();
  const trace = phase(frame, 3, duration * .60);
  const ripple = phase(frame, duration * .52, duration * .92);
  const approach = phase(frame, 0, duration - 1);
  const destination = project(-74.01, 40.71).join(",");
  const track = stage === 0 ? `${line} ${destination}` : line;
  return <AbsoluteFill style={{background: "radial-gradient(ellipse at 50% 48%, #193c4a, #0a202d 75%)"}}>
    <Plane x={56 * approach} y={-16 * approach} scale={1.02 + .19 * approach}>
      <Plate file="atlantic-land.svg" style={{width: 1920, height: 1080, inset: 0}} />
      <svg viewBox="0 0 1920 1080" style={full} aria-hidden>
        <g stroke="#7d9ca4" strokeWidth="1" opacity=".2">
          {[-80, -70, -60, -50, -40, -30, -20, -10, 0, 10].map((lon) => {
            const [x] = project(lon, 40);
            return <path key={lon} d={`M${x} 155V850`} />;
          })}
          {[35, 40, 45, 50, 55, 60].map((lat) => {
            const [, y] = project(-45, lat);
            return <path key={lat} d={`M95 ${y}H1825`} />;
          })}
        </g>
        <text x="1109" y="373" textAnchor="middle" fill="#a5c4c9" fontSize="29" letterSpacing="9"
          opacity=".78">NORTH ATLANTIC OCEAN</text>
        <polyline points={track} fill="none" stroke="#97b6ba" strokeOpacity=".25" strokeWidth="3" />
        <polyline points={track} pathLength="1" strokeDasharray={`${Math.max(trace, .001)} 1`}
          fill="none" stroke={amber} strokeWidth="6.5" strokeLinejoin="round" strokeLinecap="round" />
        {stage > 0 && <path d={`M${distressX} ${distressY}L${destination}`}
          fill="none" stroke="#b5ced1" strokeWidth="3" strokeDasharray="9 14" opacity={.58 * ripple} />}
        {ports.map(({name, coordinate, dx, dy}) => {
          const [x, y] = project(coordinate[0], coordinate[1]);
          return <g key={name}><circle cx={x} cy={y} r="5" fill="#e5eeee" />
            <text x={x + dx} y={y + dy} fill="#d9e7e7" paintOrder="stroke" stroke="#15303c" strokeWidth="5"
              fontSize="21" letterSpacing="2">{name}</text></g>;
        })}
        {stage > 0 && <g opacity={Math.min(1, ripple * 5)}>
          <circle cx={distressX} cy={distressY} r={14 + 40 * ripple} stroke={amber}
            strokeWidth="2" fill="none" opacity={1 - .72 * ripple} />
          <circle cx={distressX} cy={distressY} r="8" fill={amber} />
          <path d={`M${distressX} ${distressY + 16}v40l21 20h186`} fill="none" stroke={amber} strokeWidth="2" />
          <text x={distressX + 38} y={distressY + 105} fill={amber} fontSize="25" fontWeight="600">REPORTED DISTRESS AREA</text>
        </g>}
        {stage === 3 && <g opacity={ripple}>
          <path d={`M${distressX + 251} ${distressY + 155}Q${distressX + 96} ${distressY + 90} ${distressX} ${distressY}`}
            fill="none" stroke="#a2cccf" strokeWidth="5" strokeDasharray="8 12" />
          <text x={distressX + 265} y={distressY + 162} fill="#a2cccf" fontSize="22">CARPATHIA</text>
        </g>}
      </svg>
    </Plane>
    <div style={{position: "absolute", left: 70, top: 115, padding: "12px 24px", background: "#0c2431ed", color: "#e4eeee"}}>
      <div style={{fontSize: 31, fontWeight: 600}}>TITANIC’S WESTBOUND ROUTE</div>
      <div style={{fontSize: 20, marginTop: 7, letterSpacing: 4, color: "#a9c4ca"}}>APRIL 1912</div>
    </div>
    <Label>Approximate route · Made with Natural Earth</Label>
  </AbsoluteFill>;
}

function AtlanticContact({id, stage, duration, impact}: {id: string; stage: number; duration: number; impact: number}) {
  const frame = useCurrentFrame();
  const drift = phase(frame, 0, duration - 1);
  const pastImpact = frame >= impact && stage === 1;
  const impactShift = pastImpact ? Math.sin((frame - impact) * 1.75) * Math.exp(-(frame - impact) / 7) * 8 : 0;
  const wash = phase(frame, impact - 1, impact + 11) * (1 - phase(frame, impact + 14, impact + 31));
  return <AbsoluteFill style={{background: "#06121e"}}>
    <Plane x={-14 * drift} y={-3 * drift} scale={1.04}>
      <Plate file="sky.jpg" style={{width: 1920, height: 1080, inset: 0}} />
    </Plane>
    <Plane x={-36 * drift} y={-3 * drift} scale={1.06}>
      <Plate file="far-water.jpg" style={{left: 0, top: 650, width: 1920, height: 430,
        maskImage: "linear-gradient(transparent, black 10%)"}} />
    </Plane>
    <Plane x={-98 * drift} y={Math.sin(frame / 37) * 2} scale={1.02 + .035 * drift}>
      <Plate file="iceberg.png" style={{left: stage === 0 ? 1360 : 1280, top: 322, width: 682, height: 458, opacity: .8}} />
    </Plane>
    <Plane x={108 * drift + impactShift} y={Math.sin(frame / 31) * 3} scale={1 + .05 * drift}>
      <svg viewBox="0 0 1920 1080" style={full} aria-hidden>
        <defs>
          <linearGradient id={`${id}-wake`}><stop stopColor="#5592a7" stopOpacity="0" />
            <stop offset=".76" stopColor="#6fa0a8" stopOpacity=".5" />
            <stop offset="1" stopColor="#bfdee2" stopOpacity=".35" /></linearGradient>
        </defs>
        <g transform="translate(272 655) scale(1.12)">
          <ShipSilhouette id={id} dark="#131e2a" light="#9aaeb8" detailed />
        </g>
        <path d="M155 712Q584 684 874 702T1287 675Q1138 738 902 746T155 712Z" fill={`url(#${id}-wake)`} />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => <path key={i}
          d={`M${407 + i * 55} ${733 + (i % 4) * 11}h${15 + 9 * (i % 4)}`} stroke="#f6bd80" strokeWidth="2.5"
          opacity={.39 - (i % 3) * .08} />)}
        {pastImpact && <g opacity={wash * .53} stroke="#b1cad5" strokeWidth="3" fill="none">
          <path d="M1145 698q93 -16 163 -8q65 11 103 0M1188 710q115 18 233 2" />
          <path d="M1241 672q27 -24 57 -8q21 21 67 18" />
        </g>}
      </svg>
    </Plane>
    <Plane x={-190 * drift + impactShift * .7} y={13 * Math.sin(drift * Math.PI)} scale={1.23}>
      <Plate file="near-water.png" style={{left: -35, bottom: -12, width: 2070, height: 294, opacity: .78}} />
    </Plane>
    <AbsoluteFill style={{background: "linear-gradient(0deg,#050d15d8,transparent 26%),radial-gradient(ellipse at 60% 54%,transparent 51%,#020914a1)"}} />
    <div style={{position: "absolute", left: 94, top: 126, color: "#e9d8c1", fontSize: 22, letterSpacing: ".16em",
      background: "#071520cb", padding: "9px 13px"}}>{stage === 0 ? "14 APRIL 1912" : "14 APRIL 1912 · ABOUT 11:40 P.M."}</div>
    <Label>Illustrated reconstruction</Label>
  </AbsoluteFill>;
}

const hull = "M208 354H1720Q1700 449 1646 557Q1585 673 1491 708H335Q244 682 208 354Z";
const partitions = [253, 442, 638, 834, 1030, 1226, 1422, 1618];

function FloodingCutaway({id, duration, stage, captions}: {id: string; duration: number; stage: number; captions: Caption[]}) {
  const frame = useCurrentFrame();
  const second = captions[1]?.start ?? Math.round(duration * .57);
  const initial = phase(frame, captions[0]?.start ?? 14, second + 3);
  const spread = stage < 2 ? 0 : phase(frame, second + 3, duration - 18);
  const arrow = phase(frame, second + 2, second + 16);
  const waterTop = 708 - initial * 179 - spread * 31;
  const evidence = phase(frame, 3, 18);
  return <AbsoluteFill style={{background: "radial-gradient(ellipse at 54% 52%, #203b47, #0c202c 73%)"}}>
    <svg viewBox="0 0 1920 1080" style={full} aria-hidden>
      <defs>
        <clipPath id={`${id}-hull-clip`}><path d={hull} /></clipPath>
        <linearGradient id={`${id}-water`} x2="0" y2="1">
          <stop stopColor="#378d9b" /><stop offset="1" stopColor="#1a485d" />
        </linearGradient>
        <pattern id={`${id}-pattern`} width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M36 0H0v36" fill="none" stroke="#6e929b" strokeWidth="1" opacity=".20" />
        </pattern>
      </defs>
      <rect x="96" y="241" width="1715" height="576" fill={`url(#${id}-pattern)`} opacity=".85" />
      <text x="106" y="163" fontSize="41" fontWeight="600" fill="#e7eeea">
        {stage === 0 ? "WATERTIGHT COMPARTMENTS" : stage === 1 ? "FIVE COMPARTMENTS FLOOD" : "HOW THE FLOODING SPREAD"}
      </text>
      <text x="109" y="199" fontSize="20" letterSpacing="4" fill="#a1bcc1">FORWARD HULL · SIDE CUTAWAY</text>
      <g transform={`rotate(${2.8 * spread} 952 470)`}>
        <path d={hull} fill="#142e3c" stroke="#819da6" strokeWidth="5" />
        <g clipPath={`url(#${id}-hull-clip)`}>
          <path d="M214 410h1500m-1490 47h1500" stroke="#91aab0" strokeWidth="3" opacity=".34" />
          <path d="M230 506h1490" stroke="#d3b78c" strokeWidth="2" strokeDasharray="7 11" opacity=".56" />
          {partitions.slice(0, -1).map((x, i) => {
            const top = i >= 2 && stage !== 0
              ? Math.min(708, waterTop + (1 - initial) * (6 - i) * 13)
              : i === 1 && spread > 0 ? 709 - spread * 111 : 710;
            const width = i === 6 ? 292 : partitions[i + 1] - x;
            return <g key={x}>
              <path d={`M${x} ${top}q${width/2} -8 ${width} 0v${713 - top}h-${width}Z`}
                fill={`url(#${id}-water)`} opacity=".88" />
              {top < 705 && <path d={`M${x} ${top}q${width/2} -8 ${width} 0`} stroke="#97d6d8" strokeWidth="3" fill="none" />}
              <path d={`M${x} 508V710`} stroke="#a5b6b7" strokeWidth="4" opacity=".75" />
            </g>;
          })}
          <path d="M224 644H1675" stroke="#547580" strokeWidth="2" opacity=".6" />
          {stage >= 2 && <g fill="none" stroke={amber} strokeWidth="5" strokeLinecap="round" opacity={arrow}>
            <path d="M753 512Q682 445 609 489Q584 504 552 545" pathLength="1" strokeDasharray={`${Math.max(.001, arrow)} 1`} />
            {arrow > .8 && <path d="M553 527l-1 19 21-6" />}
          </g>}
        </g>
      </g>
      <g fill="#a9c0c5" fontSize="20" letterSpacing="3">
        <text x="236" y="762">AFT</text>
        <text x="1704" y="762" textAnchor="end">BOW</text>
      </g>
      {stage >= 2 && <g fill={amber} opacity={arrow}>
        <path d="M614 463V302h301" stroke={amber} fill="none" strokeWidth="2" />
        <text x="640" y="289" fontSize="25" fontWeight="600">OVER THE BULKHEAD</text>
      </g>}
    </svg>
    <Plate file="inquiry-48.jpg" style={{right: 101, top: 84, width: 570, height: 165, opacity: .92 * evidence}} />
    <div style={{position: "absolute", right: 101, top: 255, color: "#cadad9", fontSize: 17, opacity: evidence}}>
      Original plate · British inquiry, 1912 · p. 48
    </div>
    <Label>Schematic reconstruction · 1912 British inquiry</Label>
  </AbsoluteFill>;
}

const intelScenes = new Set(["route", "collision", "flooding"]);

export function supportsIntelScene(scene: Scene) {
  return scene.historical && intelScenes.has(scene.historical.kind);
}

export function TitanicIntelPicture({scene, duration, captions, hold}: {scene: Scene; duration: number; captions: Caption[]; hold: boolean}) {
  const {kind, stage, eventSeconds} = scene.historical!;
  const id = `${scene.sceneId}${hold ? "-hold" : ""}-intel`;
  if (kind === "route") return <AtlanticChart stage={stage} duration={duration} />;
  if (kind === "collision") {
    const cueTime = scene.soundDesign?.cues?.find(({path}) => path.endsWith("/impact.m4a"))?.start;
    const contactFrame = Math.round((eventSeconds ?? cueTime ?? duration * .83 / FPS) * FPS);
    return <AtlanticContact id={id} stage={stage} duration={duration} impact={contactFrame} />;
  }
  return <FloodingCutaway id={id} duration={duration} stage={stage} captions={captions} />;
}
