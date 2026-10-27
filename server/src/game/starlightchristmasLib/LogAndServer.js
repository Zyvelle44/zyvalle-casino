/** PHP port: PragmaticLib/LogAndServer.php.
 * Builds game state + protocol fields using Formatter; persistence stays in the Node route.
 */
import Formatter from './Formatter.js';
import Multiple from './Multiple.js';
export default class LogAndServer {
  static getResult(slotArea,index,counter,bet,lines,doubleChance,reelSet,win,currentLog,user,freeSpins,multipliers,changeBalance,bank,game) {
    const Log=Formatter.toLog(slotArea,index,counter,bet,lines,doubleChance,reelSet,win,currentLog,user,freeSpins);
    const Server=Formatter.toServer(Log);
    const prg=(multipliers||[]).reduce((s,m)=>s+Number(m.Multiplier||0),0);
    if(multipliers && multipliers.length){
      Log.Multipliers=multipliers;
      const rmul='rmul='+multipliers.map(({Reel, ...m})=>Object.values(m).join('~')).join(';');
      const ix=Server.findIndex(x=>x==='prg=1'); if(ix>=0 && prg)Server[ix]=`prg=${prg}`;
      Server.push(rmul);
      if(prg && Log.State==='LastRespin'){
        const multiplierTotal=Number(currentLog?.PrgSum||0)+prg;
        const base=Number(Log.tmb_res||0);
        Log.MultWin=prg; Log.tmb_res=base*multiplierTotal;
        Log.TotalWin=Number(Log.TotalWin||0)+Log.tmb_res-Number(Log.tmb_win||0);
      }
    }
    if(currentLog?.FreeSpinNumber && Number(currentLog.FreeSpinNumber)>1){
      Log.PrgSum=Number(currentLog.PrgSum||0)+(prg && Log.State==='LastRespin'?prg:0);
      const i=Server.findIndex(x=>x.startsWith('accv='));
      if(i>=0)Server[i]=`accv=${Log.PrgSum}`;
    }
    return {Log,Server};
  }
}
