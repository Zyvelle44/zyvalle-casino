/** PHP port: PragmaticLib/SlotArea.php */
export default class SlotArea {
  static getSlotArea(gameSettings, reelset = 0, log = null, random = Math.random) {
    const raw = String(gameSettings[`reel_set${reelset}`] ?? gameSettings.reel_set0 ?? '');
    const strips = raw.split('~').map(x=>x.split(',').map(v=>Number.parseInt(v,10)).filter(Number.isFinite));
    if (strips.length !== 6 || strips.some(r=>!r.length)) throw new Error(`Invalid reel_set${reelset}: expected six non-empty reels`);
    const reels=[], symbolsAfter=[], symbolsBelow=[];
    strips.forEach((strip,i)=>{
      const pos = Math.floor(random() * strip.length);
      const cycled = strip.concat(strip.slice(0,10));
      reels[i] = cycled.slice(pos,pos+Number(gameSettings.sh||5));
      symbolsAfter[i] = cycled[pos-1 < 0 ? cycled.length-1 : pos-1];
      symbolsBelow[i] = reels[i][reels[i].length-1];
    });
    if (log && ['Respin','FirstRespin'].includes(log.State) && Array.isArray(log.SlotArea)) {
      const rows = Number(gameSettings.sh||5), cols=6;
      const byCol = Array.from({length:cols},(_,c)=>Array.from({length:rows},(_,r)=>log.SlotArea[r*cols+c]));
      const winSymbols = [...new Set((log.WinLines||[]).map(w=>Number(w.WinSymbol)))];
      for(let c=0;c<cols;c++){
        // PHP pushes the next symbol onto each freshly sampled reel before dropping wins.
        const freshWithAfter=reels[c].concat(symbolsAfter[c]);
        const survivors=byCol[c].filter(sym=>!winSymbols.includes(Number(sym)));
        const missing=rows-survivors.length;
        const refill=missing>0 ? freshWithAfter.slice(-missing) : [];
        reels[c]=refill.concat(survivors).slice(0,rows);
        symbolsBelow[c]=reels[c][rows-1];
      }
      symbolsAfter.splice(0,symbolsAfter.length,...reels.map(r=>r[0]));
    }
    const SlotArea=[];
    for(let row=0;row<Number(gameSettings.sh||5);row++) for(let col=0;col<6;col++) SlotArea.push(reels[col][row]);
    return {SlotArea,SymbolsAfter:symbolsAfter,SymbolsBelow:symbolsBelow};
  }
}
