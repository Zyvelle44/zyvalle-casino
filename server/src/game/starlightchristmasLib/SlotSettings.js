/** Node compatibility port of GatesofOlympus/SlotSettings.php's game-facing settings/state.
 * Laravel ORM, shop models, and legacy account persistence are intentionally injected by the host.
 */
import GameReel from './GameReel.js';
export default class SlotSettings {
  constructor(slotId,playerId,{settings={},reelsPath}={}) {
    this.slotId=slotId; this.playerId=playerId; this.user=null; this.game=null; this.shop=null;
    this.currency='USD'; this.Paytable={}; this.Jackpots=[]; this.count_balance=0;
    this.settings={...settings}; this.reels=new GameReel(reelsPath);
    this.gameData={}; this.gameDataStatic={}; this.lastEvent='NULL';
    this.scaleMode=0; this.numFloat=0; this.increaseRTP=1; this.jpgPercentZero=false;
    this.CurrentDenom=Number(settings.CurrentDenom||1); this.Balance=0; this.AllBet=0;
    this.Paytable=settings.Paytable||{};
  }
  SetGameData(key,value){this.gameData[key]={timelife:Math.floor(Date.now()/1000)+86400,payload:value};}
  GetGameData(key){return this.gameData[key]?.payload??0;}
  FormatFloat(value){const str=String(value).split('.');if(str.length<2)return value;if(str[1].length>4)return Math.round(Number(value)*100)/100;if(str[1].length>2)return Math.floor(Number(value)*100)/100;return value;}
  SaveGameData(key,value){if(arguments.length===2)this.SetGameData(key,value);return this.gameData;}
  CheckBonusWin(){let count=0,total=0;for(const row of Object.values(this.Paytable)){for(const pay of row){if(Number(pay)>0){count++;total+=Number(pay);break;}}}return count?total/count:0;}
  GetRandomPay(){const rates=[];for(const row of Object.values(this.Paytable))for(const pay of row)if(Number(pay)>0)rates.push(Number(pay));if(!rates.length)return 0;for(let i=rates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rates[i],rates[j]]=[rates[j],rates[i]];}const first=rates[0];if(Number(this.game?.stat_in||0)<Number(this.game?.stat_out||0)+first*Number(this.AllBet||0))return 0;return first;}
  HasGameDataStatic(key){return Object.hasOwn(this.gameDataStatic,key);}
  SaveGameDataStatic(){return this.gameDataStatic;}
  SetGameDataStatic(key,value){this.gameDataStatic[key]={timelife:Math.floor(Date.now()/1000)+86400,payload:value};}
  GetGameDataStatic(key){return this.gameDataStatic[key]?.payload??0;}
  HasGameData(key){return Object.hasOwn(this.gameData,key);}
  GetHistory(history=[]){this.lastEvent='NULL';for(const item of history.slice(0,10)){const log=typeof item.str==='string'?JSON.parse(item.str):item.str;if(log?.responseEvent!=='gambleResult'){this.lastEvent=item.str;return log;}}return 'NULL';}
  UpdateJackpots(bet){const countBalance=Number(this.count_balance||0);return (this.Jackpots||[]).map(j=>({...j,balance:Number(j.balance||0)+((countBalance===0||this.jpgPercentZero)?0:Math.min(countBalance,Number(bet)*this.CurrentDenom)*Number(j.percent||0)/100)}));}
  GetBank(slotState=''){return Number(this.settings.bank?.[this.isBonusStart||['bonus','freespin','respin'].includes(slotState)?'bonus':'slots']||0)/this.CurrentDenom;}
  GetPercent(){return Number(this.settings.percent||0);}
  GetCountBalanceUser(){return Number(this.count_balance||0);}
  InternalErrorSilent(message){return {error:String(message)};}
  InternalError(message){throw new Error(String(message));}
  SetBank(slotState='',sum){const key=this.isBonusStart||['bonus','freespin','respin'].includes(slotState)?'bonus':'slots';this.settings.bank=this.settings.bank||{};const next=Number(this.settings.bank[key]||0)+Number(sum)*this.CurrentDenom;if(next<0)throw new Error(`Bank_${sum} CurrentBank_${this.settings.bank[key]||0}`);this.settings.bank[key]=next;return next/this.CurrentDenom;}
  SetBalance(sum){const next=this.GetBalance()+Number(sum);if(next<0)throw new Error(`Balance_${sum}`);if(this.user)this.user.balance=next*this.CurrentDenom;this.Balance=next;return next;}
  GetBalance(){this.Balance=Number(this.user?.balance||0)/this.CurrentDenom;return this.Balance;}
  SaveLogReport(log){return log;}
  GetSpinSettings(garantType='doSpin',bet=0,lines=20){this.AllBet=Number(bet)*Number(lines);return {AllBet:this.AllBet,garantType,lines};}
  GetRandomScatterPos(rp){const result=[];for(let i=0;i<rp.length;i++){if(String(rp[i])!=='1')continue;for(let start=Math.max(0,i-3);start<=i;start++){if(start+3<rp.length&&i>=start&&i<start+4)result.push(start);}}return [...new Set(result)];}
  GetGambleSettings(){return Math.floor(Math.random()*Math.max(1,Number(this.WinGamble||1)))+1;}
  GetReelStrips(winType='regular'){const source=winType==='bonus'?this.reels.reelsStripBonus:this.reels.reelsStrip;return Object.fromEntries(Object.entries(source).map(([k,v])=>[k,v.length?Math.floor(Math.random()*Math.max(1,v.length-2)):0]));}
  static HasGameDataStatic(data,key){return Object.hasOwn(data||{},key);}
  static SaveGameDataStatic(data,key,value){data[key]={timelife:Math.floor(Date.now()/1000)+86400,payload:value};return data;}
  static SetGameDataStatic(data,key,value){return SlotSettings.SaveGameDataStatic(data,key,value);}
  static GetGameDataStatic(data,key){return data?.[key]?.payload??0;}
}
