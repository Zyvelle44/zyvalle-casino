/** Result normalizer used to compare PHP-compatible result payloads. */
export default class SpinResult {
  static normalize({slotArea,win,log,server=[]}) {return {slotArea:slotArea?.SlotArea||[],symbolsAfter:slotArea?.SymbolsAfter||[],symbolsBelow:slotArea?.SymbolsBelow||[],win:Number(win?.TotalWin||0),winLines:win?.WinLines||[],state:log?.State||'Spin',server};}
}
