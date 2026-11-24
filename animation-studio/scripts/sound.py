"""Produce an original synthetic Foley kit and short loopable comedy beds."""
from pathlib import Path
import sys
import wave
import numpy as np

R = 24000
ROOT = Path(sys.argv[1])
ROOT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(5807)
def tone(t, hz):
    return np.sin(2*np.pi*hz*t)
def write(name, values):
    with wave.open(str(ROOT/f"{name}.wav"),"wb") as w:
        w.setparams((1,2,R,0,"NONE","not compressed"))
        w.writeframes(np.rint(np.clip(values,-.92,.92)*32767).astype("<i2").tobytes())
def tvec(sec):
    return np.arange(round(R*sec))/R
for name,sec in {"door":.9,"footstep":.19,"place":.29,"sip":.56,"eat":.53,"cloth":.43,
                 "notify":.31,"printer":1.5,"accent":.58,"transition":.62,"room":6}.items():
    t=tvec(sec)
    grain=np.interp(t*1900,np.arange(round(sec*1900)+2),rng.uniform(-1,1,round(sec*1900)+2))
    tail=np.exp(-8*t)
    if name=="room": y=.023*grain+.014*tone(t,62)+.009*tone(t,121)
    elif name=="place": y=(.24*tone(t,120)+.17*tone(t,640)+.07*grain)*np.exp(-19*t)
    elif name=="footstep": y=(.11*grain+.26*tone(t,62))*np.exp(-24*t)
    elif name=="sip": y=(.21*grain+.13*tone(t,110+70*t))*(np.sin(np.pi*t/sec)**2)*(.62+.32*tone(t,17))
    elif name=="eat": y=(.32*grain+.07*tone(t,137))*np.exp(-8*t)*(0.65+0.35*tone(t,14))
    elif name=="printer": y=(.19*tone(t,320+17*t)+.09*grain)*np.maximum(0,tone(t,15))**2
    elif name=="door": y=.28*tone(t,119+29*t)*np.exp(-3*t)+.07*grain*tail
    elif name in ("cloth","transition"): y=.19*grain*(np.sin(np.pi*t/sec)**2)
    else: y=(.24*tone(t,550 if name=="notify" else 420)+.16*tone(t,725))*tail
    write(name,y*np.minimum(1,t/.009)*np.minimum(1,(sec-t)/.04))
for name,notes in {"light":[60,64,67,64,62,65,69,67],"awkward":[57,60,63,59],
                   "suspense":[55,58,62,59],"playful":[64,67,71,74,72,67,69,64],"tender":[60,67,64,72]}.items():
    sec=8
    bed=np.zeros(R*sec)
    for i,n in enumerate(notes*2):
        stamp=round(i/len(notes*2)*sec*R)
        l=min(round(.42*R),len(bed)-stamp)
        t=tvec(l/R)
        pitch=440*2**((n-69)/12)
        bed[stamp:stamp+l]+=(.15*tone(t,pitch)+.039*tone(t,pitch*2.01))*np.exp(-8*t)*np.minimum(1,t/.011)*np.minimum(1,(l/R-t)/.05)
    write("score-"+name,bed)
