# Proposition de réorganisation de l’application (navigation par onglets swipe horizontaux)

> Objectif : repenser l’expérience sans coder immédiatement, avec une structure claire des pages, des interactions et des priorités d’implémentation.

## 1) Vision produit

Passer d’une navigation linéaire à une navigation **en 3 onglets horizontaux swipeables** (mobile-first), pour clarifier les usages :

1. **ÉCOUTER** : scanner et consulter une page web liée à un QR code.
2. **TISSER** : conserver le cœur de l’app (Tissage des résonances).
3. **SYNTHÉTISER** : finaliser avec une page de synthèse/action.

Cette structure permet de séparer les temps d’usage :
- **Entrée / découverte** (Écouter),
- **Travail relationnel** (Tisser),
- **Consolidation** (Synthétiser).

---

## 2) Architecture de navigation recommandée

## 2.1 Modèle d’onglets

- Conteneur principal : `TabPager` (ou équivalent), avec:
  - swipe horizontal,
  - indicateur d’onglet actif,
  - accès direct par tap sur les onglets.
- Ordre proposé (de gauche à droite) :
  - **Onglet 1 : Écouter**
  - **Onglet 2 : Tisser**
  - **Onglet 3 : Synthétiser**

## 2.2 Règles UX globales

- **Persistant** : l’état de chaque onglet est conservé quand on swipe.
- **Récupération de session** : retour sur le dernier onglet ouvert.
- **Feedback visuel clair** : micro-animations de transition (200–300 ms).
- **A11y** : navigation clavier + labels ARIA sur les onglets.

---

## 3) Détail fonctionnel par onglet

## 3.1 Onglet 1 — ÉCOUTER

### Intention
Créer une porte d’entrée simple : scanner un QR code et visualiser immédiatement la ressource web associée.

### Composants clés
- Header : titre **Écouter**.
- Bloc “Scanner un QR code”.
- Zone d’aide “Ou coller une URL” (optionnel mais recommandé).
- Historique court des derniers scans (optionnel).

### Flux principal
1. L’utilisateur ouvre l’onglet Écouter.
2. Il active la caméra et scanne un QR code.
3. Si le QR contient une URL valide :
   - ouverture d’une **modale**,
   - affichage de la page web scannée (iframe/webview selon contraintes).
4. Fermeture de la modale → retour immédiat à Écouter.

### Gestion d’erreurs
- Permission caméra refusée : message + bouton “Réessayer”.
- QR invalide/non URL : toast “Code non reconnu”.
- URL bloquée (X-Frame-Options/CSP) :
  - fallback “Ouvrir dans un nouvel onglet”.

### Points de vigilance techniques
- Certaines pages ne s’afficheront pas en iframe.
- Prévoir sanitation/validation URL (https uniquement recommandé).
- Définir une politique de sécurité (sandbox iframe, rel noopener, etc.).

---

## 3.2 Onglet 2 — TISSER (Tissage des résonances)

### Intention
Conserver la page existante comme **noyau de l’expérience**.

### Recommandation
- Migrer la logique actuelle de la page principale dans ce tab.
- Garder le wording : **TISSER** + sous-titre “Tissage des résonances”.
- Introduire un état d’activité (en cours / terminé / à reprendre).

### UX
- CTA principal visible en permanence.
- Résumé compact de progression.
- Actions secondaires derrière un menu contextuel (éviter la surcharge).

---

## 3.3 Onglet 3 — SYNTHÉTISER (Page de synthèse)

### Intention
Transformer la matière produite dans Tisser en synthèse exploitable.

### Contenu recommandé
- Résumé des points clés.
- Regroupements thématiques.
- Export/partage (PDF, texte, copie, etc. selon besoins).
- Bloc “Prochaines actions”.

### UX
- Structure en sections pliables (accordéons) pour lisibilité.
- Possibilité d’éditer la synthèse avant export.
- Retour rapide vers Tisser pour ajustements.

---

## 4) Modale web scannée (Écouter)

## 4.1 Spécification UX
- Ouverture plein écran sur mobile.
- En-tête de modale :
  - URL (tronquée),
  - bouton fermer,
  - bouton “ouvrir externe”.
- État de chargement + timeout raisonnable.

## 4.2 Scénarios
- **Succès** : page chargée dans la modale.
- **Refus iframe** : message explicite + action d’ouverture externe.
- **Temps de chargement long** : spinner + possibilité d’annuler.

---

## 5) États et données (sans implémentation)

État minimal à prévoir :
- `activeTab` : écouter | tisser | synthetiser
- `scanner.permission` : unknown | granted | denied
- `scanner.lastScannedUrl`
- `modal.isOpen`, `modal.url`, `modal.loading`, `modal.error`
- `tisser.progress`
- `synthese.content`, `synthese.lastUpdated`

Persistance utile :
- dernier onglet actif,
- derniers scans (limités),
- brouillon de synthèse.

---

## 6) Parcours utilisateur cible (résumé)

1. Arrivée sur **Écouter** (ou dernier onglet actif).
2. Scan d’un QR → modale web.
3. Passage à **Tisser** pour produire les résonances.
4. Passage à **Synthétiser** pour consolider et exporter.

Ce parcours crée une narration claire : **écouter → tisser → synthétiser**.

---

## 7) Plan de mise en œuvre conseillé (itératif)

### Itération 1 (MVP navigation)
- Créer le système d’onglets swipeables.
- Brancher les 3 vues vides avec titres.
- Déplacer l’existant dans **Tisser**.

### Itération 2 (Écouter)
- Intégrer scanner QR + permissions caméra.
- Ajouter modale d’affichage URL + fallback externe.

### Itération 3 (Synthétiser)
- Construire page de synthèse initiale.
- Ajouter édition légère + export de base.

### Itération 4 (polish)
- Accessibilité, performances, analytics d’usage.
- Améliorations wording et onboarding.

---

## 8) Critères d’acceptation fonctionnels (proposition)

- L’utilisateur peut naviguer entre 3 onglets par swipe et par tap.
- L’onglet **Écouter** permet de scanner un QR code.
- Un QR URL valide ouvre une modale d’affichage web.
- L’onglet **Tisser** contient l’expérience de tissage actuelle.
- L’onglet **Synthétiser** affiche une page de synthèse exploitable.

---

## 9) Décisions à valider avant développement

1. Mobile web uniquement ou aussi desktop ?
2. Politique iframe (affichage interne) vs ouverture externe par défaut ?
3. Niveau d’édition attendu dans la synthèse ?
4. Faut-il verrouiller l’ordre des onglets (workflow guidé) ?
5. Faut-il conserver un historique des scans côté local ?

---

## 10) Nommage/orthographe recommandé dans l’interface

- **Écouter**
- **TISSER** — *Tissage des résonances*
- **SYNTHÉTISER** — *Page de synthèse*

(Orthographes normalisées de votre demande : “horizontalement”, “page web”, “synthétiser”, “synthèse”).
