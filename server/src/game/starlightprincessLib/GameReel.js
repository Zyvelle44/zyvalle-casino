/** PHP port: GameReel.php; reads reels.txt in the supplied game directory. */
import fs from 'node:fs';
import path from 'node:path';
export default class GameReel {
  constructor(reelsPath = path.resolve(process.cwd(), 'src/game/gateofolympusLib/reels.txt')) {
    this.reelsStrip = Object.fromEntries(Array.from({length:6},(_,i)=>[`reelStrip${i+1}`,[]]));
    this.reelsStripBonus = Object.fromEntries(Array.from({length:6},(_,i)=>[`reelStripBonus${i+1}`,[]]));
    if (fs.existsSync(reelsPath)) {
      for (const line of fs.readFileSync(reelsPath,'utf8').split(/\r?\n/)) {
        const [key, ...rest] = line.split('=');
        if (!key || !rest.length) continue;
        const target = this.reelsStrip[key] || this.reelsStripBonus[key];
        if (target) target.push(...rest.join('=').split(',').map(s=>s.trim()).filter(Boolean));
      }
    }
  }
}
