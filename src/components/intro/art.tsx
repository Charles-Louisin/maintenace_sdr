import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Pièces du logo BATIS redessinées en vectoriel pour être animées séparément.
 *
 * Le casque est coupé en deux couches pour que les outils entrent DEDANS :
 *  - HelmetBack (derrière les outils) : calotte et dessus du bord ;
 *  - HelmetFront (devant les outils) : moitié avant du bord, opaque, sous laquelle les outils disparaissent.
 * Les outils sont dessinés verticaux puis inclinés à 45°, croisés au point (120, 130).
 */
export const STAGE = 240;
/** Casque : viewBox 200 × 120, ouverture (ligne d'entrée des outils) à y = 100 */
export const HELMET_VB = { w: 200, h: 120, mouthY: 100 };
const CX = 120;
const CY = 130;

/* ------------------------------------------------------------------ outils */

export function Wrench({ size = STAGE }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240">
      <Defs>
        <LinearGradient id="wSteel" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#6E757C" />
          <Stop offset="0.18" stopColor="#E9EDF0" />
          <Stop offset="0.42" stopColor="#FFFFFF" />
          <Stop offset="0.62" stopColor="#B7BDC3" />
          <Stop offset="1" stopColor="#5F666D" />
        </LinearGradient>
        <LinearGradient id="wGroove" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#7B828A" />
          <Stop offset="0.5" stopColor="#A9AFB5" />
          <Stop offset="1" stopColor="#D9DDE1" />
        </LinearGradient>
        <RadialGradient id="wHead" cx="0.38" cy="0.32" r="0.75">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.45" stopColor="#C9CED3" />
          <Stop offset="1" stopColor="#5E656C" />
        </RadialGradient>
        <Mask id="wJaw">
          <Rect x="0" y="0" width="240" height="240" fill="#fff" />
          <Path d="M108 6 L132 6 L130 50 Q120 60 110 50 Z" fill="#000" />
        </Mask>
        <Mask id="wRing">
          <Rect x="0" y="0" width="240" height="240" fill="#fff" />
          <Circle cx="120" cy="206" r="9" fill="#000" />
        </Mask>
      </Defs>
      <G transform={`rotate(-45 ${CX} ${CY})`}>
        {/* tête à fourche */}
        <G mask="url(#wJaw)">
          <Path
            d="M88 52 C88 30 102 18 120 18 C138 18 152 30 152 52 C152 68 140 78 132 82 L108 82 C100 78 88 68 88 52 Z"
            fill="url(#wHead)"
            stroke="#3F454B"
            strokeWidth="2.5"
          />
        </G>
        {/* corps légèrement effilé, nervure centrale */}
        <Path d="M108 80 L132 80 L128 194 L112 194 Z" fill="url(#wSteel)" stroke="#3F454B" strokeWidth="2.5" strokeLinejoin="round" />
        <Path d="M114 98 L126 98 L123.5 178 L116.5 178 Z" fill="url(#wGroove)" opacity="0.9" />
        <Path d="M117 100 L117 176" stroke="#fff" strokeWidth="1.2" opacity="0.7" />
        {/* œil polygonal */}
        <G mask="url(#wRing)">
          <Circle cx="120" cy="206" r="19" fill="url(#wHead)" stroke="#3F454B" strokeWidth="2.5" />
        </G>
        <Circle cx="120" cy="206" r="9" fill="none" stroke="#3F454B" strokeWidth="2" />
        <Path d="M106 46 C108 32 116 26 126 25" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
      </G>
    </Svg>
  );
}

export function Screwdriver({ size = STAGE }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240">
      <Defs>
        <LinearGradient id="sChrome" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#5D646B" />
          <Stop offset="0.3" stopColor="#F4F6F8" />
          <Stop offset="0.55" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#6B7279" />
        </LinearGradient>
        <LinearGradient id="sGrip" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#0E0E10" />
          <Stop offset="0.35" stopColor="#3B3B40" />
          <Stop offset="0.6" stopColor="#24242A" />
          <Stop offset="1" stopColor="#0A0A0C" />
        </LinearGradient>
        <LinearGradient id="sAmber" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#B87200" />
          <Stop offset="0.4" stopColor="#FFD24A" />
          <Stop offset="1" stopColor="#C98000" />
        </LinearGradient>
      </Defs>
      <G transform={`rotate(45 ${CX} ${CY})`}>
        {/* lame plate */}
        <Path d="M114 44 L126 44 L124.5 26 L115.5 26 Z" fill="url(#sChrome)" stroke="#3F454B" strokeWidth="2" strokeLinejoin="round" />
        <Rect x="114" y="42" width="12" height="92" rx="2" fill="url(#sChrome)" stroke="#3F454B" strokeWidth="2" />
        <Path d="M118.5 46 L118.5 130" stroke="#fff" strokeWidth="1.4" opacity="0.85" />
        {/* virole */}
        <Rect x="106" y="128" width="28" height="16" rx="5" fill="url(#sAmber)" stroke="#8A5600" strokeWidth="2" />
        {/* manche bi-matière */}
        <Path
          d="M104 142 L136 142 C141 160 141 200 138 214 C136 222 104 222 102 214 C99 200 99 160 104 142 Z"
          fill="url(#sGrip)"
          stroke="#000"
          strokeWidth="1.5"
        />
        <Rect x="109" y="152" width="7" height="56" rx="3.5" fill="url(#sAmber)" />
        <Rect x="124" y="152" width="7" height="56" rx="3.5" fill="url(#sAmber)" />
        <Path d="M106 150 C104 170 104 196 106 210" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.22" />
      </G>
    </Svg>
  );
}

/* ------------------------------------------------------------------ casque */

function HelmetDefs() {
  return (
    <Defs>
      <RadialGradient id="hShell" cx="0.36" cy="0.22" r="0.9">
        <Stop offset="0" stopColor="#FFF3B0" />
        <Stop offset="0.28" stopColor="#FFD43A" />
        <Stop offset="0.75" stopColor="#F5A900" />
        <Stop offset="1" stopColor="#C27C00" />
      </RadialGradient>
      <LinearGradient id="hRidge" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#E59A00" />
        <Stop offset="0.45" stopColor="#FFE066" />
        <Stop offset="1" stopColor="#E9A200" />
      </LinearGradient>
      <LinearGradient id="hBrimTop" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFD640" />
        <Stop offset="1" stopColor="#E9A000" />
      </LinearGradient>
      <LinearGradient id="hLip" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#F4AE00" />
        <Stop offset="0.6" stopColor="#D88E00" />
        <Stop offset="1" stopColor="#9E6200" />
      </LinearGradient>
      <RadialGradient id="hCast" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#000" stopOpacity="0.28" />
        <Stop offset="1" stopColor="#000" stopOpacity="0" />
      </RadialGradient>
    </Defs>
  );
}

/** Calotte, bord arrière et ouverture sombre : se place DERRIÈRE les outils. */
export function HelmetBack({ width = 200 }: { width?: number }) {
  return (
    <Svg width={width} height={(width * HELMET_VB.h) / HELMET_VB.w} viewBox="0 0 200 120">
      <HelmetDefs />
      {/* bord complet (le dessus) */}
      <Ellipse cx="100" cy="100" rx="95" ry="14" fill="url(#hBrimTop)" stroke="#B57400" strokeWidth="1.5" />
      {/* ouverture : l'intérieur du casque */}
      <Ellipse cx="100" cy="101" rx="80" ry="8.5" fill="#D08800" />
      {/* calotte */}
      <Path d="M24 100 C24 46 58 10 100 10 C142 10 176 46 176 100 Z" fill="url(#hShell)" stroke="#B87800" strokeWidth="1.8" />
      <Path d="M85 13 Q100 8 115 13 L118 99 L82 99 Z" fill="url(#hRidge)" stroke="#D58E00" strokeWidth="1.2" />
      <Path d="M56 30 Q61 24 68 21 L72 99 L57 99 Z" fill="url(#hRidge)" stroke="#D58E00" strokeWidth="1.2" opacity="0.9" />
      <Path d="M144 30 Q139 24 132 21 L128 99 L143 99 Z" fill="url(#hRidge)" stroke="#D58E00" strokeWidth="1.2" opacity="0.9" />
      {/* reflets */}
      <Path d="M42 74 C44 50 58 32 78 23" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.5" />
      <Ellipse cx="92" cy="30" rx="6" ry="3" fill="#fff" opacity="0.7" />
      {/* ourlet à la base de la calotte */}
      <Path d="M24 99 C60 104 140 104 176 99" stroke="#C88300" strokeWidth="2.5" fill="none" />
    </Svg>
  );
}

/** Bord avant, ombre intérieure et ombre portée : se place DEVANT les outils. */
export function HelmetFront({ width = 200 }: { width?: number }) {
  return (
    <Svg width={width} height={(width * HELMET_VB.h) / HELMET_VB.w} viewBox="0 0 200 120">
      <HelmetDefs />
      {/* ombre portée du bord sur les outils */}
      <Ellipse cx="100" cy="114" rx="72" ry="6" fill="url(#hCast)" />
      {/* moitié avant du bord, pleine et opaque : les outils passent DESSOUS, rien ne se voit à travers */}
      <Path d="M5 100 A95 14 0 0 0 195 100 Z" fill="url(#hLip)" stroke="#9A5F00" strokeWidth="1.2" strokeLinejoin="round" />
      {/* léger creux à la base de la calotte, sans transparence */}
      <Path d="M24 100.5 A76 6 0 0 0 176 100.5 Z" fill="#E09700" opacity="0.55" />
      <Path d="M12 104 A90 11 0 0 0 188 104" stroke="#FFE27A" strokeWidth="1.6" fill="none" opacity="0.75" strokeLinecap="round" />
    </Svg>
  );
}
