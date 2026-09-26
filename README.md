
## v11 drop

| You said (crew sheet) | This build |
|----------|------------|
| Nose rocks on the runway with no power | Parked: pitch command is zero and the nose is held level until you add speed or power. |
| Scenery hitch around 3000 / 6000 ft | Hills and clouds fade instead of popping. |
| F-35 full power, modest nose-up, low altitude stalls | Low-altitude power keeps energy. Extreme nose-up still bleeds. |
| Casual stick-up | Nose **up**. Invert pitch is still in Settings if a phone feels backwards. |

# Osprey Flight v11


## v11

| You said | This build |
|----------|------------|
| Free pitch on runway, no power (both) | Parked/idle: pitchCmd=0 + hard damp; authority ramps with speed/power |
| Scenery hitch ~3000 / ~6000 ft | World-locked hills/clouds; soft band fades (no hard cull pops) |
| F-35 full THR ~30° up low alt → stall | Low-AGL induced-drag cut + path thrust keep; still bleeds if extreme |

BG b375f6a merged (AoA sign, ground lock, scenery world-lock, cockpit, tilt). **Player CLEAR** — `osprey-best.zip` flipped to v11.


Phone/tablet flight sim — **Osprey** (V-22-style tiltrotor) + **F-35** (STOVL / CTOL / VL).  
Vite + React + TypeScript + canvas.

**v10:** F-35 CTOL roll clears rotate · Casual stick-up helps rotate · audio grit killed · cam shake fixed · gear locked on deck · EMER panel start. v3–v9 kept.

Repo target: https://github.com/xz64uj777/VTOL

**Handoff note:** **v11 Player CLEAR.** `osprey-best.zip` matches v11. GitHub `xz64uj777/VTOL` updated with cleared source.

---

## Kyle ask → v10

1. F-35 CTOL full THR must reach ≥74–90 kt (was capped ~52)
2. Casual stick-up = nose UP that helps rotate
3. Audio static / high-alt grit
4. Cam shake after ~200 ft
5. F-35 roll felt airborne on deck
6. Gear must not retract on ground
7. Begin emergency / control panel (thin)
8. FL chip = flight level (alt_ft/100) — not a bug

See `KYLE-FEEDBACK.md`.

---

## What v10 fixed

| Area | Change |
|------|--------|
| F-35 CTOL roll | Stronger roll push; cut WOW friction / gear+parasite drag; CTOL spool up — ~85–95 kt at full THR |
| Casual rotate | F-35 nose-up cmd aligned with Casual stick-up; WOW settle won't cancel held stick |
| WOW attitude | Bank pinned; pitch only near rotate + stick; nosewheel steer |
| Audio | LFO off; noise/scream cut; tighter clamps |
| Camera | No agl height term / chase lead; softer snap; heavier damp |
| Gear | Locked DOWN on ground; retract after airborne only |
| EMER | Deck EMER strip + Systems EMER checklist |
| FL | Flight level = round(alt_ft/100); shows ~1000 ft+ |

v3–v9 pause / tilt / convert bridge / sanitize / deck / far scenery / Hangar-chrome retained.

---

## Run

```bash
cd /workspace/osprey-flight   # or your clone
npm install
npm run dev
```

Dev: port **8091**. Typecheck: `npm run build`.

---

## Control layout (text)

```
TILT OFF (cyclic mode)                    TILT ON (gyro cyclic)
┌────────────────────────────┐           ┌────────────────────────────┐
│  [CYC stick]                │           │                             │
│  [==== YAW bar L|R ====]    │   …sky…   │  [==== YAW bar L|R ====]    │
│         [ DECK + EMER ]     │  drag to  │         [ DECK + EMER ]     │
│                    [TCL][NAC]│  pan cam  │                    [TCL][NAC]│
│                    (or VEC) │           │                    (or VEC) │
└────────────────────────────┘           └────────────────────────────┘
 Deck chips: Menu · Settings · Tilt · Cal · Cam · Pause
 Cam: CHASE → WING → TOWER → PAD → ORBIT · double-tap Cam = reset view
 HUD: LEVEL gauge · cam mode label · FL = flight level (not a fault)
```

- **CYC** — spring. Casual: up = nose UP.
- **YAW** — bar, spring. L = nose left, R = nose right. On F-35 CTOL deck also steers nosewheel.
- **TCL / THR** — absolute hold (power). Cold start = 0.
- **NAC / VEC** — absolute hold. Cold = APL / CTOL (0).
- **Sky drag** — pan camera offset; **double-tap** — reset view.
- **DECK** — gear / flaps / gauges + **EMER** strip (Intermediate+ on by default).
- **Settings / Menu** — pause under the sheet; Resume explicitly. Audio muted while open. Hangar via Settings confirm only.

---

## How to fly — Osprey

1. Spawns on **VTOL pad**, **cold APL** (nacelles forward), THR 0, flaps 0, gear DOWN.
2. For hover: raise **NAC** toward HEL, then **TCL** to lift (~70% OGE hover band).
3. Or keep APL and use power + pitch for airplane-style departure once clear.

## How to fly — F-35 CTOL (v10)

1. Spawns on **runway**, **VEC aft (CTOL)**, THR 0, flaps 0, gear DOWN, PARK set.
2. PARK off (or break with THR), full **THR** — accelerate past **~70–90 kt**.
3. **Casual stick-up** (nose UP) to rotate → climb. Gear retract only once airborne.
4. STOVL/VL: raise VEC for vector / lift-fan hover as before.

---

## Player fly sheet (CTOL → rotate)

1. Hangar → F-35 → cold runway (VEC CTOL, gear DOWN).
2. PARK off · full THR · stay straight with yaw.
3. Watch SPD climb past **~74 kt** (should reach **~85–95** if you hold it).
4. **Casual stick-up** = nose UP → rotate → climb.
5. Raise gear only after leave-ground; use DECK **EMER** if you need gear DOWN / THR CUT fast.
