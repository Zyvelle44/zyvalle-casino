/** Buy Free Spins trigger queue, preserving the PHP forced-scatter behavior. */
import BuyFreeSpins from './BuyFreeSpins.js';
export default class BuyFreeSpinsState {
  static prepare(slotArea, gameSettings = {}) {
    const screen = Array.isArray(slotArea) ? slotArea : slotArea?.SlotArea;
    if (!Array.isArray(screen)) throw new TypeError('BuyFreeSpinsState.prepare expects a slot-area array or { SlotArea } object');
    const scatterSymbol = Number(gameSettings.scatterSymbol ?? String(gameSettings.scatters || '1~').split('~')[0]);
    const needed = Number(gameSettings.settingsNeedFs ?? gameSettings.settings_needfs ?? 4);
    const compatibleSettings = {
      ...gameSettings,
      scatters: gameSettings.scatters || `${scatterSymbol}~`,
      settings_needfs: Number.isFinite(needed) ? needed : 4,
    };
    const forced = BuyFreeSpins.getFreeSpin(screen, compatibleSettings);
    return { ...forced, queued: true, source: 'buyFreeSpins' };
  }
}
