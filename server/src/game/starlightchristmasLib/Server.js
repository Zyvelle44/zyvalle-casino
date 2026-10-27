/** Node counterpart of GatesofOlympus/Server.php; Express route installation lives in gatesOfOlympus.js. */
export default class Server {
  static settingsResponse(){return 'SoundState=true_true_true_false_false;FastPlay=false;Intro=true;StopMsg=0;TurboSpinMsg=0;BetInfo=0_0;BatterySaver=false;ShowCCH=true;ShowFPH=true;CustomGameStoredData=;Coins=false;Volume=1;InitialScreen=1,3,6,6,3_10,4,9,10,8_6,3,8,5,4_10,8,7,7,8_5,4,4,8,1_7,8,5,9,10;SBPLock=true';}
  static updateResponse(balance,index=1,counter=2){return `balance_bonus=0.00&balance=${balance}&balance_cash=${balance}&stime=${Date.now()}&index=${index}&counter=${counter}`;}
}
