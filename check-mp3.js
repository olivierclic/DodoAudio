// Usage: node check-mp3.js "C:\path\to\file.mp3"
// Or for a folder: node check-mp3.js "C:\path\to\folder"
const jsmediatags = require('jsmediatags');
const fs = require('fs');
const path = require('path');

function check(file) {
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: (tag) => {
        console.log('\n=== ' + path.basename(file) + ' ===');
        console.log('Format: ' + tag.type + ' / version: ' + (tag.version || 'n/a'));
        const t = tag.tags || {};
        console.log('  title:  ' + (t.title || '(absent)'));
        console.log('  artist: ' + (t.artist || '(absent)'));
        console.log('  album:  ' + (t.album || '(absent)'));
        if (t.picture) {
          console.log('  PICTURE: ' + t.picture.format + ', ' + (t.picture.data?.length || 0) + ' octets');
          console.log('  -> Type de pochette: ' + (t.picture.type || 'unknown') + ' / description: "' + (t.picture.description || '') + '"');
        } else {
          console.log('  PICTURE: AUCUNE pochette embarquée');
        }
        // Show all other frames (raw IDs) to help diagnose unusual formats
        const standardKeys = new Set(['title','artist','album','picture','year','comment','track','genre','TIT2','TPE1','TALB','APIC']);
        const extra = Object.keys(t).filter(k => !standardKeys.has(k));
        if (extra.length > 0) console.log('  Autres champs: ' + extra.join(', '));
        resolve();
      },
      onError: (err) => {
        console.log('\n=== ' + path.basename(file) + ' ===');
        console.log('  ERREUR: ' + JSON.stringify(err));
        resolve();
      }
    });
  });
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.log('Usage: node check-mp3.js "C:\\path\\to\\file.mp3"');
    console.log('   ou: node check-mp3.js "C:\\path\\to\\folder"');
    process.exit(1);
  }
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    const files = fs.readdirSync(target).filter(f => /\.(mp3|m4a|mp4|flac|ogg|wav)$/i.test(f));
    console.log('Trouvé ' + files.length + ' fichiers audio');
    for (const f of files) {
      await check(path.join(target, f));
    }
  } else {
    await check(target);
  }
}
main();
