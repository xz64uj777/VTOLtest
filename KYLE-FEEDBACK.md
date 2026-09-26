# Kyle fly feedback → Osprey Flight v10

Short list for anyone uploading to https://github.com/xz64uj777/VTOL

**Note:** **v10 zip is the CTOL-roll / Casual-rotate / audio-grit / cam-shake / gear-lock / EMER slice.** Do **not** overwrite `osprey-best.zip` — Dude flips best. Dude DMs Kyle the zip.

## Asked for (2026-09-23) — after v9 fly (Player BLOCK + live)

1. **F-35 CTOL takeoff broken** — full THR topped ~52 kt; rotate needs ~74 kt (roll accel / drag, not gate alone)
2. **Casual stick-up pitched opposite of rotate** — UI said nose UP but fought rotate on roll
3. **Audio still staticy** — high-alt / modulation grit
4. **Screen/cam shake after ~200 ft**
5. **F-35 on roll felt airborne** while still on deck (free attitude float)
6. **Gear retractable on ground** — must lock DOWN on deck
7. Begin **real control panel / emergency** style (beyond thin DECK)
8. HUD **FL** chip = flight level (alt_ft/100) — **not a bug**; leave it

## What v10 shipped

| Area | Change |
|------|--------|
| F-35 CTOL roll | Stronger `rollPush`, lower WOW rolling friction / gear+parasite drag, higher CTOL spool — full THR clears **~85–95 kt** (past ~70 kt rotate) |
| Casual rotate | F-35 `noseUpCmd = -cyclicPitch` so **Casual stick-up = +pitch = rotate / AoA**; tip aligned; WOW settle never cancels held stick-up |
| WOW attitude | Bank hard-pinned on deck; pitch authority only near rotate speed + stick; nosewheel/yaw steer |
| Audio | **LFO depth forced 0**; noise/scream/AB cut; tighter Hz/gain caps — no high-alt static wash |
| Camera | Removed agl height term + chase velocity lead; harder snap threshold; heavier damp — no ~200 ft shake |
| Gear lock | `trySetGearDown` + hard pin while `onGround`; retract refused on deck / low AGL |
| EMER | Deck EMER strip + Systems **EMER** panel (gear DOWN, flaps FULL, THR CUT, mode→CTOL/APL) |
| FL chip | Documented: FL = round(alt_ft/100); shows above ~1000 ft AGL |

## Still good from v3–v9 (don’t regress)

1. Settings / Systems pause; close does not auto-resume; mute in menu
2. Gyro zero freezes after Cal; sticky tilt 5s holdover; hide cyclic when Tilt ON
3. Casual stick-up = nose UP (Osprey HEL unchanged); yaw bar L; TCL/NAC right; big ALT; FL when high; LEVEL gauge
4. Convert lift bridge; chase tether / sanitize / NaN guards
5. Distinct Osprey slap vs F-35 roar; touch cam double-tap; deck gear/flaps; airport; CTOL taxi; cold start; runway; far scenery; Hangar in Settings+confirm only; no F-35 hop

## Softs still parked

- F-35 AOA HUD still a bit noisy in VL sink
- Envelope warnings can overwrite hover tips
- Synth WebAudio (not recorded samples) — grit reduced but still synthetic
- Parking brake / lights mostly UI (brake bites on CTOL deck until THR breaks it)
- Scenery still canvas props; EMER is a thin start (not full Extreme-Landings panel pack)
- Realistic F-35 cyclic still heli-style (stick-up → nose down), not classic aero stick-forward

## How to verify v10

- F-35: VEC aft, gear DOWN, PARK off, full THR → roll past **~74–90 kt** → Casual stick-up → rotate → climb
- Casual stick-up raises nose on CTOL roll (helps rotate); Osprey HEL Casual still OK
- Audio clean at altitude (no static/LFO grit)
- Climb past ~200 ft: chase stable, no shake
- On deck: wings pinned; gear toggle cannot go UP; airborne retract OK
- DECK EMER strip + Menu → EMER usable on phone
- FL chip = flight level, not a fault light
