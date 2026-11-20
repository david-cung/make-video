import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from "remotion";
import type {Scene} from "./types";

type Graphic = NonNullable<Scene["sportGraphic"]>;

export function StadiumAtmosphere({accent, secondary}: {accent: string; secondary: string}) {
  return <AbsoluteFill style={{
    background: `radial-gradient(ellipse at 92% 3%, ${accent}4d, transparent 37%),
      radial-gradient(ellipse at 51% 71%, ${secondary}58, transparent 48%),
      linear-gradient(161deg, transparent 49%, ${accent}13 50%, transparent 65%)`,
  }}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden>
      <path d="M850 777Q1350 624 1920 745M850 789Q1390 653 1920 759M884 808Q1410 692 1920 772"
        fill="none" stroke={accent} strokeWidth="2" opacity=".19" />
      <path d="M1280 821l326-118 274 59m-86-45-365 151m-68-81 221 91m-19-148 220 78"
        fill="none" stroke={accent} strokeWidth="2" opacity=".13" />
      {[0,1,2,3,4,5,6,7].map(i => <rect key={i} x={1535+i*21} y={138-i*3} width="13" height="4" rx="2" fill={accent} opacity=".54" />)}
    </svg>
  </AbsoluteFill>;
}

function Trophy({accent}: {accent: string}) {
  return <svg viewBox="0 0 250 224" width="250" height="212" aria-hidden>
    <path d="M68 32H182V76Q182 132 125 150Q68 132 68 76Z" fill={accent} opacity=".22" />
    <g stroke={accent} strokeWidth="4.5" fill="none" strokeLinejoin="round">
      <path d="M68 32H182V76Q182 132 125 150Q68 132 68 76ZM68 47H39Q33 103 82 107M182 47H211Q217 103 168 107M125 150V186M95 188H155L164 203H86Z" />
      <path d="M83 41V74Q83 103 98 119M125 45v90" opacity=".38" />
    </g>
  </svg>;
}

function Pitch({accent}: {accent: string}) {
  return <svg viewBox="0 0 360 225" width="344" height="212" aria-hidden>
    <g stroke={accent} strokeWidth="2.8" opacity=".72" fill="none">
      <path d="M14 25H346V200H14ZM180 25V200M14 64h58v96H14M346 64h-58v96h58M14 88h23v49H14M346 88h-23v49h23" />
      <circle cx="180" cy="112.5" r="30" />
      <path d="M98 145Q133 83 222 94l-17-9m17 9-20 8" strokeDasharray="7 6" />
    </g>
    <circle cx="98" cy="145" r="7" fill={accent} />
    <circle cx="222" cy="94" r="7" fill={accent} />
  </svg>;
}

const DIGITS = "Bahnschrift, 'Be Vietnam Pro', sans-serif";

export function SportsGraphic({graphic, accent, centered = false}: {graphic: Graphic; accent: string; centered?: boolean}) {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [17, 58], [0, 1], {
    easing: Easing.out(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const medal = graphic.kind === "trophy";
  const score = graphic.kind === "score";
  return <aside style={{
    position: "absolute", right: centered ? undefined : 126, left: centered ? "50%" : undefined,
    top: centered || medal || graphic.kind === "pitch" ? 188 : 275,
    width: centered ? 790 : score ? 620 : 590, color: "#f8f5ea", opacity: reveal,
    transform: centered ? `translate(-50%, ${26 * (1 - reveal)}px)` : `translateX(${44 * (1 - reveal)}px)`,
    background: "#0a0d15dc", padding: "25px 29px 29px",
    border: "1px solid #ffffff27", borderLeft: `3px solid ${accent}`, fontFamily: DIGITS, display: "grid", gap: 14,
  }}>
    <div style={{color: accent, letterSpacing: ".15em", fontSize: 18, fontWeight: 600}}>{graphic.heading}</div>
    {medal && <Trophy accent={accent} />}
    {graphic.kind === "pitch" && <Pitch accent={accent} />}
    {graphic.items.map(({label,value}, index) => <div key={`${index}-${label}`} style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 25,
      borderTop: "1px solid #eef3ff29", paddingTop: 11,
    }}>
      <span style={{fontSize: 24, fontWeight: 600}}>{label}</span>
      <strong style={{fontSize: score ? 51 : 25, letterSpacing: ".02em", color: accent, whiteSpace: "nowrap"}}>{value}</strong>
    </div>)}
  </aside>;
}
