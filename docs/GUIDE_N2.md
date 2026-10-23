# Night 2 guide

Night 2 is where the game stops holding your hand. There is no radio briefing, every subject starts awake, and they come more often. What beat Night 1 still works, but it is no longer enough on its own. This guide adds **six habits** that the Nights 3 to 5 guides build on.

Read the [Night 1 guide](GUIDE_N1.md) first if you have not. Everything in it still applies.

## What changes from Night 1

| | Night 1 | Night 2 |
| --- | --- | --- |
| Radio briefing | Yes | No |
| Levels at 12 AM (Wanderer / Observer / Echo / Patient) | 3 / 2 / 1 / 0 | 5 / 4 / 3 / 1 |
| Levels at 5 AM | 7 / 6 / 5 / 3 | 11 / 10 / 9 / 7 |
| Patient | Asleep until 3 AM | **Awake from midnight** |
| Echo visits to the station | about 2 | about 5 or 6 |
| Patient visits to the West door | about 1 | about 3 |
| Power left at 6 AM (careful player) | about 30% | about 20% |

Hourly levels:

| Subject | 12 AM | 1 AM | 2 AM | 3 AM | 4 AM | 5 AM |
| --- | --- | --- | --- | --- | --- | --- |
| Wanderer | 5 | 6 | 7 | 8 | 9 | 11 |
| Observer | 4 | 5 | 6 | 7 | 8 | 10 |
| Echo | 3 | 4 | 5 | 6 | 7 | 9 |
| Patient | 1 | 2 | 3 | 4 | 5 | 7 |

The cells unlock at the same times every night: Containment A at 12:30, the Acoustics Lab at 12:54, Containment B at 1:00, the Isolation bulkhead at 2:00.

**The Patient is the big change.** The Isolation bulkhead still opens at 2:00, but the Patient does not need it: there is a slow back route from the Isolation Ward through Cold Storage (CAM 06) to the West Corridor. On Night 2 it usually reaches the West door around 2:50, and sometimes before 2 AM.

## The six habits

These were found by simulating thousands of nights and testing each habit on its own. Together they take Night 5 from about 38% survival to about 77% for the same scripted player.

### 1. Set the station lights to low

On the **emergency power panel**, press `E` to switch the station lights from NORMAL to LOW. Do it at the start of the night.

Low lights draw less power and make less noise. That gives you more battery at 5 AM and more margin under the Echo's line. The station gets darker, but nothing about the creatures changes.

### 2. Light a corridor only while the Wanderer is in it

On Night 1 the guide said to light the corridor when the Wanderer reaches the Central Junction. From Night 2, wait until it is actually **in** the West or East Corridor (CAM 08 or CAM 09), and switch the light off as soon as it leaves. Lighting early costs more power than it saves.

### 3. Use the field alone for the Patient

When the Patient is at the West door and the Echo is not in the vents, pull the field lever and **leave the door open**. While the field is on, the Patient cannot come in at all, so a shut door adds nothing but drain (another 6.6% per minute on top of the field's 9%).

If something else is at that door too, shut the door as usual.

### 4. Discharge the auxiliary cell only while the Echo is far away

The auxiliary cell in the electrical room gives +15% once. **Discharging it makes a loud bang** that lasts several seconds. If the Echo is in the shaft (CAM 12) or the duct, that bang lets it in. Before you hold `E` on the cell, check CAM 12 and listen for scraping. If the vents are quiet, go ahead. Aim to use it somewhere below 15%, and before the power runs out.

This one habit is worth more than any other on Nights 3 to 5.

### 5. Do not rush the doors, and do not open one while the Echo is overhead

Every creature waits a few seconds after reaching a doorway before its first try: at least 7 seconds for the Wanderer and almost 10 for the Observer. You do not need to close a door the instant something appears. Closing it within a few seconds is just as safe, and you never need to close a door before anything is there.

While the Echo is in the duct above you, **leave doors as they are**. Opening a door is as noisy as closing one. Open it again once the Echo has gone.

### 6. Patient and Echo at the same time: shut the door and wait

On Night 2 this happens about once a night. The field is too loud while the Echo listens.

1. Shut the West door.
2. Keep the fan and radio off. Listen for the Patient's pushes: each one is a groan from the West door (`[The west door groans under a slow weight]`). The fifth push breaks the motor.
3. The Echo gives up after about 30 seconds of silence. As soon as it has left, pull the field lever. You can open the door again once the field is on.

## Step by step

### 12:00 to 12:30

1. Set the station lights to **low** on the emergency power panel.
2. Sit at the workstation and check CAM 03 (Isolation Ward) and CAM 06 (Cold Storage). The Patient may already be moving, slowly, toward Cold Storage.
3. Leave the fan on for now. The Echo is still sealed in.

### 12:30 to 2:00

- **12:30, the Wanderer.** Watch CAM 07, 08 and 09. Light a corridor only while it stands in it.
- **12:54, the Echo.** It reaches the vents fast now: often by 1:30, sometimes by 1:05. From here on, any scraping means fan off and radio off. Wait it out; it leaves after about half a minute of silence, and it will come back several times.
- **1:00, the Observer.** Start your glances: find it, look for two or three seconds, move on. About every 20 to 30 seconds.

### 2:00 to 6:00

- The Patient now comes regularly, nearly always to the **West door**. Field alone, about 22 seconds, door open. If the Echo is overhead, use habit 6.
- Keep the routine from the Night 1 guide: listen, doorways, corridors, Observer, Patient, power.
- Most Night 2 losses happen after 5 AM, when everything is at its strongest. Do not let power run low before then.

## Power

A careful player ends Night 2 with about **20%**, and rarely below 12%. Roughly half of runs use the auxiliary cell. If you are below 25% at 4 AM, start saving: turn off lights the moment they are not needed, open doors as soon as the doorway is clear, and use the cell when the vents are quiet.

## How players fare on Night 2

From 300 simulated nights per play style:

| Play style | Survival |
| --- | --- |
| Night 1 guide only | 90% |
| Night 1 guide plus the six habits | 97% |
| The same, but slower: 5 s reactions, Observer glance every 40 s | 97% |

The Echo still causes the most losses. Quiet, patient play wins Night 2.

---

*Numbers come from the game's own simulation with a scripted player that sees every camera at once. Expect a little less in practice.* Next: [Night 3](GUIDE_N3.md).
