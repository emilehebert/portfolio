/*
 * Shaders WebGL2 du dither (adaptés de React Bits « DitherVeil »).
 * Un shader est un petit programme exécuté par la carte graphique pour CHAQUE pixel.
 *
 * - VERTEX        : dessine un triangle qui couvre tout le canvas
 * - MASK_FRAGMENT : dessine où le curseur est passé (la zone à révéler en couleur)
 * - VIEW_FRAGMENT : dessine l'image en dither, puis la photo en couleur sous le masque
 */

export const VERTEX = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const MASK_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D tPrev;   // le masque de l'image précédente
uniform vec2 uSize;        // taille du canvas, en px
uniform vec2 uFrom;        // position précédente du pinceau
uniform vec2 uTo;          // position actuelle du pinceau
uniform float uRadius;     // rayon de la zone révélée
uniform float uSoftness;   // largeur du bord adouci
uniform float uStrength;   // 0 → 1 : présence du curseur
uniform float uFade;       // vitesse d'effacement de la traînée
uniform float uHold;

in vec2 vUv;
out vec4 fragColor;

// Distance entre le point p et le segment [a, b] (le trait du pinceau)
float strokeDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  return length(p - a - ab * h);
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;

  // L'ancien masque s'efface un peu à chaque image (= la traînée)
  float trail = max(texture(tPrev, vUv).r - uFade, 0.0);

  // On ajoute le nouveau trait du pinceau
  float band = max(uRadius * uSoftness, 1.0) * uHold;
  float d = strokeDistance(p, uFrom, uTo);
  trail = max(trail, clamp((uRadius - d) / band, 0.0, 1.0) * uStrength);

  fragColor = vec4(trail, 0.0, 0.0, 1.0);
}
`;

export const VIEW_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D tImage;     // la photo
uniform sampler2D tMask;      // la zone révélée (dessinée par MASK_FRAGMENT)
uniform vec2 uResolution;     // taille du canvas, en pixels réels
uniform vec2 uCover;          // cadrage de la photo (comme object-fit: cover)
uniform float uLod;           // niveau de flou de la photo, selon la taille des points
uniform float uCell;          // taille d'un point de dither, en pixels réels
uniform float uLevels;        // nombre de tons
uniform float uContrast;
uniform vec3 uInk;            // couleur des tons sombres
uniform vec3 uPaper;          // couleur des tons clairs
uniform float uIntro;         // 0 → 1 : animation d'apparition
uniform float uHold;

in vec2 vUv;
out vec4 fragColor;

// Seuil de la matrice de Bayer 8×8 (valeur entre 0 et 1 selon la position de la case)
float bayer(vec2 cell) {
  ivec2 p = ivec2(mod(cell, 8.0));
  int v = p.x ^ p.y;
  int m = ((v & 1) << 5) | ((p.y & 1) << 4) | ((v & 2) << 2) | ((p.y & 2) << 1) | ((v & 4) >> 1) | ((p.y & 4) >> 2);
  return (float(m) + 0.5) / 64.0;
}

// Seuil de la matrice de Bayer 4×4 : 0 8 2 10 / 12 4 14 6 / 3 11 1 9 / 15 7 13 5
float bayer4(vec2 cell) {
  ivec2 p = ivec2(mod(cell, 4.0));
  int v = p.x ^ p.y;
  int m = ((v & 1) << 3) | ((p.y & 1) << 2) | (v & 2) | ((p.y & 2) >> 1);
  return (float(m) + 0.5) / 16.0;
}

// Position dans le canvas → position dans la photo (selon le cadrage)
vec2 imageUv(vec2 uv) {
  return (uv - 0.5) * uCover + 0.5;
}

// Luminosité de la couleur, avec le contraste appliqué (0 = noir, 1 = blanc)
float tone(vec3 c) {
  float gray = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return pow(clamp((gray - 0.5) * uContrast + 0.5, 0.0, 1.0), 1.6);
}

// Arrondit le ton au niveau inférieur ou supérieur selon le seuil t
float quantize(float v, float t) {
  float steps = uLevels - 1.0;
  float s = v * steps;
  float base = floor(s);
  return min(base + step(t, s - base), steps) / steps;
}

void main() {
  // 1. Trouver la case de dither (un carré de uCell pixels) de ce pixel
  vec2 px = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 cell = floor(px / uCell);
  vec2 center = (cell + 0.5) * uCell;
  vec2 cellUv = vec2(center.x / uResolution.x, 1.0 - center.y / uResolution.y);

  // 2. Le ton de la case (0 = encre, 1 = papier), arrondi avec la matrice de Bayer 4×4
  vec3 c = textureLod(tImage, imageUv(cellUv), uLod).rgb;
  float level = quantize(tone(c), bayer4(cell));
  vec3 color = mix(uInk, uPaper, level);

  // 3. Là où le masque est allumé, on remplace le dither par la photo en couleur.
  //    Le seuil de Bayer fait apparaître la photo case par case (effet de dissolution).
  vec3 photo = texture(tImage, imageUv(vUv)).rgb;
  float mask = clamp(texture(tMask, cellUv).r * uHold, 0.0, 1.0);
  color = mix(color, photo, step(bayer(cell.yx), mask));

  // 4. Animation d'apparition : les cases apparaissent du centre vers les bords
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  float spread = length((cellUv - 0.5) * aspect) / length(aspect * 0.5);
  float appear = step(spread * 0.72 + bayer(cell + vec2(3.0, 5.0)) * 0.28, uIntro * 1.001);

  fragColor = vec4(mix(uInk, color, appear), 1.0);
}
`;
