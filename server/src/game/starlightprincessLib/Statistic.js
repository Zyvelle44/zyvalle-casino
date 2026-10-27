/** PHP port: PragmaticLib/Statistic.php; creates a normalized stats record. */
export default class Statistic {
  static setStatistic(user,win,game,bank,bet,toSlotBank,toJackpot,toProfit,fs,slotArea) {
    const totalBank=['slots','bonus','fish_bank','table_bank','little'].reduce((s,k)=>s+Number(bank?.[k]||0),0);
    return {user_id:user?.id,balance:Number(user?.balance||0),bet:Number(bet||0),win:Number(win||0),game:`${game?.name||game?.title||'Gates of Olympus'}${fs?' FS':''}`,in_game:Number(toSlotBank||0),in_jpg:Number(toJackpot||0),in_profit:Number(toProfit||0),denomination:game?.denomination||'USD',shop_id:user?.shop_id,slots_bank:Number(bank?.slots||0),bonus_bank:Number(bank?.bonus||0),fish_bank:Number(bank?.fish_bank||0),table_bank:Number(bank?.table_bank||0),little_bank:Number(bank?.little||0),total_bank:totalBank};
  }
}
