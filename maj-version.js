/**
 * Estampille la version — `node maj-version.js`
 *
 * À lancer avant chaque commit qui touche l'appli. Le script écrit la même
 * estampille dans version.json et dans index.html : l'appli chargée connaît
 * ainsi sa propre version et peut la comparer à celle du serveur, qu'elle
 * relit sans passer par le cache. Quand les deux diffèrent, la page ouverte
 * sur l'iPad est périmée et propose de se recharger.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const d = new Date();
const p = (n) => String(n).padStart(2, '0');
const version = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;

fs.writeFileSync(path.join(__dirname, 'version.json'),
  JSON.stringify({ version }, null, 2) + '\n');

const cible = path.join(__dirname, 'index.html');
const src = fs.readFileSync(cible, 'utf8');
const motif = /var VERSION = '[^']*';/;
if (!motif.test(src)) {
  console.error("Impossible de trouver la ligne VERSION dans index.html.");
  process.exit(1);
}
fs.writeFileSync(cible, src.replace(motif, `var VERSION = '${version}';`));

console.log('Version estampillée :', version);
