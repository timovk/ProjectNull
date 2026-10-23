// Writes docs/VOICE_LINES.md, the recording script, from the game's own content.
//   npm run voice:script
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VOICE_LINES, SPEAKERS } from '../src/content/VoiceLines.js';

const ORDER = ['R', 'TAPE', 'FACILITY'];

export function renderVoiceScript() {
  const count = (sp) => VOICE_LINES.filter((l) => l.speaker === sp).length;
  const out = [];
  out.push('# Voice lines: recording script');
  out.push('');
  out.push('This file is generated from the game\'s content by `npm run voice:script`. Do not edit it by hand; edit the lines in `src/content/` and regenerate.');
  out.push('');
  out.push(`There are **${VOICE_LINES.length} lines** to record: ${ORDER.map((sp) => `${count(sp)} for ${SPEAKERS[sp].name}`).join(', ')}. Lines that appear in several places are listed once.`);
  out.push('');
  out.push('## How to add a recording');
  out.push('');
  out.push('1. Record the line and save it as `public/voice/<file name>`, using the file name from the tables below. `.ogg`, `.mp3` and `.wav` all work.');
  out.push('2. Run `npm run dev` or `npm run build`. Both rescan the folder automatically; `npm run voice:manifest` does it on its own.');
  out.push('3. That line now plays your recording. Lines without a recording keep using the browser voice (Settings → Audio → Browser voices), or stay text-only if that is off.');
  out.push('');
  out.push('## Recording tips');
  out.push('');
  out.push('- Mono, 44.1 or 48 kHz. One line per file, one clean take.');
  out.push('- Record dry: a quiet room, no music, no effects, no reverb. The game adds the radio filter, the tape hiss and the hall echo itself.');
  out.push('- About 20 to 30 cm from the microphone. Aim for peaks around −6 dBFS; the game evens out loudness, but avoid clipping.');
  out.push('- Leave about 0.3 s of silence at the start and the end.');
  out.push('- The game never plays voices suddenly or loudly. It fades every clip in and caps its level, so do not shout to compensate.');
  out.push('- Say the line exactly as written. Text in the game stays the same even if the delivery varies a little.');
  out.push('');
  for (const sp of ORDER) {
    const lines = VOICE_LINES.filter((l) => l.speaker === sp);
    out.push(`## ${SPEAKERS[sp].name} (${lines.length} lines)`);
    out.push('');
    out.push(`**Direction:** ${SPEAKERS[sp].direction}`);
    out.push('');
    out.push('| # | File name | Line | When it plays |');
    out.push('| --- | --- | --- | --- |');
    lines.forEach((l, i) => {
      const when = l.contexts.length > 1 ? `${l.contexts[0]} (and ${l.contexts.length - 1} more)` : l.contexts[0];
      out.push(`| ${i + 1} | \`${l.id}.ogg\` | ${l.text.replace(/\|/g, '/')} | ${when} |`);
    });
    out.push('');
  }
  return `${out.join('\n')}\n`;
}

function main() {
  const dir = fileURLToPath(new URL('../docs/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}VOICE_LINES.md`, renderVoiceScript());
  console.log(`wrote docs/VOICE_LINES.md (${VOICE_LINES.length} lines)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
