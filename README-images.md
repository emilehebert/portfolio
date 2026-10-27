# Les images du portfolio

Ce document explique comment les images fonctionnent sur le site, comment les préparer et comment en ajouter une nouvelle. Tout ce qui est écrit ici a été vérifié dans le code actuel du projet.

## 1. Où sont les images

Toutes les images du site sont dans `src/assets/images/`. Gulp ne les compresse pas, il les copie telles quelles dans `dist/assets/` (voir `gulp/tasks/assets.js`). Ce que tu mets dans le dossier est donc exactement ce que le visiteur télécharge.

```
src/assets/images/
├── about-*.webp                      images de la section À propos (accueil)
├── About-Webjam-Victory.webp         photo de la victoire webjam (accueil)
├── Portfolio_portrait_colors_web.webp  portrait du hero
├── boucle-infinie/
├── camera-securitee/
├── fitgen/
├── house-breach/
│   └── gallery/                      images de la galerie « bureau » de la page projet
└── projectx/
```

Il y a un dossier par projet, en minuscules avec des tirets. Les images de la galerie draggable de House Breach sont dans un sous-dossier `gallery/`.

Les originaux (PNG, captures, exports Figma en pleine taille) ne vont jamais dans le repo. Ils sont gardés à part dans `D:\Travaux\Session 7\Portfolio\originaux-images\`. Si une image doit être refaite, on repart toujours de l'original, jamais d'un webp déjà compressé.

## 2. Nommage des images

La règle vient des images de Boucle et elle s'applique à toutes les nouvelles images.

- En anglais
- Chaque mot commence par une majuscule, les mots sont reliés par des tirets
- Un nom qui décrit ce qu'on voit, pas l'ordre d'affichage
- Pas de numéro (pas de `Image-01`, pas de `Frame 134`)
- Toujours en `.webp`

Exemples réels du projet

```
house-breach/Post-Process-Before.webp
house-breach/Post-Process-After.webp
boucle-infinie/Lightsaber-Fight.webp
camera-securitee/Kinect-Network-Overview.webp
fitgen/Cowboy-Hat-Sweater-Outfit.webp
```

La version mobile d'une image garde le même nom avec `-Small` à la fin.

```
house-breach/Post-Process-Before.webp        1600 px de large
house-breach/Post-Process-Before-Small.webp   800 px de large
```

Une vignette (l'image qui représente le projet) finit par `-Thumbnail`, par exemple `Main-Menu-Thumbnail.webp` ou `Final-Render-Thumbnail.webp`.

Quelques vieux fichiers ne suivent pas encore la règle (`about-cat.webp`, `Portfolio_portrait_web.webp`, les `thumbnail.webp` de `projectx/`, `fitgen/` et `camera-securitee/`). Ils marchent très bien comme ça, mais si tu les renommes un jour il faut aussi changer chaque chemin dans les pages HTML.

## 3. Tailles recommandées

| Image | Largeur maximale | Pourquoi |
|---|---|---|
| Image normale | 1600 px | C'est la version qui s'ouvre en grand dans la modale. Plus large ne se voit pas et alourdit la page |
| Version `-Small` | 800 px | Utilisée sur mobile et dans les petites fenêtres |
| Photo de l'À propos `about-friends` | 1200 px | Exception, elle ne s'ouvre pas plus grand que ça |
| Image déjà plus petite que 800 px | Sa taille réelle | On ne l'agrandit jamais et on ne crée pas de `-Small` |

Pour te donner une idée, dans la page une image est affichée autour de 570 px de large sur ordinateur. Dans la modale elle prend au maximum la hauteur de l'écran moins 210 px (`modal.scss`, `max-height: calc(100dvh - 210px)`, la place du header et de la navigation), donc une image de 1600 px suffit même sur un grand écran.

Le format de l'image n'a pas beaucoup d'importance pour la mise en page, parce que les fenêtres recadrent l'image avec `object-fit: cover` (`window.scss`).

- Image du hero des pages projet. La fenêtre a toujours un format 15/16 (`single-projet.scss`, `aspect-ratio: 15 / 16`), l'image est recadrée dedans.
- Images des étapes (ScrollStack). Format 16/11 (`scroll-stack.scss`), recadrées en gardant le haut (`object-position: top`). En grand dans la modale, l'image reste entière.

Sur le site, une image de 1600 px pèse en général entre 30 et 250 Ko (la plus lourde fait 350 Ko), et une `-Small` entre 10 et 110 Ko. Si une image dépasse beaucoup ça, il y a sûrement un problème (une planche Figma de 16 000 px de large a déjà fait laguer tout le scroll d'une page).

## 4. Convertir et redimensionner

Toutes les images sont en webp qualité 80. C'est beaucoup plus léger qu'un PNG ou un JPG pour la même qualité visible, et le webp garde la transparence.

La méthode la plus simple sur Windows est ImageMagick en ligne de commande. Pour l'installer une seule fois dans PowerShell

```powershell
winget install ImageMagick.ImageMagick
```

Ensuite, pour une image (à lancer dans le dossier de l'original)

```powershell
# Version normale, 1600 px de large maximum
magick "Mon-Image.png" -resize "1600x>" -quality 80 "Mon-Image.webp"

# Version mobile, 800 px de large
magick "Mon-Image.png" -resize "800x>" -quality 80 "Mon-Image-Small.webp"
```

Le `>` dans `"1600x>"` veut dire « réduire seulement si l'image est plus grande ». Une image de 900 px reste à 900 px, elle n'est jamais agrandie.

Pour tout un dossier d'un coup

```powershell
Get-ChildItem *.png | ForEach-Object {
    magick $_.FullName -resize "1600x>" -quality 80 "$($_.BaseName).webp"
    magick $_.FullName -resize "800x>"  -quality 80 "$($_.BaseName)-Small.webp"
}
```

Pense à renommer les fichiers selon la règle du point 2 avant de les mettre dans le repo. Et ne garde pas la `-Small` si l'original fait 800 px ou moins.

Pour connaître la taille exacte d'une image (utile pour `width` et `height`)

```powershell
magick identify "Mon-Image.webp"
```

Sans rien installer, [Squoosh](https://squoosh.app) fait la même chose dans le navigateur, une image à la fois (format WebP, qualité 80, Resize à 1600 ou 800 de large).

## 5. Écrire la balise img

### Première image de la page (celle visible sans scroller)

Elle charge normalement avec `src` et `srcset`, et elle a `fetchpriority="high"` pour que le navigateur la télécharge en premier. Il n'y en a qu'une par page, c'est l'image du hero.

```html
<img
    src="assets/images/house-breach/Night-Exterior-Render.webp"
    width="1600"
    height="900"
    srcset="
        assets/images/house-breach/Night-Exterior-Render-Small.webp  800w,
        assets/images/house-breach/Night-Exterior-Render.webp       1600w
    "
    sizes="(max-width: 768px) 100vw, 50vw"
    fetchpriority="high"
    alt="Rendu de nuit de l'extérieur de la maison"
/>
```

### Toutes les autres images (plus bas dans la page)

Elles utilisent `data-src` et `data-srcset` au lieu de `src` et `srcset`, plus `loading="lazy"`.

```html
<img
    data-src="assets/images/house-breach/Art-Direction-Moodboard.webp"
    width="1600"
    height="712"
    data-srcset="assets/images/house-breach/Art-Direction-Moodboard-Small.webp 800w, assets/images/house-breach/Art-Direction-Moodboard.webp 1600w"
    sizes="(max-width: 768px) 100vw, 50vw"
    loading="lazy"
    alt="Maquette Figma du jeu"
/>
```

Pourquoi ce truc ? Avec un vrai `src`, Chrome commence à télécharger les images lazy qui sont à moins de 1250 à 3000 px de l'écran avant même d'afficher la page. Lighthouse compte ces téléchargements dans le temps d'affichage (LCP), ce qui faisait baisser la note mobile. Avec `data-src`, le navigateur ne voit aucune image au départ. C'est `src/scripts/Main.js` (lignes 12 à 16) qui copie `data-src` dans `src` et `data-srcset` dans `srcset` au démarrage du JS, donc après le premier affichage. `loading="lazy"` fait ensuite son travail normalement.

```js
document.querySelectorAll('img[data-src]').forEach((img) => {
  if (img.dataset.srcset) img.srcset = img.dataset.srcset;
  img.src = img.dataset.src;
});
```

Note que `sizes` reste un vrai attribut, il n'a pas besoin de `data-`.

Le JS attend aussi que `main.css` soit chargé avant de démarrer (fin de `Main.js`), sinon Safari sur iPhone affichait les images en noir. Il ne faut pas retirer cette attente.

### Image plus petite que 800 px

Pas de `-Small`, donc pas de `srcset` ni de `sizes`. Juste `data-src` (ou `src` si c'est la première image de la page).

```html
<img data-src="assets/images/projectx/thumbnail.webp" width="670" height="383" loading="lazy" alt="Thumbnail" />
```

### Ce que veut dire chaque attribut

- `width` et `height` sont la vraie taille en pixels du gros fichier (celui de 1600 px). Le navigateur s'en sert pour réserver la bonne place avant que l'image arrive, sinon la page saute pendant le chargement (CLS dans Lighthouse). L'affichage réel est géré par le CSS, ces chiffres ne changent pas la taille à l'écran.
- `srcset` donne les deux versions avec leur largeur (`800w`, `1600w`) et le navigateur choisit la bonne.
- `sizes="(max-width: 768px) 100vw, 50vw"` dit au navigateur que l'image prend toute la largeur sur mobile et environ la moitié sur ordinateur. C'est la même valeur partout sur le site.
- `loading="lazy"` attend que l'image approche de l'écran pour la télécharger.
- `fetchpriority="high"` seulement sur la première image de la page.

### Texte alternatif (alt)

- En français, une courte phrase qui décrit ce qu'on voit vraiment sur l'image
- Pas « image de » ni le nom du fichier
- Il sert aussi de titre dans la modale quand la fenêtre n'a pas de titre (`Modal.js`), donc il doit rester court
- `title` est optionnel, il ajoute une bulle au survol avec plus de détails (ex. les photos de l'À propos)

## 6. Le dither (DitherVeil)

Presque toutes les images sont dans une fenêtre avec l'effet de trame.

```html
<div class="window__media" data-component="DitherVeil" data-reveal="full">
    <img ... />
</div>
```

- `data-reveal="full"` le survol remet toute l'image en couleur (sans l'option, seulement autour du curseur)
- `data-trigger=".card"` le survol de toute la carte déclenche l'effet (cartes projets de l'accueil)

Le dither ne télécharge rien de plus. Il lit l'`<img>` déjà chargée par la page et dessine un canvas par-dessus. Sur ordinateur c'est `DitherCanvas.js` (WebGL, animé, créé quand l'image approche de l'écran et retiré quand elle s'éloigne). Sur mobile c'est `DitherStill.js` (canvas 2D dessiné une seule fois). Sur les pages projet, l'image repasse en couleur quand son centre arrive au milieu de l'écran.

Si le canvas ne peut pas être créé, l'`<img>` normale reste visible, donc une image s'affiche toujours.

Les PNG transparents sont convertis en webp sans perdre la transparence, et le dither la garde aussi (`DitherCanvas.js` avec `alpha: true` et `DitherStill.js` qui garde la transparence de chaque pixel). Les zones transparentes montrent le fond de la fenêtre au lieu d'être noires.

Le dither suit l'`object-position` de l'image. Si tu changes le cadrage en CSS, le dither change avec.

## 7. La modale (image en grand)

Pour qu'une image s'ouvre en grand au clic, on met `data-modal="image"` sur la fenêtre qui la contient.

```html
<div class="window cursor-target" data-modal="image">
    <div class="window__content">
        <div class="window__media" data-component="DitherVeil" data-reveal="full">
            <img data-src="..." ... alt="Maquette Figma du jeu" />
        </div>
    </div>
</div>
```

`Modal.js` copie l'image cliquée dans la modale unique (`_partials/_modal.html`, incluse une fois dans le header). Elle prend `source.src`, c'est à dire toujours la grande version de 1600 px, même si la page affichait la `-Small` sur mobile. Aucun deuxième fichier à prévoir. Le titre de la modale vient du `.window__header p` de la fenêtre, ou de l'`alt` s'il n'y en a pas.

Les comparatifs avant/après utilisent `data-modal="comparison"` et fonctionnent pareil.

Les vignettes des cartes projets de l'accueil ne s'ouvrent pas dans la modale. Ce sont des liens vers la page du projet.

## 8. Les vignettes

Chaque projet a deux usages de vignette qui n'ont pas les mêmes besoins.

- **Carte projet de l'accueil** (`index.html`). Format paysage, à peu près 16/9 (ex. `house-breach/Main-Menu-Thumbnail.webp` en 1600 × 900, `fitgen/Three-Outfits-Thumbnail.webp` en 661 × 387). Elle utilise `data-trigger=".card"` et `data-reveal="full"`.
- **Hero de la page projet**. Recadré en 15/16, donc presque carré. Choisis une image dont le sujet est au centre.
- **Petite fenêtre flottante sous le hero** (lien `.video js-fixed`). 400 px de large, poussée à moitié hors de l'écran et cachée à 1440 px et moins (`single-projet.scss`). Il faut une image dont le côté droit montre quelque chose, sinon on ne voit que du vide.

## 9. Ajouter une nouvelle image, étape par étape

1. Garde l'original dans `D:\Travaux\Session 7\Portfolio\originaux-images\`.
2. Choisis un nom en anglais selon la règle (ex. `Night-Exterior-Render`).
3. Exporte la version normale en webp qualité 80, 1600 px de large maximum.
4. Si l'original fait plus de 800 px de large, exporte aussi `Nom-Small.webp` à 800 px.
5. Mets les fichiers dans `src/assets/images/<projet>/`.
6. Note la vraie taille du gros fichier avec `magick identify` pour `width` et `height`.
7. Écris la balise. Première image de la page, `src` + `srcset` + `fetchpriority="high"`. Toutes les autres, `data-src` + `data-srcset` + `loading="lazy"`. Pas de `srcset` si tu n'as pas de `-Small`.
8. Ajoute `sizes="(max-width: 768px) 100vw, 50vw"` quand il y a un `srcset`.
9. Écris un `alt` court en français qui décrit l'image.
10. Mets l'image dans un `.window__media` avec `data-component="DitherVeil"`, et ajoute `data-modal="image"` sur la `.window` si elle doit s'ouvrir en grand.
11. Vérifie la page en local sur ordinateur et en mode mobile (la `-Small` doit charger sur mobile, la grande dans la modale).

## 10. Problèmes connus à corriger

Repérés dans le code actuel, pas encore corrigés.

- L'image du hero des 5 pages projet a encore l'alt « Mes amis et moi » (copié de l'À propos).
- Plusieurs images de `boucle-infinie.html` ont un alt « House Breach ».
- Les images de la galerie `house-breach/gallery/` n'ont pas de version `-Small`. Ce n'est pas grave parce que les fenêtres sont petites, mais sur mobile elles chargent la grande version.
