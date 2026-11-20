import type {ReactNode} from "react";
import {AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {AtmosphericParticles, DepthParallax, DramaticTextReveal, FilmGrain, VolumetricLight} from "./cinema";
import {captionLines} from "./timeline.mjs";
import type {Caption, Scene} from "./types";

type Colour = {dark: string; middle: string; light: string};
type Shot = {id: string; stage: number; palette: Colour; duration: number; imageFirst?: boolean};

const viewStyle = {position: "absolute", width: "100%", height: "100%"} as const;

function Field({children}: {children: ReactNode}) {
  return <svg viewBox="0 0 1920 1080" style={viewStyle} aria-hidden>{children}</svg>;
}

function progress(frame: number, first: number, last: number) {
  return interpolate(frame, [first, last], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
}

const seaBands = Array.from({length: 27}, (_, i) => ({
  x: random(`titanic-water-x-${i}`) * 1860,
  y: 668 + random(`titanic-water-y-${i}`) * 440,
  w: 80 + random(`titanic-water-w-${i}`) * 390,
  alpha: 0.025 + random(`titanic-water-a-${i}`) * 0.11,
}));

export function OceanAtmosphere({palette, submerged, chart}: {
  palette: Colour; submerged: boolean; chart: boolean;
}) {
  const frame = useCurrentFrame();
  if (chart) {
    return <AbsoluteFill style={{background: `radial-gradient(ellipse at 74% 48%, ${palette.middle}90, transparent 59%), ${palette.dark}`}} />;
  }
  return <AbsoluteFill style={{background: submerged
    ? `radial-gradient(ellipse at 60% 10%, ${palette.middle}ba, transparent 65%), linear-gradient(160deg, ${palette.dark}, #05151f)`
    : `radial-gradient(ellipse at 72% 60%, ${palette.middle}, ${palette.dark} 69%), ${palette.dark}`}}>
    <AbsoluteFill style={{
      transform: `translateX(${Math.sin(frame / 160) * 28}px)`,
      opacity: submerged ? 0.27 : 0.38,
      background: `radial-gradient(ellipse 50% 3% at 74% 57%, ${palette.light}77, transparent), radial-gradient(ellipse 47% 9% at 62% 52%, ${palette.middle}, transparent)`,
    }} />
  </AbsoluteFill>;
}

function MovingWater({palette}: {palette: Colour}) {
  const frame = useCurrentFrame();
  return <Field>
    <path d="M0 663Q495 648 990 659T1920 655V1080H0Z" fill={palette.dark} opacity=".63" />
    <path d="M0 663Q495 648 990 659T1920 655" fill="none" stroke={palette.light} opacity=".23" strokeWidth="2" />
    <g fill="none" stroke={palette.light}>
      {seaBands.map(({x, y, w, alpha}, i) => <path key={i}
        transform={`translate(${Math.sin(frame / (60 + i * 3) + i) * (15 + y / 35)} ${Math.cos(frame / 81 + i) * 3})`}
        d={`M${x} ${y}q${w * .48} -8 ${w} 1`} strokeWidth={y > 890 ? 2 : 1} opacity={alpha} />)}
    </g>
  </Field>;
}

export function ShipSilhouette({id, dark, light, carpathia = false, detailed = false}: {
  id: string; dark: string; light: string; carpathia?: boolean; detailed?: boolean;
}) {
  const funnels = carpathia ? [435] : [274, 372, 470, 568];
  return <g>
    <defs>
      <linearGradient id={`${id}-hull`} x2="0" y2="1">
        <stop stopColor="#354955" /><stop offset=".40" stopColor={dark} /><stop offset="1" stopColor="#322b32" />
      </linearGradient>
      <linearGradient id={`${id}-funnel`}><stop stopColor="#38404a" /><stop offset=".55" stopColor="#96816b" /><stop offset="1" stopColor="#4c4748" /></linearGradient>
    </defs>
    <path d="M90-43 112-64H699L752-41Z" fill="#5f6d75" />
    <path d={carpathia ? "M275-64 309-88H541L586-64Z" : "M160-67 177-99H674L701-65Z"} fill="#93999a" />
    {detailed && <g>
      <path d="M112-62H699M167-79H690M186-94H670M92-45H753" stroke={light} strokeOpacity=".49" strokeWidth="1.8" />
      <path d="M110-47h645M183-101h474" stroke="#151f22" strokeWidth="5" />
      {Array.from({length: 53}, (_, i) => <g key={i} transform={`translate(${151 + 11 * i} -68)`}>
        <path d="M0 18V-8" stroke="#262e34" strokeWidth="2.1" />
        {i > 4 && i < 45 && <path d={`M0 -17h${i % 3 ? "4.4" : "2.4"}`} stroke="#e8c084" opacity={i % 6 ? ".78" : ".28"} strokeWidth="3.5" />}
      </g>)}
      {!carpathia && [204, 250, 331, 386, 491, 548, 606, 660].map((x) => <g key={x} transform={`translate(${x} -93)`}>
        <path d="M-12 1q10 4 26-1l-4 6h-16Z" fill="#6f766f" stroke="#c5baa3" strokeWidth=".7" />
        <path d="M-8 -2v-6h6m13 6v-6H7" stroke="#939991" fill="none" strokeWidth="1.3" />
      </g>)}
      <path d="M10-36h102m638 0h105M145-181l-61 149m622-149 82 151" stroke={light} opacity=".42" fill="none" strokeWidth="1.4" />
    </g>}
    {funnels.map((x) => <g key={x} transform={`translate(${x} -147) skewX(-8)`}>
      <path d="M0 53 4 0H35L43 53Z" fill={`url(#${id}-funnel)`} />
      <path d="M4 0h31l2 11H3Z" fill="#10171c" />
      <path d="M8 2h23" stroke={light} opacity=".5" />
    </g>)}
    <path d="M136-58 145-184M719-46 706-182M145-180Q435-102 706-180" fill="none" stroke={light} strokeWidth="1.8" opacity=".47" />
    <path d="M0-26 72-36 752-37 831-16 881-28Q867 13 801 52Q501 80 113 57Q40 47 0-26Z" fill={`url(#${id}-hull)`} />
    <path d="M7-24 72-36 752-37 831-16 878-27M32 21Q454 44 819 23" fill="none" stroke={light} strokeWidth="2.5" opacity=".44" />
    {detailed && <path d="M41-7 114-13 751-11 823 5M47 30Q455 52 805 34" fill="none" stroke="#9a765b"
      strokeOpacity=".44" strokeWidth="1.8" />}
    {Array.from({length: 31}, (_, i) => <path key={i}
      d={`M${119 + i * 21} -54h5m-5 14h5m-5 17h5`}
      stroke={i % 4 ? "#ead4a8" : light} strokeWidth="3" opacity={i % 6 ? ".76" : ".27"} />)}
  </g>;
}

export function TitanicShipScene({id, stage, palette, duration, imageFirst}: Shot) {
  const frame = useCurrentFrame();
  const t = progress(frame, 0, duration - 1);
  const sinking = stage === 5;
  const x = stage === 4 ? 820 : stage === 3 ? 975 : 823;
  const shipOpacity = sinking ? 1 - progress(frame, duration * .62, duration - 1) * .56 : 1;
  const waterline = sinking && imageFirst ? `${id}-surface` : undefined;
  return <Field>
    {waterline && <defs><clipPath id={waterline}>
      <path d="M0 0H1920V692Q1410 678 1050 688T0 688Z" />
    </clipPath></defs>}
    <ellipse cx="1320" cy="634" rx="670" ry="88" fill={palette.middle} opacity=".23" />
    <g clipPath={waterline ? `url(#${waterline})` : undefined}>
      <g transform={`translate(${x + t * 20} ${620 + (sinking ? t * 124 : Math.sin(frame / 36) * 3)}) rotate(${sinking ? 7 + t * 13 : -2} 470 0) scale(${stage === 3 ? .89 : 1.06})`}
        opacity={shipOpacity}>
        <ShipSilhouette id={id} dark={palette.dark} light={palette.light} carpathia={stage === 3} detailed={imageFirst} />
      </g>
    </g>
    {sinking && !imageFirst && <path d="M720 670Q1110 650 1450 668T1920 661V1080H720Z" fill={palette.dark} opacity=".85" />}
    {stage === 1 && <g stroke={palette.light} fill={palette.light} opacity=".84">
      <path d="M860 792h900M860 779v26m900-26v26" fill="none" strokeWidth="2" />
      <text x="1310" y="840" textAnchor="middle" fontSize="27" letterSpacing="5" stroke="none">269 METRES</text>
    </g>}
    {stage === 2 && <g transform="translate(1510 761)" stroke={palette.light} fill="none" opacity=".58">
      {[38, 68, 100].map((r) => <circle key={r} r={r} strokeWidth="1.5" strokeDasharray="8 7" />)}
      <g transform={`rotate(${frame * .48})`}>
        <path d="M0-82Q35-68 16-17L0 0Q-28-21 0-82ZM71 41Q42 64 6 23L0 0Q31-12 71 41ZM-71 41Q-77 5-24-6L0 0Q-3 33-71 41Z" fill={palette.middle} strokeWidth="2" />
      </g>
      <text x="-115" y="130" fill={palette.light} stroke="none" fontSize="21" letterSpacing="4">TRIPLE-SCREW PROPULSION</text>
    </g>}
  </Field>;
}

export function IcebergCollisionScene({id, stage, palette, duration, imageFirst}: Shot) {
  const frame = useCurrentFrame();
  const motion = progress(frame, 0, duration - 1);
  const berg = stage === 0 ? 1655 - motion * 35 : 1677 - motion * 114;
  return <Field>
    <defs><linearGradient id={`${id}-ice`} x2="1" y2="1">
      <stop stopColor={palette.light} /><stop offset="1" stopColor={palette.middle} />
    </linearGradient></defs>
    <g transform={`translate(${berg} 675)`} opacity={stage ? .92 : .67 + motion * .13}>
      <path d="M-250 7-194-18-124-79-72-105-19-172 41-124 78-119 121-53 227 12Z" fill={`url(#${id}-ice)`} />
      <path d="M-19-172 15-85 121-53 227 12 78-119 41-124Z" fill="#b9ccd7" opacity=".61" />
      <path d="M-19-172-64-81-122-57-120 7-33 10 15-85Z" fill="#314c60" opacity=".72" />
      <path d="M-245 15Q0 3 229 14" stroke={palette.light} opacity=".45" fill="none" />
    </g>
    <g transform={`translate(${755 + motion * (stage ? 131 : 68)} 634) scale(.85)`}>
      <ShipSilhouette id={id} dark={palette.dark} light={palette.light} detailed={imageFirst} />
    </g>
    {stage === 1 && <path d="M1300 698h295" stroke={palette.light} strokeDasharray="5 14" strokeWidth="4"
      opacity={progress(frame, duration * .32, duration * .53) * .65} />}
  </Field>;
}

export function FloodingScene({id, stage, palette, duration}: Shot) {
  const frame = useCurrentFrame();
  const spill = stage === 3 ? progress(frame, duration * .48, duration * .91) : 0;
  const ceiling = stage === 0 ? 0 : stage === 2 ? 7 : 5;
  return <Field>
    <g transform="translate(850 390)">
      <defs><clipPath id={`${id}-section`}><path d="M0 38H920L872 178Q834 261 704 267H76Q19 239 0 38Z" /></clipPath></defs>
      <text x="4" y="-38" fill={palette.light} fontSize="23" letterSpacing="6">FORWARD COMPARTMENTS</text>
      <path d="M0 38H920L872 178Q834 261 704 267H76Q19 239 0 38Z"
        fill={palette.dark} stroke={palette.light} strokeWidth="3" />
      <g clipPath={`url(#${id}-section)`}>
        {[0, 1, 2, 3, 4, 5, 6].map((n) => {
          const x = 38 + n * 126;
          const onset = (6 - n) * duration / (stage === 3 ? 36 : 18);
          const stageFill = stage === 2 && n > 1 ? 159 : stage === 3 ? 104 + spill * 65 : 92;
          const amount = n >= 7 - ceiling ? progress(frame, onset, onset + duration * (stage === 3 ? .30 : .48)) * stageFill
            : n === 1 ? spill * 108 : n === 0 ? Math.max(0, spill - .55) * 90 : 0;
          const y = 258 - amount;
          return <g key={n}>
            <path d={`M${x} ${y}q60 -10 126 0v${amount}H${x}Z`} fill="#456f8b" opacity=".87" />
            {amount > 1 && <path d={`M${x} ${y}q60 -10 126 0`} stroke="#81b7cd" strokeWidth="2" fill="none" />}
            <path d={`M${x} 98V270`} stroke={palette.light} strokeWidth="3" opacity=".63" />
          </g>;
        })}
        <path d="M0 97H920M0 137H914" stroke={palette.light} opacity=".32" fill="none" strokeDasharray="7 10" />
        {spill > 0 && <g opacity={Math.min(1, spill * 4)} fill="none" stroke="#a9d6e3" strokeWidth="6" strokeLinecap="round">
          <path d="M386 100Q314 60 254 126" pathLength="1" strokeDasharray={`${Math.min(1, spill * 2.4)} 1`} />
          {spill > .44 && <path d="M254 106l0 20 18 -7" />}
        </g>}
      </g>
      <path d="M16 312H926" stroke={palette.light} opacity=".40" strokeWidth="2" />
      <text x="16" y="353" fill={palette.light} opacity=".82" fontSize="20" letterSpacing="4">STERNWARD</text>
      <text x="926" y="353" textAnchor="end" fill={palette.light} opacity=".82" fontSize="20" letterSpacing="4">TOWARDS THE BOW</text>
    </g>
  </Field>;
}

const northAtlantic = {
  west: "M0 0H221L271 69 239 99 275 120 257 154 294 161 268 183 194 185 158 214 115 220 108 251 80 270 64 330 0 381Z",
  east: "M840 0H1020V420L958 390 943 346 909 327 893 294 916 278 922 231 873 223 842 188 871 166 889 137 848 106 856 75 834 48Z",
  ireland: "M750 168 759 145 785 137 807 146 806 166 780 185 753 187Z",
  britain: "M845 93 856 108 848 137 865 157 858 183 839 209 801 211 817 192 816 181 828 170 815 155 832 140 821 115Z",
  greenland: "M320 0H551L529 58 509 75 464 41 431 47 396 34Z",
};

export function HistoricalMap({stage, palette, duration}: Shot) {
  const frame = useCurrentFrame();
  const draw = progress(frame, 12, Math.max(13, duration * .64));
  return <Field>
    <g transform="translate(775 234) scale(1.02)">
      <rect width="1020" height="570" rx="8" fill="#101f2b" stroke={palette.light} strokeOpacity=".44" />
      <g transform="translate(30 54) scale(.94)">
        {[105, 195, 285, 375].map((y) => <path d={`M1 ${y}H1019`} stroke={palette.light} opacity=".19" key={y} />)}
        {[120, 280, 440, 600, 760, 920].map((x) => <path d={`M${x} 1V416`} stroke={palette.light} opacity=".18" key={x} />)}
        {Object.values(northAtlantic).map((geo, i) => <path key={i} d={geo} fill={palette.middle} stroke="#6d858d" strokeWidth="2" />)}
        <text x="408" y="169" fill="#a8bec2" fontSize="24" letterSpacing="7">NORTH ATLANTIC</text>
        <path d="M85 283Q209 240 348 247" fill="none" stroke="#abc0c7" strokeDasharray="8 9" strokeWidth="3" />
        <path d="M839 210 850 232 772 186Q642 193 548 231T348 247"
          fill="none" stroke={palette.light} strokeWidth="5" strokeLinecap="round" pathLength="1"
          strokeDasharray={`${Math.max(.001, draw)} 1`} />
        {[[839,210],[850,232],[772,186],[348,247],[85,283]].map(([x,y], i) =>
          <circle key={i} cx={x} cy={y} r={i === 3 ? 8 : 5} fill={i === 3 && stage ? "#eea986" : palette.light} />)}
        <text x="85" y="319" fill="#e4e9e9" fontSize="21">NEW YORK</text>
        <text x="350" y="290" fill="#e4e9e9" fontSize="21" textAnchor="middle">COLLISION AREA</text>
        {stage > 0 && <g fill="#b9ced6" opacity={.48 + draw * .32}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} d={`M${279+i*26} ${183+(i%3)*16}l8-14 9 14Z`} />)}
        </g>}
        {stage === 3 && <g fill="#eebe8f" stroke="#eebe8f">
          <path d="M475 330Q402 309 350 247" pathLength="1" fill="none" strokeWidth="5"
            strokeDasharray={`${Math.max(.001, draw)} 1`} />
          <text x="483" y="354" fontSize="22" stroke="none">CARPATHIA</text>
        </g>}
      </g>
      <text x="32" y="35" fill={palette.light} fontSize="20" letterSpacing="5">ROUTE CHART · SCHEMATIC</text>
      <text x="32" y="520" fill="#dbe5e9" fontSize="22">
        {stage === 2 ? "Atlantic ice monitoring · indicative area" : "Southampton   →   Cherbourg   →   Queenstown   →   Atlantic"}
      </text>
    </g>
  </Field>;
}

const nightEvents = [
  ["23:40", "Collision"], ["AFTER 00:00", "Distress signals"], ["≈ 00:25", "Carpathia answers"],
  ["≈ 00:45", "Early boat launches"], ["AFTER 02:00", "Final boats"], ["02:20", "Sinking"],
];

export function AnimatedTimeline({stage, palette, duration, label}: Shot & {label: string}) {
  const frame = useCurrentFrame();
  if (stage === 6) {
    const travel = progress(frame, duration * .10, duration * .61);
    const arrival = progress(frame, duration * .51, duration * .69);
    return <Field>
      <g transform="translate(302 238)">
        <text y="18" fontSize="25" letterSpacing="5" fill={palette.light}>{label}</text>
        <text x="3" y="176" fontSize="64" fontWeight="700" fill="#e4ebeb">23:40</text>
        <text x="1316" y="176" fontSize="64" textAnchor="end" fontWeight="700" fill={palette.light}
          opacity={.43 + .57 * arrival}>02:20</text>
        <path d="M8 257H1311" stroke="#90aab8" strokeWidth="3" opacity=".48" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => <path key={index}
          d={`M${8 + index * 186.14} 243v28`} stroke="#90aab8" strokeWidth="2" opacity=".62" />)}
        <path d={`M8 257h${1303 * travel}`} stroke={palette.light} strokeWidth="5" />
        <circle cx={8 + 1303 * travel} cy="257" r="10" fill={palette.light} />
        <text x="8" y="331" fontSize="26" letterSpacing="5" fill="#c0d0d7">COLLISION</text>
        <text x="1316" y="331" fontSize="26" letterSpacing="5" textAnchor="end" fill="#c0d0d7" opacity={.43 + .57 * arrival}>SINKING</text>
        <text x="660" y={413 - 16 * arrival} fontSize="49" fontWeight="600" fill={palette.light}
          opacity={arrival} textAnchor="middle">2 HOURS 40 MINUTES</text>
      </g>
    </Field>;
  }
  const status = progress(frame, 6, Math.min(duration - 1, 46));
  const events = stage === 0
    ? [["MORNING", "Ice reports"], ["EVENING", "Mesaba warning"], ["LATE NIGHT", "Californian stops"]]
    : stage === 5
      ? [["1912", "Inquiries"], ["1914", "SOLAS and ice patrol"], ["LATER", "Rules develop"]]
      : nightEvents;
  const active = stage === 0 || stage === 5 ? 1 : stage === 7 ? 5 : stage;
  const dx = 850 / (events.length - 1);
  return <Field>
    <g transform="translate(875 300)">
      <rect x="-35" width="940" height="466" rx="8" fill="#0e2330" stroke={palette.light} strokeOpacity=".27" />
      <text x="0" y="57" fill={palette.light} fontSize="20" letterSpacing="4">{label}</text>
      <path d="M0 238h850" stroke={palette.light} strokeOpacity=".30" strokeWidth="2" />
      <path d={`M0 238h${dx * active * status}`} stroke={palette.light} strokeWidth="4" />
      {events.map(([date, event], i) => <g key={date} transform={`translate(${dx * i} 238)`} opacity={i === active ? 1 : .55}>
        <circle r={i === active ? 8 + status * 4 : 5} fill={palette.light} />
        <path d={i % 2 ? "M0 12v39" : "M0-12v-39"} stroke={palette.light} strokeWidth="2" />
        <text x={i === 0 ? 0 : i === events.length - 1 ? -2 : 0} y={i % 2 ? 78 : -90}
          textAnchor={i === 0 ? "start" : i === events.length - 1 ? "end" : "middle"}
          fill={palette.light} fontSize={i === active ? 23 : 17} fontWeight="600">{date}</text>
        <text y={i % 2 ? 105 : -63} textAnchor={i === 0 ? "start" : i === events.length - 1 ? "end" : "middle"}
          fill="#e3ebed" fontSize="17">{event}</text>
      </g>)}
      <text x="0" y="429" fill="#a6bdc3" fontSize="18" letterSpacing="3">EVENTS SHOWN IN SEQUENCE · SPACING NOT TO SCALE</text>
    </g>
  </Field>;
}

function BoatCapacity({duration, palette, stage}: Shot) {
  const frame = useCurrentFrame();
  const fill = progress(frame, 12, duration * .72);
  const rows = [
    {label: "PEOPLE ABOARD", value: "About 2,200", fraction: 1, color: "#89b5cc"},
    {label: "TOTAL BOAT CAPACITY", value: "1,178", fraction: 1178 / 2200, color: "#edb681"},
    ...(stage ? [{label: "SURVIVED", value: "About 700", fraction: 700 / 2200, color: "#9bbeb6"}] : []),
  ];
  return <Field>
    <g transform="translate(292 241)">
      {rows.map(({label, value, fraction, color}, index) => <g key={label} transform={`translate(0 ${index * (stage ? 168 : 230)})`}>
        <text x="0" y="32" fill={palette.light} fontSize="27" fontWeight="600" letterSpacing="5">{label}</text>
        <text x="1300" y="39" fill={color} fontSize="62" fontWeight="700" textAnchor="end">{value}</text>
        <rect y="61" width="1300" height="61" rx="3" fill="#9bb0bb" opacity=".14" />
        <rect y="61" width={1300 * fraction * fill} height="61" rx="3" fill={color} />
        {[.25, .5, .75].map((mark) => <path key={mark} d={`M${1300 * mark} 57v68`} stroke="#10202b" strokeWidth="2" opacity=".67" />)}
      </g>)}
    </g>
  </Field>;
}

function HistoricalDetail({id, stage, duration, palette}: Shot) {
  const frame = useCurrentFrame();
  const time = progress(frame, 0, duration - 1);
  const wireless = stage === 1;
  const hull = stage === 0;
  const letter = stage === 3;
  return <Field>
    <defs>
      <linearGradient id={`${id}-detail`} x2="0" y2="1">
        <stop stopColor={palette.middle} /><stop offset="1" stopColor={palette.dark} />
      </linearGradient>
    </defs>
    <g transform={`translate(${235 - time * 28} 203)`}>
      {letter ? <>
        <path d="M-30 503 45 115 504 10 1395 150 1482 544 1044 678 261 660Z"
          fill={`url(#${id}-detail)`} stroke="#677378" strokeWidth="5" />
        <path d="M85 138 368 373l-120 258M1377 180 1071 384l133 212M256 587q470-159 950-16"
          fill="none" stroke="#9fa69a" strokeOpacity=".46" strokeWidth="6" strokeDasharray="10 9" />
        <g transform={`translate(535 ${299 - time * 72}) rotate(-9)`}>
          <path d="M-12 9 452-8 474 262 7 285Z" fill="#1b1a17" opacity=".45" />
          <path d="M0 0 452-9 461 262 7 281Z" fill="#d4c198" stroke="#ebd8a9" strokeWidth="3" />
          <path d="M3 128 456 119" fill="none" stroke="#8f7955" opacity=".57" strokeWidth="3" />
          {[207, 225, 243].map((y) => <path key={y} d={`M35 ${y}h124m13 0h71m17 0h132`}
            fill="none" stroke="#796c57" opacity=".22" strokeWidth="2.5" />)}
        </g>
        <path d="M489 464 1038 409 1080 579 525 634Z" fill="#354a53" stroke="#8d9690" strokeWidth="4" />
        <path d="M503 474 1031 424" fill="none" stroke="#a1a08d" strokeWidth="5" strokeDasharray="9 8" />
      </> : hull ? <>
        <path d="M-70 44 1503-10 1470 590-130 655Z" fill={`url(#${id}-detail)`} stroke={palette.light} strokeOpacity=".45" strokeWidth="4" />
        {[95, 290, 495].map((y) => <g key={y}>
          <path d={`M-61 ${y + 58} 1472 ${y}`} stroke={palette.light} strokeOpacity=".4" strokeWidth="4" />
          {Array.from({length: 32}, (_, i) => <circle key={i} cx={i * 47 - 34} cy={y + 62 - i * 1.85} r={9 - i / 13}
            fill={palette.dark} stroke={palette.light} strokeWidth="2" strokeOpacity=".55" />)}
        </g>)}
        <path d={`M80 390q520 -68 ${1010 * time} -51`} fill="none" stroke="#df9c78" strokeOpacity={time * .85} strokeWidth="7" strokeDasharray="14 18" />
      </> : wireless ? <>
        <rect x="78" y="20" width="1270" height="605" rx="14" fill={`url(#${id}-detail)`} stroke={palette.light} strokeWidth="3" />
        <rect x="151" y="126" width="1118" height="272" rx="11" fill="#142029" stroke="#82949a" strokeWidth="3" />
        {[268, 465, 1018, 1160].map((x) => <g key={x}>
          <circle cx={x} cy="282" r="54" fill="#243640" stroke="#aabead" strokeWidth="4" />
          <path d={`M${x} 282l22 -33`} stroke="#e0bd89" strokeWidth="5" />
        </g>)}
        <path d={`M578 266h36v-35h35v35h35v-35h69v35h35v-35h35v35h35`}
          transform={`translate(0 ${Math.sin(frame / 11) * 6})`} fill="none" stroke="#e2bd89" opacity={.35 + .55 * time} strokeWidth="7" />
        <path d="M496 544h450m-364 -41 158 -41 118 39" stroke="#879ea6" strokeWidth="14" fill="none" />
        <circle cx="740" cy="462" r="24" fill="#b18c59" />
      </> : <>
        <path d="M0 563Q292 460 1510 490V692H0Z" fill={`url(#${id}-detail)`} stroke="#778d94" strokeWidth="4" />
        <path d="M127 558V266Q127 84 372 84h109M1059 517V250q0-166 241-166h122" fill="none" stroke="#9caaa6" strokeWidth="18" />
        <path d="M452 85v290m933-290v270" fill="none" stroke="#c9baa1" strokeWidth="5" />
        <path d="M290 365q498 72 1200-29-81 107-448 145-589 59-752-116Z" fill="#11232d" stroke="#b3b0a3" strokeWidth="7" />
        <path d="M330 388q453 61 1088-26" fill="none" stroke="#819da3" strokeWidth="3" />
      </>}
    </g>
  </Field>;
}

export function LifeboatScene({stage, palette, duration}: Shot) {
  const frame = useCurrentFrame();
  const p = progress(frame, 0, duration - 1);
  const davit = stage < 3;
  const position = davit ? 610 + p * (stage === 0 ? 19 : 96) : 742 + 8 * Math.sin(frame / 43);
  return <Field>
    {davit && <g opacity=".76">
      <path d="M775 373H1920V605H775Z" fill="#16232c" stroke="#789099" />
      <path d="M775 387H1920M775 426H1920M775 536H1920" stroke="#b2c2bb" strokeOpacity=".34" strokeWidth="4" />
      <path d="M1160 535V379Q1160 327 1247 327h31M1538 535V379Q1538 327 1597 327h34"
        stroke={palette.light} strokeWidth="7" fill="none" />
      <path d={`M1264 328 1227 ${position}M1620 328 1601 ${position}`} stroke={palette.light} opacity=".68" strokeWidth="2" />
    </g>}
    <g transform={`translate(${davit ? 1160 : 1100 + p * 90} ${position}) rotate(${Math.sin(frame / 43) * 1.5} 260 20)`}>
      {Array.from({length: stage === 0 ? 2 : 8}, (_, i) =>
        <g key={i} transform={`translate(${80 + 39 * i} ${-9 - (i % 3) * 5})`} fill="#8f9898">
          <circle r="10" /><path d="M-18 19Q-9-1 1 0 13 0 18 19Z" />
        </g>)}
      <path d="M0 10Q214 40 540 2Q496 82 140 72 39 64 0 10Z" fill={palette.dark} stroke={palette.light} strokeWidth="4" />
      <path d="M30 30Q249 57 507 27" stroke={palette.light} strokeWidth="2" opacity=".46" fill="none" />
      {!davit && <path d="M150 39l-61 67m146-65-48 89m120-91-28 107m118-114-14 114" stroke={palette.light}
        strokeWidth="4" opacity={.52 + .2 * Math.sin(frame / 23)} />}
    </g>
  </Field>;
}

export function UnderwaterWreckScene({id, stage, palette, duration, imageFirst}: Shot) {
  const frame = useCurrentFrame();
  const sweep = 1260 + 106 * Math.sin(frame / 130);
  const reveal = progress(frame, 0, duration * .50);
  return <Field>
    <defs>
      <radialGradient id={`${id}-beam`}>
        <stop stopColor="#c3ece2" stopOpacity=".48" /><stop offset="1" stopColor="#8cd4d4" stopOpacity="0" />
      </radialGradient>
    </defs>
    <path d="M0 733Q572 686 1014 732T1920 704V1080H0Z" fill="#12343e" opacity=".60" />
    <ellipse cx={sweep - (imageFirst ? 345 : 0)} cy="634" rx="630" ry="290" fill={`url(#${id}-beam)`} />
    <g transform={imageFirst ? "translate(-345 -33)" : undefined}>
    {stage === 0 && <g transform="translate(1157 542)" fill="none" stroke={palette.light}>
      {[110, 208, 311].map((r, i) => <ellipse key={r} rx={r + 70} ry={r * .58} opacity={.12 + .12 * Math.sin(frame / 45 + i)} />)}
      <path d="M-370 0h740M0-212v424" opacity=".38" />
      {seaBands.slice(0, 14).map((_, i) =>
        <circle key={i} cx={-245 + i * 43} cy={Math.cos(i * 2.1) * 95} r={i % 4 + 2} fill={palette.light}
          opacity={progress(frame, 10 + i * 10, 39 + i * 10) * .78} />)}
      <text x="-175" y="236" fill={palette.light} stroke="none" fontSize="23" letterSpacing="6">SEA FLOOR SURVEY</text>
    </g>}
    {stage === 1 && <g transform={`translate(${1290 + reveal * 36} 565) rotate(-11)`} opacity={.55 + reveal * .45}>
      <path d="M0-130h249a78 130 0 0 1 0 260H0Z" fill="#415458" stroke="#829e9b" strokeWidth="4" />
      {[39, 89, 140, 190].map((x) => <path key={x} d={`M${x} -130q102 113 0 260`} stroke="#70847f" strokeWidth="3" fill="none" />)}
      <ellipse rx="92" ry="130" fill="#263a3e" stroke="#8ca9a5" strokeWidth="4" />
      {[-56, 0, 56].map((y) => <ellipse key={y} cx="-10" cy={y} rx="31" ry="22" fill="#0c242c" stroke="#8ba39a" strokeWidth="4" />)}
    </g>}
    {stage >= 2 && <g transform={`translate(${stage === 2 ? 1180 : 1020} 693) rotate(-8) scale(${stage === 2 ? .77 : 1.05})`}>
      <path d="M0 22 25-57 63-29 99-62 167-53 202-98 253-70 439-55 581-35 696-2Q644 80 504 105L45 83Z"
        fill="#2d4b4e" stroke="#78958f" strokeWidth="4" />
      <path d="M12 14 150 3 331-17 563-26 696-2Q495 26 199 50L5 52Z" fill="#617a72" opacity=".67" />
      <path d="M194-55 247-66 264-39 336-56 388-44 427-55M36 30Q390 30 662 0M95 63Q349 79 603 40"
        fill="none" stroke="#a9bdb1" strokeWidth="2.8" opacity=".6" />
      {Array.from({length: 15}, (_, i) => <path key={i} d={`M${210 + i * 25} ${-15 - i * 1.7}v${20 + (i % 5) * 6}`}
          stroke={i % 3 ? "#8d8a72" : "#486763"} opacity=".55" strokeWidth="2" />)}
      <path d="M507-28 486-125M487-125l146 104" fill="none" stroke="#839f96" strokeWidth="3" opacity=".68" />
      {stage === 2 && <g>
        <path d="M-380 44-341-49-288-34-231-46-186-7-205 51-321 68Z" fill="#445f60" stroke="#819a91" strokeWidth="2" />
        <path d="M-334-18-309 20-241 24m-85 12 103-8m46 17 16-14 28 22m33-3 13-10 27 6" stroke="#9ab0a8" strokeWidth="3" fill="none" opacity=".61" />
      </g>}
    </g>}
    {stage === 3 && <g transform={`translate(${1168 + reveal * 177} ${450 + Math.sin(frame / 47) * 16})`}>
      <path d="M60 28 285-26 276 140 60 57Z" fill="#aed8ca" opacity=".18" />
      <rect x="-40" y="-30" width="111" height="77" rx="7" fill="#d0b873" stroke="#385961" strokeWidth="6" />
      <path d="M-44-28-23-62h89m-106 113h113M-30 45l-7 29m92-29 8 29" stroke="#829da1" strokeWidth="5" fill="none" />
      <circle cx="66" cy="11" r="12" fill="#d9f3e3" />
    </g>}
    </g>
  </Field>;
}

function TitanicArchive({scene, fullBleed}: {scene: Scene; fullBleed: boolean}) {
  const image = scene.image;
  if (!image) return null;
  const portrait = scene.portrait ?? image.path.endsWith("headlines.jpg");
  if (fullBleed) {
    const source = staticFile(image.path);
    return <AbsoluteFill style={{background: "#10181b"}}>
      {portrait && <Img src={source} style={{width: "100%", height: "100%", objectFit: "cover",
        opacity: .36, filter: "blur(30px) grayscale(1)"}} />}
      <Img src={source} style={{...viewStyle, objectFit: portrait ? "contain" : "cover",
        padding: portrait ? "38px 0" : undefined, boxSizing: "border-box", objectPosition: image.objectPosition,
        filter: "grayscale(1) sepia(.18) contrast(1.07)"}} />
    </AbsoluteFill>;
  }
  return <AbsoluteFill style={{justifyContent: "center"}}>
    <div style={{position: "absolute", left: 837, top: 202, width: 934, height: 632,
      padding: "10px", border: "1px solid #ced2cc78", background: "#152028",
      boxShadow: "0 22px 70px #03090e", transform: scene.historical?.stage === 1 ? "rotate(-1deg)" : "rotate(.5deg)"}}>
      <Img src={staticFile(image.path)} style={{display: "block", width: "100%", height: "100%",
        objectFit: portrait ? "contain" : "cover", objectPosition: image.objectPosition,
        filter: "grayscale(1) sepia(.17) contrast(1.02) brightness(.94)"}} />
    </div>
  </AbsoluteFill>;
}

export function CinematicChapterTitle({scene, cover, subtitle, palette}: {
  scene: Scene; cover: boolean; subtitle?: string; palette: Colour;
}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const show = spring({frame: frame - 6, fps, durationInFrames: 31, config: {damping: 25}});
  const chapterOpening = scene.kicker === "CHAPTER OPENING";
  return <section style={{position: "absolute", left: 113, top: cover ? 223 : 264, width: cover ? 795 : 670,
    opacity: show, transform: `translateY(${17 * (1 - show)}px)`, color: "#f1efe8"}}>
    <div style={{fontSize: 20, fontWeight: 600, letterSpacing: ".17em", color: palette.light, textTransform: "uppercase"}}>
      {cover ? "Titanic" : scene.chapter}
    </div>
    <div style={{marginTop: 23, height: 2, width: cover ? 108 : 65, background: palette.light, opacity: .7}} />
    <h1 style={{fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600,
      fontSize: cover ? 101 : chapterOpening ? 79 : scene.title.length > 32 ? 66 : 76, lineHeight: 1.08,
      letterSpacing: "-.035em", margin: "23px 0 0", textWrap: "balance"}}>
      {scene.title}
    </h1>
    {cover && subtitle && <p style={{width: 605, color: "#d6e1e3", fontSize: 27, lineHeight: 1.45, margin: "26px 0 0"}}>{subtitle}</p>}
    <p style={{fontSize: 17, fontWeight: 600, color: "#d1dee1", letterSpacing: ".11em", lineHeight: 1.4, margin: "21px 0 0"}}>
      {scene.displayNote}
    </p>
  </section>;
}

export function DocumentarySubtitles({captions}: {captions: Caption[]}) {
  const frame = useCurrentFrame();
  const cue = captions.find(({start, end}) => frame >= start && frame < end);
  if (!cue) return null;
  return <div style={{position: "absolute", bottom: 97, left: 210, right: 210, display: "flex", justifyContent: "center"}}>
    <div style={{padding: "13px 28px 16px", borderRadius: 8, textAlign: "center", color: "#fff",
      background: "#03090dcf", whiteSpace: "pre", fontSize: cue.text.length > 119 ? 30 : 34, lineHeight: 1.32,
      fontWeight: 600, textShadow: "0 2px 5px #000c"}}>
      {captionLines(cue.text)}
    </div>
  </div>;
}

const centerShot: Partial<Record<NonNullable<Scene["historical"]>["kind"], string>> = {
  ship: "translate(-348px, -30px)",
  ocean: "translate(-348px, -30px) scale(.86)",
  route: "translate(-344px, -5px) scale(1.32)",
  collision: "translate(-338px, -83px) scale(1.2)",
  flooding: "translate(-358px, -18px) scale(1.27)",
  timeline: "translate(-344px, -35px) scale(1.32)",
  lifeboat: "translate(-464px, -92px) scale(1.15)",
};

export function TitanicPicture({scene, duration, hold, palette, cover, subtitle, imageFirst, chapterOpening}: {
  scene: Scene; duration: number; hold: boolean; palette: Colour; cover: boolean; subtitle?: string;
  imageFirst: boolean; chapterOpening: boolean;
}) {
  const {kind, stage} = scene.historical!;
  const shot = {id: scene.sceneId + (hold ? "-hold" : ""), stage, palette, duration, imageFirst};
  const chart = ["archive", "route", "timeline", "flooding", "capacity"].includes(kind);
  const transform = imageFirst && !(kind === "timeline" && stage === 6) ? centerShot[kind] : undefined;
  const sceneArt: Record<typeof kind, ReactNode> = {
    archive: <TitanicArchive scene={scene} fullBleed={imageFirst} />,
    ship: <TitanicShipScene {...shot} />,
    ocean: stage === 0 || stage === 1 ? <TitanicShipScene {...shot} stage={4} /> : null,
    route: <HistoricalMap {...shot} />,
    collision: <IcebergCollisionScene {...shot} />,
    flooding: <FloodingScene {...shot} />,
    timeline: <AnimatedTimeline {...shot} label={stage === 5 ? "MARITIME SAFETY" : stage === 0 ? "ICE REPORTS · 14 APRIL 1912" : "THE NIGHT OF 14–15 APRIL · SHIP’S TIME"} />,
    lifeboat: <LifeboatScene {...shot} />,
    wreck: <UnderwaterWreckScene {...shot} />,
    capacity: <BoatCapacity {...shot} />,
    detail: <HistoricalDetail {...shot} />,
  };
  return <>
    <DepthParallax preset={scene.cameraMovement} duration={duration} hold={hold} origin={imageFirst ? "50% 50%" : undefined} layers={[
      <OceanAtmosphere palette={palette} chart={chart} submerged={kind === "wreck"} />,
      transform ? <AbsoluteFill style={{transform, transformOrigin: "70% 50%"}}>{sceneArt[kind]}</AbsoluteFill> : sceneArt[kind],
      kind === "wreck" ? <AtmosphericParticles color={palette.light} sparse />
        : chart || kind === "detail" ? null : <MovingWater palette={palette} />,
    ]} />
    {imageFirst && !chart && <VolumetricLight color={palette.light} intensity={kind === "wreck" ? .20 : .10} />}
    <FilmGrain animated={false} />
    <AbsoluteFill style={{background: imageFirst
      ? "radial-gradient(ellipse at 49% 49%,transparent 58%,#060c134d 100%),linear-gradient(0deg,#060c13a3,transparent 26%)"
      : "linear-gradient(90deg,#060c13 0%,#060c13da 23%,#060c1322 48%,transparent 72%),radial-gradient(ellipse at 69% 49%,transparent 42%,#060c1359 100%),linear-gradient(0deg,#060c13a3,transparent 30%,transparent 88%,#060c134d)"}} />
    {!hold && (imageFirst
      ? <DramaticTextReveal scene={{...scene, chapter: undefined, kicker: ""}} chapterOpening={chapterOpening} color={palette.light} />
      : <CinematicChapterTitle scene={scene} cover={cover} subtitle={subtitle} palette={palette} />)}
    {!hold && <div style={{position: "absolute", bottom: 49, right: 119, color: "#c6d4d8", fontSize: 17, letterSpacing: ".06em",
      background: "#07131bce", padding: "8px 12px", borderRadius: 3}}>
      {scene.image ? `Archive · ${imageFirst && scene.displayNote ? `${scene.displayNote} · ` : ""}${scene.image.credit}`
        : chart ? "Historical diagram" : "Illustrated reconstruction"}
    </div>}
  </>;
}
