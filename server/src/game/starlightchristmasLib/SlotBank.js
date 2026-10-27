/** PHP port: PragmaticLib/SlotBank.php; returns proposed bank movements. */
export default class SlotBank {
  static addBank(totalBet, bank, toJackpot, toProfit, toBonus) {
    const toBank=Number(totalBet)-Number(toJackpot)-Number(toProfit);
    return {toBank,slotsDelta:toBonus?0:toBank*0.5,bonusDelta:toBonus?toBank:toBank*0.5};
  }
}
