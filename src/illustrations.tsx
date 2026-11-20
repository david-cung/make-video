import type {ReactNode} from "react";
import {AbsoluteFill, Img, random, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import type {Scene, VisualType} from "./types";

type Palette = {dark: string; middle: string; light: string};

const themes: Record<VisualType, Palette> = {
  surface: {dark: "#020817", middle: "#167f98", light: "#a2edf1"},
  trench: {dark: "#030913", middle: "#1c5a79", light: "#8cc4df"},
  vents: {dark: "#100d18", middle: "#886047", light: "#f6c89d"},
  brine: {dark: "#010c18", middle: "#238279", light: "#a3e1cd"},
  seep: {dark: "#020e16", middle: "#1a5256", light: "#b2e8c1"},
  whale: {dark: "#050b14", middle: "#556e7d", light: "#eadbc1"},
  abyss: {dark: "#020711", middle: "#236583", light: "#99d4e8"},
  abstract: {dark: "#070b18", middle: "#365a8e", light: "#b1cde8"},
};

export function scenePalette(scene: Scene): Palette {
  const [dark, middle, light] = scene.visualDirection.colorPalette;
  return dark && middle && light ? {dark, middle, light} : themes[scene.visualType];
}

const w = 1920;
const h = 1080;
const svgStyle = {position: "absolute", inset: 0, width: "100%", height: "100%"} as const;

function SeaSvg({children}: {children: ReactNode}) {
  return <svg style={svgStyle} viewBox={`0 0 ${w} ${h}`} aria-hidden>{children}</svg>;
}

const ridge = (y: number, turn: number, lift: number) =>
  `M-140 ${y + 205} L310 ${y + 40} 482 ${y - 17} 650 ${y + 33} 817 ${y - 62}
  958 ${y - 131} ${turn} ${y + 113} 1430 ${y - lift} 1550 ${y - lift - 39}
  1710 ${y - lift - 17} 2060 ${y - lift - 132}`;

export function OceanBackdrop({palette, visual, id}: {palette: Palette; visual: VisualType; id: string}) {
  const glow = visual === "surface" ? "70% 0%" : visual === "trench" ? "75% 27%" : "73% 38%";
  return <AbsoluteFill style={{background: `radial-gradient(ellipse at ${glow}, ${palette.middle}, ${palette.dark} 63%, #030711 94%)`}}>
    <SeaSvg>
      <defs>
        <linearGradient id={`${id}-ray`} x1="0" x2=".25" y1="0" y2="1" gradientUnits="objectBoundingBox">
          <stop stopColor={palette.light} stopOpacity=".25" />
          <stop offset="1" stopColor={palette.middle} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-ridge`} x2="0" y2="1">
          <stop stopColor={palette.middle} stopOpacity=".65" /><stop offset="1" stopColor={palette.dark} />
        </linearGradient>
      </defs>
      <path d="M1127 -130 L1310 -130 1765 1010 1033 950Z" fill={`url(#${id}-ray)`} />
      <path d="M1498 -70 L1550 -70 2020 870 1420 885Z" fill={`url(#${id}-ray)`} opacity=".57" />
      {[0, 1, 2].map(index => <path key={index}
        d={`${ridge(695 + index * 125, 1150 + 63 * index, 142 - 37 * index)} L2080 1250H-140Z`}
        fill={`url(#${id}-ridge)`} opacity={0.19 + index * 0.16} />)}
      {visual === "surface" && Array.from({length: 10}, (_, i) =>
        <path key={i} d={`M750 ${i * 16} Q1020 ${-75 + i * 15} 1286 ${i * 15} T2130 ${i * 15}`}
          stroke={palette.light} fill="none" strokeWidth={1 + i % 4} opacity={0.20 - i * 0.013} />)}
    </SeaSvg>
  </AbsoluteFill>;
}

const rockFaces = Array.from({length: 50}, (_, i) => {
  const x = random(`rock-x${i}`) * 2100 - 90;
  const y = 620 + random(`rock-y${i}`) * 500;
  const size = 20 + random(`rock-s${i}`) * 135;
  return {x, y, size, opacity: 0.12 + random(`rock-a${i}`) * 0.42};
});

function Foreground({palette}: {palette: Palette}) {
  return <SeaSvg>
    <path d={`${ridge(1002, 1210, 70)} L2110 1200H-160Z`} fill="#020711" opacity=".79" />
    {rockFaces.map(({x, y, size, opacity}, i) => <path key={i}
      d={`M${x} ${y} l${size * 0.37} -${size * 0.23} ${size * 0.51} ${size * 0.09} ${size * 0.23} ${size * 0.25}Z`}
      fill={palette.dark} stroke={palette.middle} strokeWidth=".8" opacity={opacity} />)}
  </SeaSvg>;
}

function LocalSubject({palette, id, children}: {palette: Palette; id: string; children: ReactNode}) {
  return <SeaSvg>
    <defs>
      <radialGradient id={`${id}-spot`}>
        <stop stopColor={palette.light} stopOpacity=".36" />
        <stop offset=".6" stopColor={palette.middle} stopOpacity=".26" />
        <stop offset="1" stopColor={palette.middle} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-body`} x2=".15" y2="1">
        <stop stopColor={palette.light} /><stop offset=".55" stopColor={palette.middle} /><stop offset="1" stopColor={palette.dark} />
      </linearGradient>
      <linearGradient id={`${id}-lamp`} x2="1" y2=".1">
        <stop stopColor={palette.light} stopOpacity=".83" /><stop offset="1" stopColor={palette.light} stopOpacity="0" />
      </linearGradient>
    </defs>
    <ellipse cx="1335" cy="531" rx="479" ry="388" fill={`url(#${id}-spot)`} />
    {children}
  </SeaSvg>;
}

function Submersible({id, palette, small}: {id: string; palette: Palette; small: boolean}) {
  return <g transform={small ? "translate(1225 570) scale(.62)" : "translate(1208 454) scale(1.04)"}>
    <path d="M105 0 L706 60 688 342 104 48Z" fill={`url(#${id}-lamp)`} opacity={small ? ".65" : ".42"} />
    <path d="M87 9 L720 135 720 229 86 32Z" fill={`url(#${id}-lamp)`} opacity=".79" />
    <path d="M-180 31 -428 -154" stroke={palette.light} strokeWidth="1.2" opacity=".39" />
    <path d="M-139 -39h177l74 38 5 45-56 35h-194l-48-34v-57Z" fill={`url(#${id}-body)`} stroke={palette.light} strokeWidth="3" />
    <path d="M-169 2h221l45 23-26 25h-235" fill={palette.dark} opacity=".92" />
    <path d="M-154 87H78L56 112h-229 M-125 -54h115l15 17h-151Z" fill={palette.dark} stroke={palette.middle} strokeWidth="5" />
    <rect x="-129" y="-26" width="44" height="76" rx="10" fill={palette.dark} stroke={palette.light} strokeWidth="1.2" />
    <rect x="-58" y="-29" width="45" height="77" rx="11" fill={palette.dark} stroke={palette.light} strokeWidth="1.2" />
    <circle cx="97" cy="20" r="17" fill="#dffcff" />
    <circle cx="-102" cy="7" r="4" fill={palette.light} />
    <circle cx="-34" cy="7" r="4" fill={palette.light} />
    <path d="M63 72l55 35 102 -7 25 16" fill="none" stroke={palette.middle} strokeWidth="9" />
  </g>;
}

function Trench({palette}: {palette: Palette}) {
  return <g transform="translate(1290 529) rotate(-14)">
    {Array.from({length: 33}, (_, i) => {
      const scale = 0.26 + i * 0.073;
      return <path key={i} transform={`translate(${i * 2}, ${i * 2}) scale(${scale} ${scale * 0.64})`}
        d="M-254 -119 C-180 -137 -125 -88 -53 -131 S72 -174 157 -108 244 -71 265 -20 241 64 175 87 138 131 76 119 15 76 -56 103 -172 142 -235 89 -287 18 -272 -29 -276 -89 -254 -119Z"
        fill="none" stroke={palette.light} strokeWidth={i % 5 === 0 ? 2.4 : 1} opacity={i % 5 === 0 ? 0.43 : 0.22} />;
    })}
    <circle cx="48" cy="4" r="48" fill="none" stroke={palette.light} strokeWidth="1.1" opacity=".66" />
    <circle cx="48" cy="4" r="3.5" fill="#dbf7ff" />
    <path d="M48 -61v25m0 80v25m-64-65h26m79 0h22" stroke={palette.light} fill="none" opacity=".73" />
  </g>;
}

function Vent({palette, id}: {palette: Palette; id: string}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <g>
    {[[1245, 741, 0.68], [1401, 840, 1.38], [1566, 786, 0.82], [1660, 808, 0.44]].map(([x,y,scale]) =>
      <path key={x} transform={`translate(${x}, ${y}) scale(${scale})`}
        d="M-114 20 -87 -25 -64 -53 -52 -116 -36 -159 -45 -207 -39 -255 -11 -288 19 -277 38 -256 38 -209 29 -170 59 -115 64 -60 103 -10 96 20Z"
        fill={`url(#${id}-body)`} stroke={palette.middle} strokeWidth="2" />)}
    {Array.from({length: 45}, (_, i) => {
      const t = ((frame / fps) * 0.17 + random(`vent:${i}`)) % 1;
      return <circle key={i} cx={1395 + t * 260 + Math.sin(i * 27) * (12 + t * 65)} cy={487 - t * 380}
        r={3 + t * 20} fill={palette.light} opacity={0.18 * (1 - t)} />;
    })}
  </g>;
}

function Brine({palette, id}: {palette: Palette; id: string}) {
  return <g transform="translate(1390 675) rotate(-13)">
    {Array.from({length: 11}, (_, i) =>
      <ellipse key={i} rx={485 - i * 21} ry={170 - i * 9} cy={i * -4} fill={i === 2 ? `url(#${id}-body)` : "none"}
        stroke={palette.light} strokeWidth={i === 2 ? 5 : 1.4} opacity={i === 2 ? 0.61 : 0.13 + i * 0.014} />)}
    <path d="M-354 -39 C-192 -137 43 -153 274 -96 M-259 53 C-27 96 215 63 322 8" stroke={palette.light} strokeWidth="3" opacity=".47" fill="none" />
  </g>;
}

function Seep({palette}: {palette: Palette}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <g>
    <path d="M1053 925 1198 812 1317 800 1397 755 1545 780 1738 725" stroke={palette.light} strokeWidth="3" opacity=".60" fill="none" />
    {Array.from({length: 41}, (_, i) => {
      const t = ((frame / fps) * 0.13 + random(`seep:y${i}`)) % 1;
      const spread = (random(`seep:x${i}`) - 0.5) * (50 + t * 340);
      return <circle key={i} cx={1408 + spread + t * 45} cy={771 - t * 570}
        r={2 + random(`seep:r${i}`) * 10} fill="none" stroke={palette.light} strokeWidth="1.5" opacity={(1 - t) * 0.65} />;
    })}
  </g>;
}

function Whale({palette}: {palette: Palette}) {
  const ribs = Array.from({length: 13}, (_, index) => {
    const x = index * 35;
    const arc = Math.sin((index + 3) / 17 * Math.PI) * 158;
    return {x, arc};
  });
  return <g transform="translate(1186 658) rotate(-18)">
    <ellipse cx="178" cy="29" rx="366" ry="96" fill="#06101a" opacity=".78" />
    {ribs.map(({x, arc}) => <path key={x} d={`M${x} 0 q${-75 + x * .07} ${-arc * 1.3} -21 ${-arc * 1.31} q65 0 81 ${arc * 1.04}`}
      fill="none" stroke={palette.light} strokeWidth="8" opacity=".69" strokeLinecap="round" />)}
    {ribs.map(({x, arc}) => <path key={x} d={`M${x} 5 q${-72 + x * .07} ${arc * .45} -26 ${arc * .68} q46 14 86 ${-arc * .21}`}
      fill="none" stroke={palette.light} strokeWidth="7" opacity=".45" strokeLinecap="round" />)}
    <path d="M-114 -6 Q104 16 268 3 T530 -37" stroke={palette.light} strokeWidth="13" strokeDasharray="18 5" fill="none" strokeLinecap="round" />
    <path d="M-105 -42 -159 -60 -215 -31 -306 -4 -294 26 -192 53 -126 35 -74 10Z M-286 20Q-211 49 -128 22" fill={palette.middle} stroke={palette.light} strokeWidth="4.5" />
    <ellipse cx="-175" cy="-13" rx="33" ry="18" fill={palette.dark} opacity=".88" />
  </g>;
}

function Abstract({palette}: {palette: Palette}) {
  return <g transform="translate(1337 530) rotate(-19)">
    {Array.from({length: 23}, (_, i) => <ellipse key={i} cx={i * 2} rx={125 + i * 12} ry={66 + i * 7}
      fill="none" stroke={palette.light} strokeWidth={i % 5 === 0 ? 2 : 1} opacity={i % 5 === 0 ? 0.55 : 0.22} />)}
    <path d="M-385 0H385 M0 -230V230" stroke={palette.light} opacity=".28" />
  </g>;
}

export function ArchiveAtmosphere({palette, children}: {palette: Palette; children: ReactNode}) {
  return <AbsoluteFill style={{opacity: 0.68}}>
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 78% -15%, ${palette.light}48, transparent 45%),
      radial-gradient(ellipse at 96% 82%, ${palette.middle}53, transparent 47%),
      linear-gradient(120deg, transparent 45%, ${palette.light}0c 60%, transparent 77%)`}} />
    {children}
  </AbsoluteFill>;
}

export function SceneSubject({scene, palette, id, archive = false, sports = false, fullBleed = false}: {
  scene: Scene; palette: Palette; id: string; archive?: boolean; sports?: boolean; fullBleed?: boolean;
}) {
  if (scene.image && fullBleed) {
    const src = staticFile(scene.image.path);
    const position = scene.image.objectPosition;
    if (!scene.portrait) return <Img src={src} style={{width: "100%", height: "100%", objectFit: "cover", objectPosition: position}} />;
    return <AbsoluteFill>
      <Img src={src} style={{
        width: "100%", height: "100%", objectFit: "cover", objectPosition: position,
        filter: "blur(24px) brightness(.56)", transform: "scale(1.07)",
      }} />
      <Img src={src} style={{
        position: "absolute", top: "7%", left: "10%", right: "10%", width: "80%", height: "86%",
        objectFit: "contain", objectPosition: position,
      }} />
    </AbsoluteFill>;
  }
  if (scene.image && sports) return <Img src={staticFile(scene.image.path)} style={{
    position: "absolute", top: scene.portrait ? 65 : 0, right: 0, height: "100%",
    width: scene.portrait ? "54%" : "76%", objectFit: "cover",
    objectPosition: scene.portrait ? `${scene.image.objectPosition.split(" ")[0]} top` : scene.image.objectPosition,
    maskImage: scene.portrait
      ? "linear-gradient(90deg, transparent 0%, #000 17%), linear-gradient(180deg, transparent 0%, #000 8%)"
      : "linear-gradient(90deg, transparent 3%, #000 34%)",
    maskComposite: scene.portrait ? "intersect" : undefined,
  }} />;
  if (scene.image) return <AbsoluteFill>
    <Img src={staticFile(scene.image.path)} style={{width: "100%", height: "100%", objectFit: "cover",
      objectPosition: scene.image.objectPosition, filter: archive ? "saturate(.77) sepia(.17) contrast(1.08) brightness(.86)"
        : "saturate(.72) contrast(1.08) brightness(.87)",
      maskImage: archive ? "none" : "linear-gradient(90deg, transparent 6%, #0002 26%, #000 64%)"}} />
    <AbsoluteFill style={{background: archive
      ? "linear-gradient(0deg, #0c0906b8, transparent 28%)"
      : `linear-gradient(115deg, ${palette.dark} 5%, transparent 63%, #04141919 100%)`}} />
  </AbsoluteFill>;
  const graphic = {
    surface: <Submersible id={id} palette={palette} small={false} />,
    trench: <Trench palette={palette} />,
    vents: <Vent id={id} palette={palette} />,
    brine: <Brine id={id} palette={palette} />,
    seep: <Seep palette={palette} />,
    whale: <Whale palette={palette} />,
    abyss: <Submersible id={id} palette={palette} small />,
    abstract: <Abstract palette={palette} />,
  }[scene.visualType];
  return <LocalSubject palette={palette} id={id}>{graphic}</LocalSubject>;
}

export function SceneForeground({palette, photographic}: {palette: Palette; photographic: boolean}) {
  return photographic ? null : <Foreground palette={palette} />;
}
