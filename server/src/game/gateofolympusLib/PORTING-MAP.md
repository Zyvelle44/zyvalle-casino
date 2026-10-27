# Gates of Olympus PHP → Node.js library port

Location: `server/src/game/gateofolympusLib/`

This folder splits the PHP source into class-per-file JavaScript modules using the PHP class names. The Express game endpoint remains the host/orchestrator because it owns MySQL transactions, session locking, wallet updates, and the current Zyvalle database schema. Core reel generation, win checking, scatter checks, Buy Free Spins scatter placement, and multiplier discovery now call the split modules rather than duplicate implementations in `gatesOfOlympus.js`.

## Source mapping

| PHP source | Node.js module |
|---|---|
| `GameReel.php` | `GameReel.js` |
| `SlotSettings.php` | `SlotSettings.js` |
| `Server.php` | `Server.js` |
| `PragmaticLib/GameSettings.php` | `GameSettings.js` |
| `PragmaticLib/Loader.php` | `Loader.js` |
| `PragmaticLib/Log.php` | `Log.js` |
| `PragmaticLib/Spin.php` | `Spin.js` |
| `PragmaticLib/Collect.php` | `Collect.js` |
| `PragmaticLib/Formatter.php` | `Formatter.js` |
| `PragmaticLib/LogAndServer.php` | `LogAndServer.js` |
| `PragmaticLib/SlotArea.php` | `SlotArea.js` |
| `PragmaticLib/WinChecker.php` | `WinChecker.js` |
| `PragmaticLib/FreeSpin.php` | `FreeSpin.js` |
| `PragmaticLib/BuyFreeSpins.php` | `BuyFreeSpins.js` |
| `PragmaticLib/Multiple.php` | `Multiple.js` |
| `PragmaticLib/WinPermission.php` | `WinPermission.js` |
| `PragmaticLib/Jackpots.php` | `Jackpots.js` |
| `PragmaticLib/SlotBank.php` | `SlotBank.js` |
| `PragmaticLib/SwitchMoney.php` | `SwitchMoney.js` |
| `PragmaticLib/Statistic.php` | `Statistic.js` |
| `PragmaticLib/SpinDispenser.php` | `SpinDispenser.js` |
| `init.php` | `init.txt` + `init.js` (the current server's `gates-of-olympus-init.json` remains the runtime config source) |
| `reels.txt` | `reels.txt` |
| `RTP.G6` | `RTP.G6` + `RTP.js` parser |

Additional state/result helpers (`FreeSpinState.js`, `BuyFreeSpinsState.js`, `SpinState.js`, `SpinResult.js`, `FormatterState.js`) keep state transitions separately testable.

## Important porting boundary

PHP code relies on Laravel models (`User`, `Game`, `GameBank`, `JPG`, `GameLog`, `StatGame`), locks, callbacks, and serialization. Those framework operations cannot be copied literally into Node. In this project, the Express route continues to own MySQL transactions and session persistence; the corresponding modules expose calculation/result records or accept persistence callbacks instead of reaching into Laravel ORM globals.

`SpinDispenser.php` in the supplied reference contains comments but no implementation body; `SpinDispenser.js` implements the state classification described by those comments. The supplied PHP `Jackpots.php` defines jackpot contribution to pools, not a jackpot-trigger/payout rule. No undocumented jackpot win trigger has been invented.

RTP target values and `RTP.G6` are configuration inputs, not proof of a statistically calibrated RTP. A real RTP guarantee requires a tested reel distribution/paytable model and a large simulation run.

## Run checks

From `server/`:
```powershell
node --check src/game/gatesOfOlympus.js
node --test test/gateofolympusLib.test.js
npm run dev
```
