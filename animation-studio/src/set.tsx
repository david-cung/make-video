import type {ReactNode} from "react";
import sets from "../configs/sets.json";
import {ink} from "./rig";
import type {Point, PropId} from "./types";

export type SetId=keyof typeof sets;
export const floorY=600;
const edge={stroke:ink,strokeWidth:4,strokeLinejoin:"round",strokeLinecap:"round"} as const;
const cardFont="'Be Vietnam Pro', system-ui, sans-serif";
export function setData(id:string){return sets[id as SetId];}
export function propAnchor(set:string, prop:string):Point|undefined{
  const point=(setData(set).anchors as Record<string,number[] | undefined>)[prop];
  return point ? [point[0],point[1]] : fallbackPositions[prop as PropId];
}
const fallbackPositions:Partial<Record<PropId,Point>>={
  door:[226,424],window:[291,277],table:[520,481],chair:[319,620],bowl:[546,481],cup:[491,479],
  phone:[590,481],bag:[145,614],food:[585,481],sign:[852,197],receipt:[956,451],
};

export function EnvironmentLayer({set,time,layer,children}:{
  set:string;time:"day"|"night";layer:"background"|"midground"|"foreground";children?:ReactNode;
}) {
  const design=setData(set);
  const [light,tone,deep]=design.palette;
  const night=time==="night", stall=design.layout==="stall", outside=design.layout==="outside";
  if(layer==="background")return <g>
    <path d="M-250-160h1800v1070H-250Z" fill={night?"#434364":light}/>
    <path d="M-100 438H1400V545H-100Z" fill={night?"#675470":tone} opacity=".55"/>
    <path d="M-100 528H1400V850H-100Z" fill={night?"#55546d":"#d69477"}/>
    <path d="M-100 532H1400M-100 552H1400" fill="none" stroke={night?"#a17984":"#814b59"} strokeWidth="4" opacity=".65"/>
    <g fill="none" stroke="#934e59" strokeWidth="2" opacity=".33">
      {[570,620,681,754].map(y=><path key={y} d={`M-80 ${y}H1400`}/>)}
      {Array.from({length:13},(_,i)=><path key={i} d={`M${i*111-28} 530 ${i*188-460} 850`}/>)}
    </g>
    {outside&&<path d="M0 189 165 106 306 179 410 125 602 226 765 128 960 216 1107 117 1280 189V423H0Z" fill={deep} opacity=".42"/>}
    {!outside&&<g opacity=".36" stroke="#aa726e" strokeWidth="2" fill="none">
      {[72,112,152,192,232,272,312,352,392].map(y=><path key={y} d={`M-80 ${y}H1400`}/>)}
      {Array.from({length:19},(_,i)=><path key={i} d={`M${i*75-40} 72v320`}/>)}
    </g>}
    <path d="M0 0H1280V77H0Z" fill={night?"#353550":deep} opacity=".98"/>
    <path d="M0 65H1280V75H0Z" fill="#263744" opacity=".65"/>
    <text x="48" y="43" fill="#fff0cb" fontFamily={cardFont} fontSize="18" fontWeight="700" letterSpacing="5.1">SIDE STREET SPECIALS</text>
    {night&&[178,649,1102].map(x=><ellipse key={x} cx={x} cy="135" rx="140" ry="66" opacity=".1" fill="#fff0b6"/>)}
  </g>;
  if(layer==="midground")return <g>
    {stall&&<>
      <path d="M666 100H1227V569H666Z" fill="#4c6870" {...edge}/>
      <rect x="686" y="125" width="518" height="408" rx="32" fill={night?"#38465d":"#597c7e"} {...edge}/>
      <path d="M698 342H1191M699 398H1191" fill="none" stroke="#253c48" strokeWidth="5" opacity=".45"/>
      {[1039,1086,1133,1180].map((x,i)=><g key={x}><path d={`M${x} 346h25l-2 34h-21Z`} fill={i%2?"#f8dfaa":"#d77764"} {...edge}/><path d={`M${x-2} 346h29`} fill="none" stroke="#273847" strokeWidth="4"/></g>)}
      <path d="M659 110H1255l-30 36H680Z" fill="#e7785f" {...edge}/>
      {[702,793,885,977,1069,1161].map(x=><path key={x} d={`M${x} 111h37l11 36h-40Z`} fill="#f5dba5"/>)}
      <rect x="1044" y="177" width="134" height="92" rx="9" fill="#83a39a" {...edge}/>
      <path d="M1069 236h81m-61-16h45m-30-18h14" stroke="#fff1c5" strokeWidth="5" strokeLinecap="round"/>
    </>}
    <g transform="translate(135 313)" {...edge}>
      <path d="M-26 161h76l-13 36h-49Z" fill="#b77666"/>
      <path d="M10 155q-30-76-65-79q15 42 65 79q30-80 64-82q-8 57-64 82q-23-43-60-26q21 24 60 26" fill="#427b68"/>
    </g>
    <path d="M34 496h150" stroke="#fff3cd" strokeWidth="12" opacity=".38" strokeLinecap="round"/>
    {children}
  </g>;
  return <g>
    {stall&&<g>
      <path d="M719 480H1335V652H720Z" fill="#bf715f" {...edge}/>
      <path d="M703 474Q702 458 721 455H1335V493H718Q702 491 703 474Z" fill="#f3bb80" {...edge}/>
      <path d="M743 517h590M743 625h590" stroke="#eaab83" opacity=".75" strokeWidth="5"/>
      {Array.from({length:12},(_,i)=><path key={i} d={`M${754+i*54} 508v123`} stroke="#9f574e" opacity=".51" strokeWidth="4"/>)}
      <rect x="871" y="528" width="205" height="65" rx="16" fill="#f3bc83" {...edge}/>
      <text x="973" y="568" textAnchor="middle" fontFamily={cardFont} fontSize="19" fontWeight="800" fill={ink} letterSpacing="3">JUN’S WINDOW</text>
    </g>}
    {children}
  </g>;
}

export function InteractiveProp({id,set,state="on-table",progress=0,position,tilt=0}:{
  id:PropId;set:string;state?:string;progress?:number;position?:Point;tilt?:number;
}) {
  const point=position??propAnchor(set,id)??fallbackPositions[id]??[0,0];
  const [x,y]=point;
  const art:Record<PropId,ReactNode>={
    door:<g transform="translate(-95 -243)">
      <rect width="156" height="244" rx="7" fill="#304556" {...edge}/>
      <g transform={`scale(${1-.73*progress} 1)`}><rect x="5" y="5" width="146" height="236" rx="5" fill="#669991" {...edge}/>
        <rect x="22" y="29" width="110" height="81" rx="4" fill="#b0d7c1" {...edge}/><path d="M25 66h102M75 34v74" fill="none" {...edge}/>
        <circle cx="126" cy="150" r="6" fill="#eabe79" {...edge}/></g>
      </g>,
    window:<g transform="translate(-82 -50)"><rect width="157" height="101" rx="9" fill="#506e79" {...edge}/>
      <rect x="7" y="8" width="143" height="85" rx="5" fill="#a5cebb" {...edge}/><path d="M80 12v76M12 53h135" {...edge}/>
      <path d="M17 16h50L17 57Z" fill="#e3eacf" opacity=".6"/></g>,
    table:<g><path d="M-82 24h16l-13 121h-14ZM65 25h16l13 120H81Z" fill="#876158" {...edge}/><path d="M-109-6q8-13 35-13h158q40 3 41 19q-2 18-38 20H-81q-43-1-28-26Z" fill="#e9a16e" {...edge}/><path d="M-89 1h186" stroke="#fbca8d" strokeWidth="4" opacity=".58"/></g>,
    chair:<g><path d="M-40-20 65-22 55-9-35-7Z" fill="#eaaf77" {...edge}/><path d="M-29-8-38 22h8l12-31m59 0 9 30h10L52-8" fill="#97736a" {...edge}/></g>,
    bowl:<g transform="translate(-8 -5)"><path d="M-33-14Q-21 12 1 16Q24 13 38-14Z" fill="#e96e62" {...edge}/><ellipse cy="-14" rx="37" ry="12" fill="#fff0cb" {...edge}/><path d="M-25-14q48-4 53 1" stroke="#d99672" strokeWidth="3" fill="none"/><path d="M-22-3q20 13 44 0" stroke="#f5be9c" strokeWidth="3" fill="none"/></g>,
    cup:<g transform="translate(5 -11)"><path d="M13-14Q-12-22-5-3Q0 10 16 4" fill="none" stroke={ink} strokeWidth="10"/><path d="M13-14Q-12-22-5-3Q0 10 16 4" fill="none" stroke="#90d4c7" strokeWidth="4"/><path d="M8-25H38L34 8Q23 17 11 8Z" fill="#63b7a7" {...edge}/><ellipse cx="23" cy="-25" rx="15" ry="5" fill="#d9efe1" {...edge}/><path d="M28-17v19" stroke="#a9dfcf" strokeWidth="3" opacity=".8"/></g>,
    phone:<g><rect x="-13" y="-22" width="28" height="43" rx="7" fill="#384359" {...edge}/><rect x="-8" y="-16" width="18" height="27" rx="2" fill={state==="open"?"#f2db89":"#79ad9e"}/></g>,
    bag:<path d="M-26-40q2 11 12 7q-2-20 12-19q14 0 12 19q15 3 18-8l8 40h-70Z" fill="#a87861" {...edge}/>,
    food:<g><path d="M-28 12q13-34 34-31q18 9 22 33Z" fill="#e6ad64" {...edge}/><path d="M-14 3 13-5" stroke="#f6db91" strokeWidth="4" /></g>,
    sign:<g transform="translate(-115 -41) rotate(-2 110 45)">
      <rect x="-7" y="-9" width="246" height="129" rx="13" fill="#333d54" opacity=".35"/>
      <rect width="234" height="117" rx="10" fill="#f7e3a7" {...edge}/>
      <rect x="8" y="8" width="218" height="101" rx="7" fill="none" stroke="#bc765c" strokeWidth="2.5" strokeDasharray="7 5"/>
      <text x="117" y="38" textAnchor="middle" fontFamily={cardFont} fontWeight="800" fontSize={state==="open"?21:22} letterSpacing="2.5" fill={ink}>{state==="open"?"PAPER NOODLES":"BOWL SPECIAL"}</text>
      <text x="117" y="93" textAnchor="middle" fontFamily={cardFont} fontWeight="900" fontSize="49" fill="#a4434d">$2</text>
    </g>,
    receipt:state==="held"?
      <path d="M-3 0Q-20 8-45-16Q-54-26-57-33m54 33q-14 24 2 43" stroke="#fff2cd" strokeWidth="9" strokeLinecap="round" fill="none"/>:
      <g><path d="M-40-35h68l19 29H-45Z" fill="#cf9285" {...edge}/><rect x="-45" y="-7" width="92" height="19" rx="5" fill="#a95a67" {...edge}/>
        <path d="M-21-29h47" stroke={ink} strokeWidth="7" strokeLinecap="round"/>
        {(state==="printing"||state==="unspooled")&&<path d={state==="printing"?`M-8-30q-12 ${-30*progress}-26 ${36*progress}`:
          "M-8-31C-46-64-92 22-123 17S-158-30-181 15-208 55-239 36-261-21-292 17-327 42-365 19-370 58-404 15"}
          fill="none" stroke="#593e4b" strokeWidth="13" strokeLinecap="round"/>}
        {(state==="printing"||state==="unspooled")&&<path d={state==="printing"?`M-8-30q-12 ${-30*progress}-26 ${36*progress}`:
          "M-8-31C-46-64-92 22-123 17S-158-30-181 15-208 55-239 36-261-21-292 17-327 42-365 19-370 58-404 15"}
          stroke="#fff0c6" strokeWidth="9" strokeLinecap="round" fill="none"/>}
        <circle cx="35" cy="1" r="3.5" fill="#f6d184"/></g>,
  };
  return <g data-prop={id} transform={`translate(${x} ${y}) rotate(${tilt})`}>{art[id]}</g>;
}
