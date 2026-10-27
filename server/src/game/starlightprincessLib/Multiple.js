/** PHP port: PragmaticLib/Multiple.php */
export default class Multiple {
  static getBonanzaMultiple(slotArea, gameSettings, currentLog) {
    const [symbolRaw, valuesRaw=''] = String(gameSettings.prm||'').split(';')[0].split('~');
    const symbol=Number(symbolRaw), options=valuesRaw.split(',').map(Number).filter(Number.isFinite);
    if(!Number.isFinite(symbol)||!options.length)return false;
    const rows=Number(gameSettings.sh||5), cols=6;
    const previous=Array.isArray(currentLog?.Multipliers)?currentLog.Multipliers:[];
    const ready=[];
    for(let reel=0;reel<cols;reel++){
      for(let row=rows-1;row>=0;row--){
        const position=row*cols+reel;
        if(Number(slotArea[position])!==symbol)continue;
        const old=previous.find(m=>Number(m.Reel)===reel);
        const Multiplier=old ? Number(old.Multiplier) : options[Math.floor(Math.random()*options.length)];
        ready.push({Symbol:symbol,Position:position,Multiplier,Reel:reel});
      }
    }
    return ready.length?ready:false;
  }
  static getMultiplier(currentLog, values, reel) {
    const old=(currentLog?.Multipliers||[]).find(m=>Number(m.Reel)===Number(reel));
    return old ? Number(old.Multiplier) : values[Math.floor(Math.random()*values.length)];
  }
}
