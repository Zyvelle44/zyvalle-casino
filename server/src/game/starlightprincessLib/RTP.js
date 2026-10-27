/** RTP.G6/reels configuration parsing helpers; this does not alter probability without calibrated strips. */
export default class RTP {
  static parse(text=''){return Object.fromEntries(String(text).split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const i=line.indexOf('=');return i<0?[line,'']:[line.slice(0,i),line.slice(i+1)];}));}
  static target(settings){const n=Number(settings?.rtp??settings?.targetRtp??96.5);return Number.isFinite(n)?n:96.5;}
}
