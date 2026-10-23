/**
 * Radio briefing from "R.", the previous technician, during the first minutes
 * of a real night. Times are simulation seconds and line up with the actual
 * gate releases (Containment A 55 s, Acoustics 99 s, Containment B 110 s).
 * One system per message, in plain language.
 */
export const RADIO_BRIEFING = [
  { at: 5, text: "Hey. You're the new one. Nothing's loose yet, so breathe. I'll walk you through it." },
  { at: 16, text: "Middle screen on the desk is your cameras. Sit down with E, flip through them with the number keys." },
  { at: 29, text: 'Every door has a panel next to it. Top button shuts the door. Bottom button lights the corridor behind it.' },
  { at: 42, text: "Everything runs off one battery. Doors eat it fastest. Don't leave things on for nothing." },
  { at: 57, text: "Hear that? Containment A just unlocked. The tall one's out. In a corridor: light that corridor. At your door: shut it." },
  { at: 101, text: 'Something in Acoustics woke up. If you hear scraping in the vents, go quiet. Fan off, radio off, hands off the doors.' },
  { at: 114, text: "And B's open. The pale one. Look at it now and then. Never stare at it. Never forget about it." },
  { at: 133, text: "The big one sleeps till late. When it's at a door, a door won't hold it. Lever on the back wall. Hold the field till it leaves." },
  { at: 152, text: "That's everything I know. Six o'clock comes. It always does. ...I have to go." }
];
