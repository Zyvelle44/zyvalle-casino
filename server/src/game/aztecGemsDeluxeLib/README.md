# Aztec Gems Deluxe backend port

Backend entry point: `src/game/aztecGemsDeluxe.js` (already imported by `src/index.js`).

## PHP reference mapping
- `Server.php`: `/game/AztecGemsDeluxe/server` and `/game/AztecGemsDeluxeM/server`, `doInit`, `doSpin`, `update`, `reloadBalance`, `doCollect`, and the three gamble actions.
- `SlotSettings.php`: symbols 2–9, wild symbol 2, pay values 25/20/15/12/10/8/5/2, five paylines, 15 free spins configuration, and the supplied bet choices.
- `GameReel.php` / `reels.txt`: three active reel strips, read from this directory.
- Spin multiplier strip: the weighted `$mplReel` array in `Server.php` (1x four times, 2x four times, 3x four times, 5x three times, 10x twice, 15x twice).

## Persistence and safety
- Uses the project's `users` and `wallets` tables.
- Creates/reuses `game_sessions` and `game_rounds`, following the schema used by the other game backends.
- Locks the session and wallet rows during actions, and commits wallet changes, state, and round history together.
- Spin stake is 5 lines × coin bet. Spin wins are credited immediately, as in the supplied PHP.
- `doCollect` is display-only, matching the PHP handler.
- Session state stores the latest reels, win amount, and gamble dealer card.

## Source limits preserved
The supplied PHP depends on Laravel-only values that are not included in the reference ZIP (`Game::get_lines_percent_config`, shop RTP/percent, game bank, and `game->rezerv`). Those cannot be ported exactly from these files alone. This port uses the reference's reel/payline/payout algorithm and weighted multiplier strip, with a default 1-in-2 gamble chance where `rezerv` is missing.
The supplied PHP explicitly sets `slotBonus = false` and uses `$scatter = 'NONE'`; therefore free spins/scatter bonuses are not enabled by that reference and `freespin` returns `invalid bonus state`. No invented bonus behavior has been added.
