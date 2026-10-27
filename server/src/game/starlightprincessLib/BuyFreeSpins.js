/** PHP port: PragmaticLib/BuyFreeSpins.php */
export default class BuyFreeSpins {
  static getFreeSpin(slotArea, gameSettings, random=Math.random) {
    const [scatterRaw] = String(gameSettings.scatters||'1~').split('~');
    const scatter=Number(scatterRaw), needed=Number(gameSettings.settings_needfs||4);
    const positions=[]; slotArea.forEach((s,i)=>{if(Number(s)===scatter)positions.push(i);});
    const candidates=slotArea.map((_,i)=>i).filter(i=>!positions.includes(i));
    while(positions.length<needed && candidates.length) {
      const pick=Math.floor(random()*candidates.length);
      const pos=candidates.splice(pick,1)[0]; slotArea[pos]=scatter; positions.push(pos);
    }
    return {Scatter:scatter,ScatterPositions:positions};
  }
}
