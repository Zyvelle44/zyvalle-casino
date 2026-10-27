/** PHP port: PragmaticLib/Spin.php. Core primitives are modular; DB transaction/locks belong to route. */
import SlotArea from './SlotArea.js';
import WinChecker from './WinChecker.js';
import FreeSpin from './FreeSpin.js';
import BuyFreeSpins from './BuyFreeSpins.js';
import Multiple from './Multiple.js';
import LogAndServer from './LogAndServer.js';
import WinPermission from './WinPermission.js';
export default class Spin {
  static calculate({gameSettings,bet,lines=20,index=1,counter=2,doubleChance=0,buyFS=null,currentLog=null,user={},bank={},reelSet=null}) {
    const settings=gameSettings?.all||gameSettings||{};
    const fsActive=Boolean(currentLog?.FreeSpinNumber && currentLog.FreeState!=='LastFreeSpin');
    const chosenReel=reelSet??(fsActive&&Number(currentLog.FreeSpinNumber)>1?1:(Number(doubleChance)!==0?2:0));
    const slotArea=SlotArea.getSlotArea(settings,chosenReel,currentLog);
    if(String(buyFS)==='0')BuyFreeSpins.getFreeSpin(slotArea.SlotArea,settings);
    const win=new WinChecker(settings).getWin(bet,slotArea);
    const freeSpins=win.TotalWin===0?FreeSpin.check(slotArea.SlotArea,currentLog,settings,bet):false;
    const multipliers=fsActive?Multiple.getBonanzaMultiple(slotArea.SlotArea,settings,currentLog):false;
    const result=LogAndServer.getResult(slotArea,index,counter,bet,lines,doubleChance,chosenReel,win,currentLog,user,freeSpins,multipliers,0,bank,{});
    const permission=WinPermission.winCheck(freeSpins,buyFS,bank,result.Log,win.TotalWin,multipliers,currentLog);
    return {slotArea,win,freeSpins,multipliers,...result,permission};
  }
}
