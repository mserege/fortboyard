/**
 * Contrôles des règles du jeu — `node test.js`
 *
 * On extrait le script de index.html et on l'exécute avec un DOM factice,
 * pour vérifier les règles (clés, secondes, paliers, indices) sans navigateur.
 */
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// --- DOM factice : juste assez pour que le script se charge ---
const noeud = () => new Proxy(function () {}, {
  get: (t, k) =>
    k === 'style' || k === 'dataset' || k === 'classList' ? noeud()
    : k === 'hidden' || k === 'disabled' || k === 'checked' ? false
    : k === 'textContent' || k === 'innerHTML' || k === 'value' ? ''
    : k === 'length' ? 0 : noeud(),
  set: () => true,
  apply: () => noeud()
});
global.document = {
  getElementById: noeud, querySelector: noeud, querySelectorAll: () => [],
  createElement: noeud, addEventListener() {}, visibilityState: 'visible'
};
global.window = {};
global.localStorage = { getItem: () => null, setItem() {} };
global.setInterval = () => 0;
global.clearInterval = () => {};
global.setTimeout = () => 0;
global.confirm = () => false;

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
vm.runInThisContext(script);

// --- micro-harnais ---
let ok = 0, ko = 0;
const t = (nom, reel, attendu) => {
  const bon = JSON.stringify(reel) === JSON.stringify(attendu);
  console.log((bon ? '  ok    ' : '  ÉCHEC ') + nom + '  → ' + JSON.stringify(reel) +
              (bon ? '' : '  (attendu ' + JSON.stringify(attendu) + ')'));
  bon ? ok++ : ko++;
};
const titre = (s) => console.log('\n— ' + s + ' —');

// --- helpers de mise en situation ---
const poserTempsForts = (n) => {
  JOURS.forEach(j => { etat.jours[j.id].tempsForts = []; });
  for (let i = 0; i < n; i++) etat.jours[JOURS[i % 7].id].tempsForts.push({ statut: 'valide' });
};
const jouerLundi = (reussies) => {
  etat.jours.lundi.epreuves = {};
  epreuvesDuJour('lundi').forEach((e, i) => {
    etat.jours.lundi.epreuves[e.id] = { statut: i < reussies ? 'reussie' : 'ratee' };
  });
};
const indiceLundi = () => {
  const r = indiceRevele('lundi');
  if (r.etat !== 'revele') return r.etat;
  let s = '';
  for (let i = 0; i < r.mot.length; i++) s += r.caches[i] ? '_' : r.mot[i];
  return s;
};
const trous = (s) => (s.match(/_/g) || []).length;

titre('Le compte des clés');
t('épreuves un lundi', epreuvesDuJour('lundi').length, 4);
t('épreuves un samedi', epreuvesDuJour('samedi').length, 5);
t('total de la semaine', clesMaxSemaine(), 30);
t('le seuil de la porte est atteignable', etat.reglages.seuilPorte < clesMaxSemaine(), true);

titre('Les secondes dans la salle du trésor');
poserTempsForts(0); t('0 temps fort → le plancher', secondesDansLaSalle(), 25);
poserTempsForts(2); t('2 temps forts', secondesDansLaSalle(), 45);
poserTempsForts(5); t('5 temps forts', secondesDansLaSalle(), 75);
poserTempsForts(9); t('9 temps forts → le plafond', secondesDansLaSalle(), 90);

titre('Les paliers de butin');
t('19 boyards', butinPour(19), '1 carte');
t('20 boyards', butinPour(20), '2 cartes');
t('34 boyards', butinPour(34), '2 cartes');
t('35 boyards', butinPour(35), '3 cartes');
t('54 boyards', butinPour(54), '3 cartes');
t('55 boyards', butinPour(55), 'Le booster complet');

titre("L'indice gradué");
const NB = epreuvesDuJour('lundi').length;
jouerLundi(NB); t('tout réussi : le mot entier', indiceLundi(), etat.indices.lundi);
jouerLundi(1); t('1 seule réussie : rien du tout', indiceLundi(), 'verrouille');
jouerLundi(0); t('rien réussi : rien du tout', indiceLundi(), 'verrouille');

// L'invariant central : une épreuve ratée de plus cache une lettre de plus.
[NB - 1, NB - 2].forEach((n) => {
  jouerLundi(n);
  t(n + '/' + NB + ' réussies → ' + (NB - n) + ' trou(s)  [' + indiceLundi() + ']', trous(indiceLundi()), NB - n);
});

// Et jamais plus de trous que de lettres, même sur un mot très court.
etat.indices.lundi = 'OR';
[NB - 1, NB - 2, 2].forEach((n) => {
  jouerLundi(n);
  t('mot « OR », ' + n + '/' + NB + '  [' + indiceLundi() + ']', trous(indiceLundi()), Math.min(NB - n, 2));
});
etat.indices.lundi = ENIGMES[0].mots[0];

// L'initiale reste visible le plus longtemps possible : c'est ce qui rend le mot devinable.
jouerLundi(NB - 2);
t("l'initiale survit à 2 trous", indiceLundi()[0], etat.indices.lundi[0]);

titre('Les épreuves et leurs fenêtres');
EPREUVES.forEach((e) => {
  const souci =
    !e.gestes.length ? 'aucun geste'
    : e.gestes.some(g => !texteGeste(g) || !texteGeste(g).trim()) ? 'un geste sans texte'
    : minutesDe(e.fenetre[1]) <= minutesDe(e.fenetre[0]) ? 'la fenêtre se ferme avant de s\'ouvrir'
    : null;
  t(e.glyphe + ' ' + e.nom + ' (' + e.fenetre.join('→') + ')', souci, null);
});
t('tous les gestes sont de simples textes',
  EPREUVES.every(e => e.gestes.every(g => typeof g === 'string')), true);
t('aucune épreuve ne porte de chrono',
  EPREUVES.every(e => e.defi === undefined), true);
t('chaque fenêtre laisse au moins 15 min',
  EPREUVES.every(e => minutesDe(e.fenetre[1]) - minutesDe(e.fenetre[0]) >= 15), true);

// Les fenêtres d'un jour de semaine ne doivent pas se chevaucher.
const enSemaine = epreuvesDuJour('lundi').slice().sort((a, b) => minutesDe(a.fenetre[0]) - minutesDe(b.fenetre[0]));
enSemaine.forEach((e, i) => {
  if (i === 0) return;
  const prec = enSemaine[i - 1];
  t('« ' + e.nom + ' » commence après « ' + prec.nom + ' »',
    minutesDe(e.fenetre[0]) >= minutesDe(prec.fenetre[1]), true);
});

titre('Le bac à sable');
[[30, 7], [24, 4], [21, 1], [15, 0]].forEach(([cles, tf]) => {
  remplirSemaine(cles, tf);
  t('semaine remplie à ' + cles + ' clés', clesSemaine(), Math.min(cles, clesMaxSemaine()));
  t('  et ' + tf + ' temps forts → ' + secondesDansLaSalle() + ' s', tempsFortsValides(), tf);
});
remplirSemaine(24, 4);
t('le remplissage produit des journées partielles',
  JOURS.some(j => { const n = nbReussies(j.id); return n > 0 && n < epreuvesDuJour(j.id).length; }), true);
t('jamais plus de 2 temps forts par jour',
  JOURS.every(j => etat.jours[j.id].tempsForts.length <= etat.reglages.tempsFortsMaxParJour), true);
t('le remplissage n\'écrit aucune épreuve « ratée »',
  JOURS.some(j => Object.values(etat.jours[j.id].epreuves).some(e => e.statut === 'ratee')), false);
remplirSemaine(24, 4); viderJour('lundi');
t('« rejouer ce jour » rouvre bien la journée', nbReussies('lundi'), 0);
t('  sans toucher au reste de la semaine', clesSemaine() > 0, true);
t('la simulation force le jour', (etat.simulation = { jour: 'dimanche' }, idDuJour()), 'dimanche');
t("la simulation force l'heure", (etat.simulation = { heure: '07:30' }, minutesMaintenant()), 450);
etat.simulation = null;
t('sans simulation, on revient au temps réel', enSimulation(), false);

titre('La réserve d\'énigmes');
t('au moins trois mois de jeu', ENIGMES.length >= 12, true);
ENIGMES.forEach((e, i) => {
  const souci =
    e.mots.length !== 6 ? 'il ne faut pas ' + e.mots.length + ' mots mais 6'
    : e.mots.some(m => !m || !m.trim()) ? 'un mot est vide'
    : new Set(e.mots).size !== 6 ? 'deux mots identiques'
    : e.mots.some(m => normaliser(m) === normaliser(e.motCode)) ? 'un indice donne le mot-code'
    : !e.motCode.trim() ? 'mot-code vide'
    : null;
  t('énigme ' + (i + 1) + ' « ' + e.motCode + ' »', souci, null);
});
t('les six mots tombent sur les six jours',
  Object.keys(indicesDeLEnigme(0)).sort().join(), JOURS_INDICE.slice().sort().join());
t('la rotation boucle', indicesDeLEnigme(ENIGMES.length).lundi, indicesDeLEnigme(0).lundi);
t('chaque semaine change d\'énigme', indicesDeLEnigme(0).lundi !== indicesDeLEnigme(1).lundi, true);

titre('Le mot-code, tolérant aux accents et à la casse');
t('TRÉSOR vaut tresor', normaliser('TRÉSOR'), normaliser('tresor'));
t('ponctuation et espaces ignorés', normaliser(' Trésor ! '), 'TRESOR');

titre('La page de règles dit-elle la vérité ?');
{
  const regles = fs.readFileSync(path.join(__dirname, 'regles.html'), 'utf8');
  const visible = regles.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const hhmm = (v) => v.replace(/^0/, '').replace(':', 'h');

  EPREUVES.forEach((e) => {
    const creneau = hhmm(e.fenetre[0]) + ' → ' + hhmm(e.fenetre[1]);
    t('« ' + e.nom + ' » y figure', visible.includes(e.nom), true);
    t('  avec son créneau ' + creneau, visible.includes(creneau), true);
    e.gestes.forEach((g) => {
      const mot = texteGeste(g).toLowerCase();
      t('  geste « ' + mot + ' »', visible.toLowerCase().includes(mot), true);
    });
  });

  t('le total de clés annoncé', visible.includes('<strong>' + clesMaxSemaine() + ' clés</strong>'), true);
  t('le seuil de la porte annoncé',
    visible.includes(etat.reglages.seuilPorte + ' clés sur ' + clesMaxSemaine()), true);
  [['secondesPlancher', ' s'], ['secondesPlafond', ' s'], ['secondesParTempsFort', ' s'],
   ['tempsFortsMaxParJour', '']].forEach(([cle, unite]) => {
    t('réglage « ' + cle + ' » annoncé',
      visible.includes('>' + etat.reglages[cle] + unite + '<'), true);
  });
  t('les paliers de boyards annoncés',
    visible.includes(etat.reglages.paliers.slice().reverse().filter(p => p.boyards)
      .map(p => p.boyards).join(' · ') + ' boyards'), true);

  // Ce que la page ne doit plus dire : le chrono a été retiré du jeu.
  ['gong', 'défi', 'étoile', 'Maître du Temps', 'record', 'à battre', 'à tenir']
    .forEach((mot) => {
      const re = new RegExp(mot, 'i');
      t('la page ne parle plus de « ' + mot + ' »', re.test(visible), false);
    });
}

console.log('\n' + (ko ? '❌ ' + ko + ' échec(s)' : '✅ tout passe') + '   (' + (ok + ko) + ' contrôles)\n');
process.exit(ko ? 1 : 0);
