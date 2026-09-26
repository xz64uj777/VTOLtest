# Osprey Flight — improvements log

## v10 (2026-09-23)

- **F-35 CTOL roll (HARD):** stronger WOW `rollPush`; cut `rollMu` at full THR; `F35_WOW_DRAG_SCALE` / `F35_WOW_GEAR_DRAG`; higher CTOL rpm spool — full THR reaches ~85–95 kt (past ~70 kt rotate). Rotate speed gate slightly eased to 36 m/s (~70 kt).
- **Casual pitch → rotate:** F-35 `noseUpCmd = -cyclicPitch` so Casual stick-up raises +pitch (rotate + AoA); tip/stoPush aligned; WOW settle only when stick dead.
- **WOW deck feel:** hard bank pin; pitch authority ramps near rotate speed; no airborne roll float on deck.
- **Audio:** LFO modulation forced off; noise/scream/AB reduced; Hz/gain ceilings tightened — kills high-alt static grit.
- **Camera:** removed agl-linked chase height + velocity lead; harder snap gate; heavier damp — no shake past ~200 ft.
- **Gear lock:** `trySetGearDown` + `onGround` hard pin; retract refused on deck / low AGL; extend always OK.
- **EMER start:** Deck EMER strip + Systems Menu EMER (gear DOWN, flaps FULL, THR CUT, mode→CTOL/APL).
- **FL chip:** documented as flight level (alt_ft/100) — not a bug.
- Hangar title **Osprey Flight v10**; package **10.0.0**.

## v9

- **Far scenery:** altitude-scaled horizon/grid; craft-following fields/trees; far LOD ridges/clouds past 1k–5k ft.
- **Audio:** clamp all Hz / filter / gain; LFO depth capped under master; soften extremes; no NaN AudioParams.
- **Camera:** chase clamp `y ≥ craft + min` and look pitch so view never from under belly; altitude damps pitch/roll coupling; v6/v7 craft-in-view tether; less jitter; touch offsets + double-tap reset kept.
- **F-35 CTOL ground (jet-specific):** hard pin + critical vertical damp; no Osprey `plantGear` spring fight on CTOL; leave-ground only on clear rotate (speed+pitch+thrust) with air hysteresis; smooth low-speed taxi.
- **Hangar chrome:** Hangar removed from flight deck bar; Settings confirm only; crash banner still has Hangar.

## v8

- **F-35 CTOL ground (HARD):** gear+WOW+VEC near CTOL pins `y` to gear height; kills lift-fan / GE / convert-bridge vertical; throttle→forward roll; nosewheel steer + rudder with speed; pitch-up rotate to lift off. VL/STOVL can still hover-taxi.

## Earlier (v3–v7 highlights)

- Mute/pause sheets; tilt sticky + Cal freeze; Casual stick-up = nose UP; LEVEL gauge; DeckPanel; touch cam; cold start; runway segments; convert lift bridge; sanitize / NaN guards; distinct Osprey slap vs F-35 roar.
