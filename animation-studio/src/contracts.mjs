export const characters = ["milo", "jun"];
export const views = ["front", "three-quarter", "side", "back"];
export const expressions = ["neutral", "happy", "angry", "confused", "suspicious", "shocked", "sad", "annoyed", "embarrassed", "excited", "smug", "deadpan"];
export const clips = ["idle", "breathing", "blink", "look-left", "look-right", "nod", "shake-head", "talk", "point", "wave", "shrug", "walk", "run", "sit", "stand-up", "grab", "hold", "eat", "drink", "surprise", "anger", "laugh", "embarrassment"];
export const shots = ["establishing", "wide", "medium", "close-up", "extreme-close-up", "over-the-shoulder", "point-of-view", "reaction", "shot-reverse-shot", "insert"];
export const props = ["door", "window", "table", "chair", "bowl", "cup", "phone", "bag", "food", "sign", "receipt"];
export const effects = ["door", "footstep", "place", "sip", "eat", "cloth", "notify", "printer", "accent", "transition"];
export const moods = ["light", "awkward", "suspense", "playful", "tender", "silence"];
export const states = ["on-table", "held", "drinking", "open", "closed", "printing", "unspooled"];
export const fps = 30;
const choice = values => ({type: "string", enum: values});
const text = maxLength => ({type: "string", minLength: 1, maxLength});
const id = {...text(64), pattern: "^[a-z][a-z0-9-]*$"};
const number = (minimum,maximum) => ({type:"number",minimum,maximum});
const record = (properties, required = Object.keys(properties)) => ({type:"object", additionalProperties:false, required, properties});
const list = (items,minItems,maxItems) => ({type:"array",items,minItems,maxItems});
const pose = record({
  clip:choice(clips), expression:choice(expressions), eyeTarget:choice([...characters,...props,"camera"]),
  offset:list(number(-220,220),2,2), view:choice(views), hand:choice(["left","right"]),
}, []);
const beat = record({
  id, seconds:number(.5,20), purpose:text(96), shot:choice(shots), target:choice([...characters,...props]),
  move:choice(["still","push"]), deliberateHold:{type:"boolean"}, mood:choice(moods),
  dialogue:record({speaker:choice(characters),text:text(250),rate:number(.8,1.25),delivery:text(96)},["speaker","text"]),
  poses:record(Object.fromEntries(characters.map(c=>[c,pose])),[]),
  props:list(record({prop:choice(props),at:number(0,20),state:choice(states),character:choice(characters),hand:choice(["left","right"])},["prop","at","state"]),0,10),
  effects:list(record({at:number(0,20),name:choice(effects),gain:number(-36,0)},["at","name"]),0,10),
},["id","seconds","purpose","shot"]);
export const episodeSchema = record({
  id,title:text(130),topic:text(440),language:choice(["en","vi"]),duration:{type:"integer",minimum:10,maximum:90},
  scenes:list(record({
    id,set:id,time:choice(["day","night"]),cast:list(choice(characters),1,2),transition:choice(["cut","dip"]),
    music:choice(moods),beats:list(beat,1,28),visibleProps:list(choice(props),0,11),
  },["id","set","time","cast","transition","music","beats"]),1,12),
});
