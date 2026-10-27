/** PHP port: PragmaticLib/FreeSpin.php */
export default class FreeSpin {
  static check(slotArea, log, gameSettings, bet) {
    const [scatterRaw,payRaw=''] = String(gameSettings.scatters||'1~').split('~');
    const scatter=Number(scatterRaw), pays=payRaw.split(',').map(Number).reverse();
    const positions=[]; slotArea.forEach((s,i)=>{if(Number(s)===scatter)positions.push(i);});
    if(!positions.length)return false;
    if(log && Object.hasOwn(log,'FreeSpinNumber') && log.FreeState!=='LastFreeSpin') {
      const count=positions.length;
      if(count>=Number(gameSettings.settings_needaddfs||3)) return {AddFreeSpins:Number(gameSettings.settings_addfs||5)};
    } else {
      const pay=Number(pays[positions.length-1]||0);
      const win=Math.round((pay*Number(bet)+Number.EPSILON)*100)/100;
      if(win>0)return {FreeSpins:Number(gameSettings.settings_fs||15),Pay:win,ScatterPositions:positions,Scatter:scatter};
    }
    return false;
  }
}
