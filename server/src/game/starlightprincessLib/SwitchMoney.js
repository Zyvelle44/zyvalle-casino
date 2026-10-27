/** PHP port: PragmaticLib/SwitchMoney.php. Returns a movement plan; caller commits atomically. */
import Jackpots from './Jackpots.js';
import SlotBank from './SlotBank.js';
import Statistic from './Statistic.js';
export default class SwitchMoney {
  static set({bet=0,shop={},bank={},jackpots=[],user={},game={},win=0,slotArea,freeSpins,currentLog={},winPermission=true}) {
    const amount=Math.max(0,Number(bet||0));
    const permitted=typeof winPermission==='object'?Number(winPermission.CurrentWin||0):Number(win||0);
    const bonus=Object.hasOwn(currentLog,'FSPay')?currentLog.FSPay:false;
    const toJackpot=Jackpots.toJP(amount,jackpots);
    const profit=amount*((100-Number(shop.percent||0))/100);
    const bankMovement=SlotBank.addBank(amount,bank,toJackpot.toJackpots,profit,bonus);
    const finalWin=Object.hasOwn(currentLog,'FSPay')?Number(currentLog.FSPay):permitted;
    return {balanceDelta:-amount+finalWin,toJackpot:toJackpot.toJackpots,toProfit:profit,...bankMovement,statistic:Statistic.setStatistic(user,finalWin,game,bank,amount,bankMovement.toBank,toJackpot.toJackpots,profit,freeSpins,slotArea)};
  }
}
