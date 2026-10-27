/** PHP port: PragmaticLib/SpinDispenser.php; explicit state classification. */
export default class SpinDispenser {
  static getSpin(slotArea,index,counter,bet,lines,doubleChance,reelSet,win,currentLog,user,freeSpins) {
    if(freeSpins && freeSpins.AddFreeSpins)return {State:'AddFreeSpin'};
    if(freeSpins && freeSpins.FreeSpins)return {State:'FirstFreeSpin'};
    if(Number(win.TotalWin)>0)return {State:currentLog&&['Respin','FirstRespin'].includes(currentLog.State)?'Respin':'FirstRespin'};
    if(currentLog&&['Respin','FirstRespin'].includes(currentLog.State))return {State:'LastRespin'};
    return {State:'Spin'};
  }
}
