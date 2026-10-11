// --- Built-in Sample Puzzles for Sliding Puzzle ------------------------------
// High quality, child-friendly, colorful vector illustrations encoded as
// self-contained SVG Data URIs. Zero external network requests, instant loading,
// 100% offline cacheable, and razor sharp on all screen densities.

const SAMPLE_PUZZLES = [
  {
    id: 'sample_atoz',
    name: 'A to Z Alphabet Fun',
    category: 'Alphabet & Phonics',
    difficulty: 'Easy (3×3) to 6×6',
    defaultGridSize: 3,
    description: 'Chunky 3D alphabet toy blocks and a cheerful teddy bear friend!',
    themeColor: 'from-amber-400 via-pink-400 to-sky-400',
    accentColor: 'text-amber-500',
    isBuiltIn: true,
    isAlphabet: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="sky_atoz" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#BAE6FD"/>
      <stop offset="45%" stop-color="#E0F2FE"/>
      <stop offset="75%" stop-color="#FEF3C7"/>
      <stop offset="100%" stop-color="#BBF7D0"/>
    </linearGradient>
    <linearGradient id="blockA_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F87171"/>
      <stop offset="100%" stop-color="#DC2626"/>
    </linearGradient>
    <linearGradient id="blockB_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    <linearGradient id="blockC_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE047"/>
      <stop offset="100%" stop-color="#EAB308"/>
    </linearGradient>
    <linearGradient id="bear_fur" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <filter id="soft_shadow_abc" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Sky Background -->
  <rect width="600" height="600" fill="url(#sky_atoz)"/>

  <!-- Rainbow Arcs in Background -->
  <g opacity="0.55">
    <path d="M 60 320 A 240 240 0 0 1 540 320" fill="none" stroke="#F43F5E" stroke-width="10"/>
    <path d="M 70 320 A 230 230 0 0 1 530 320" fill="none" stroke="#FB923C" stroke-width="10"/>
    <path d="M 80 320 A 220 220 0 0 1 520 320" fill="none" stroke="#FACC15" stroke-width="10"/>
    <path d="M 90 320 A 210 210 0 0 1 510 320" fill="none" stroke="#4ADE80" stroke-width="10"/>
    <path d="M 100 320 A 200 200 0 0 1 500 320" fill="none" stroke="#60A5FA" stroke-width="10"/>
    <path d="M 110 320 A 190 190 0 0 1 490 320" fill="none" stroke="#C084FC" stroke-width="10"/>
  </g>

  <!-- Puffy Cartoon Clouds -->
  <g fill="#FFFFFF" opacity="0.9">
    <path d="M 40 130 Q 60 90 100 110 Q 140 85 170 120 Q 200 115 200 145 Q 200 165 170 165 L 50 165 Q 30 165 40 130 Z"/>
    <path d="M 420 90 Q 440 60 475 75 Q 510 55 535 85 Q 565 80 565 110 Q 565 125 535 125 L 430 125 Q 410 125 420 90 Z"/>
  </g>

  <!-- Floating Letter Balloons -->
  <g filter="url(#soft_shadow_abc)">
    <!-- Balloon D (Mint) -->
    <g transform="translate(100, 210)">
      <path d="M 0 35 L 0 50" stroke="#CBD5E1" stroke-width="2"/>
      <ellipse cx="0" cy="0" rx="30" ry="34" fill="#34D399"/>
      <polygon points="0,32 -5,38 5,38" fill="#10B981"/>
      <text x="0" y="11" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="#FFFFFF" text-anchor="middle">D</text>
      <ellipse cx="-10" cy="-12" rx="6" ry="10" fill="#FFFFFF" opacity="0.4" transform="rotate(-25, -10, -12)"/>
    </g>

    <!-- Balloon E (Violet) -->
    <g transform="translate(480, 160)">
      <path d="M 0 35 L 0 55" stroke="#CBD5E1" stroke-width="2"/>
      <ellipse cx="0" cy="0" rx="30" ry="34" fill="#A855F7"/>
      <polygon points="0,32 -5,38 5,38" fill="#9333EA"/>
      <text x="0" y="11" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="#FFFFFF" text-anchor="middle">E</text>
      <ellipse cx="-10" cy="-12" rx="6" ry="10" fill="#FFFFFF" opacity="0.4" transform="rotate(-25, -10, -12)"/>
    </g>

    <!-- Balloon Z (Pink) -->
    <g transform="translate(320, 100)">
      <path d="M 0 35 L 0 50" stroke="#CBD5E1" stroke-width="2"/>
      <ellipse cx="0" cy="0" rx="26" ry="30" fill="#F43F5E"/>
      <polygon points="0,28 -4,34 4,34" fill="#E11D48"/>
      <text x="0" y="10" font-family="system-ui, sans-serif" font-weight="900" font-size="24" fill="#FFFFFF" text-anchor="middle">Z</text>
      <ellipse cx="-8" cy="-10" rx="5" ry="8" fill="#FFFFFF" opacity="0.4" transform="rotate(-25, -8, -10)"/>
    </g>
  </g>

  <!-- Twinkling Sparkles -->
  <polygon points="230,80 233,92 245,95 233,98 230,110 227,98 215,95 227,92" fill="#FBBF24"/>
  <polygon points="390,140 392,148 400,150 392,152 390,160 388,152 380,150 388,148" fill="#FBBF24"/>
  <polygon points="60,280 62,286 68,288 62,290 60,296 58,290 52,288 58,286" fill="#FBBF24"/>

  <!-- Green Grassy Hill Ground -->
  <path d="M -20 460 Q 300 390 620 450 L 620 620 L -20 620 Z" fill="#4ADE80"/>
  <path d="M -20 490 Q 250 440 620 480 L 620 620 L -20 620 Z" fill="#22C55E"/>

  <!-- Daisies on Grass -->
  <g transform="translate(60, 520)">
    <circle cx="0" cy="0" r="7" fill="#FDE047"/>
    <circle cx="-10" cy="0" r="5" fill="#FFFFFF"/>
    <circle cx="10" cy="0" r="5" fill="#FFFFFF"/>
    <circle cx="0" cy="-10" r="5" fill="#FFFFFF"/>
    <circle cx="0" cy="10" r="5" fill="#FFFFFF"/>
  </g>
  <g transform="translate(540, 530)">
    <circle cx="0" cy="0" r="7" fill="#FDE047"/>
    <circle cx="-10" cy="0" r="5" fill="#FFFFFF"/>
    <circle cx="10" cy="0" r="5" fill="#FFFFFF"/>
    <circle cx="0" cy="-10" r="5" fill="#FFFFFF"/>
    <circle cx="0" cy="10" r="5" fill="#FFFFFF"/>
  </g>

  <!-- Large Stack of 3D ABC Toy Blocks -->
  <g filter="url(#soft_shadow_abc)">
    <!-- BLOCK A (Bottom Left) -->
    <g transform="translate(65, 335)">
      <!-- Block Body -->
      <rect x="0" y="0" width="145" height="145" rx="28" fill="url(#blockA_grad)"/>
      <!-- Inner Gloss Border -->
      <rect x="8" y="8" width="129" height="129" rx="20" fill="none" stroke="#FCA5A5" stroke-width="4" opacity="0.6"/>
      <!-- Bold Letter A -->
      <text x="72" y="105" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="95" fill="#FFFFFF" text-anchor="middle">A</text>
      <!-- Cute Apple Badge in Corner -->
      <circle cx="120" cy="25" r="16" fill="#FFFFFF"/>
      <text x="120" y="32" font-size="18" text-anchor="middle">&#127822;</text>
    </g>

    <!-- BLOCK B (Bottom Center-Right) -->
    <g transform="translate(230, 335)">
      <!-- Block Body -->
      <rect x="0" y="0" width="145" height="145" rx="28" fill="url(#blockB_grad)"/>
      <!-- Inner Gloss Border -->
      <rect x="8" y="8" width="129" height="129" rx="20" fill="none" stroke="#7DD3FC" stroke-width="4" opacity="0.6"/>
      <!-- Bold Letter B -->
      <text x="72" y="105" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="95" fill="#FFFFFF" text-anchor="middle">B</text>
      <!-- Cute Butterfly Badge in Corner -->
      <circle cx="120" cy="25" r="16" fill="#FFFFFF"/>
      <text x="120" y="32" font-size="18" text-anchor="middle">&#127880;</text>
    </g>

    <!-- BLOCK C (Stacked on Top of A & B) -->
    <g transform="translate(150, 185)">
      <!-- Block Body -->
      <rect x="0" y="0" width="145" height="145" rx="28" fill="url(#blockC_grad)"/>
      <!-- Inner Gloss Border -->
      <rect x="8" y="8" width="129" height="129" rx="20" fill="none" stroke="#FEF08A" stroke-width="4" opacity="0.7"/>
      <!-- Bold Letter C -->
      <text x="72" y="105" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="95" fill="#FFFFFF" text-anchor="middle">C</text>
      <!-- Cute Cat Badge in Corner -->
      <circle cx="120" cy="25" r="16" fill="#FFFFFF"/>
      <text x="120" y="32" font-size="18" text-anchor="middle">&#128049;</text>
    </g>
  </g>

  <!-- Cute Smiling Teddy Bear Friend (Sitting beside blocks, waving) -->
  <g transform="translate(450, 360)" filter="url(#soft_shadow_abc)">
    <!-- Round Ears -->
    <circle cx="-38" cy="-65" r="22" fill="url(#bear_fur)"/>
    <circle cx="-38" cy="-65" r="12" fill="#FDE68A"/>
    <circle cx="38" cy="-65" r="22" fill="url(#bear_fur)"/>
    <circle cx="38" cy="-65" r="12" fill="#FDE68A"/>

    <!-- Plump Body -->
    <ellipse cx="0" cy="40" rx="58" ry="65" fill="url(#bear_fur)"/>
    <ellipse cx="0" cy="45" rx="38" ry="45" fill="#FEF3C7"/>

    <!-- Big Round Head -->
    <circle cx="0" cy="-25" r="54" fill="url(#bear_fur)"/>

    <!-- Snout Muzzle -->
    <ellipse cx="0" cy="-12" rx="26" ry="20" fill="#FEF3C7"/>
    <!-- Button Nose -->
    <ellipse cx="0" cy="-20" rx="9" ry="7" fill="#451A03"/>
    <!-- Cute Smile -->
    <path d="M 0 -13 L 0 -7" stroke="#451A03" stroke-width="3"/>
    <path d="M -8 -7 Q 0 0 8 -7" fill="none" stroke="#451A03" stroke-width="3" stroke-linecap="round"/>

    <!-- Big Shiny Cartoon Eyes -->
    <ellipse cx="-20" cy="-34" rx="7" ry="9" fill="#1E293B"/>
    <ellipse cx="20" cy="-34" rx="7" ry="9" fill="#1E293B"/>
    <circle cx="-22" cy="-37" r="3" fill="#FFFFFF"/>
    <circle cx="18" cy="-37" r="3" fill="#FFFFFF"/>

    <!-- Cheerful Pink Blush -->
    <ellipse cx="-32" cy="-16" rx="9" ry="6" fill="#FB7185" opacity="0.6"/>
    <ellipse cx="32" cy="-16" rx="9" ry="6" fill="#FB7185" opacity="0.6"/>

    <!-- Red Bowtie -->
    <polygon points="-16,28 0,34 -16,40" fill="#EF4444"/>
    <polygon points="16,28 0,34 16,40" fill="#EF4444"/>
    <circle cx="0" cy="34" r="5" fill="#DC2626"/>

    <!-- Paws -->
    <circle cx="-55" cy="45" r="18" fill="url(#bear_fur)"/>
    <g transform="translate(58, 0)">
      <circle cx="0" cy="0" r="18" fill="url(#bear_fur)"/>
      <path d="M 8 -8 Q 18 -18 10 -25" fill="none" stroke="#FBBF24" stroke-width="4" stroke-linecap="round"/>
    </g>
    <!-- Feet Pads -->
    <ellipse cx="-35" cy="95" rx="22" ry="16" fill="url(#bear_fur)"/>
    <circle cx="-35" cy="95" r="10" fill="#FEF3C7"/>
    <ellipse cx="35" cy="95" rx="22" ry="16" fill="url(#bear_fur)"/>
    <circle cx="35" cy="95" r="10" fill="#FEF3C7"/>
  </g>
</svg>`
  },
  {
    id: 'sample_dino',
    name: 'Baby Dino Adventure',
    category: 'Dino Friends (5yo Favorite)',
    difficulty: 'Junior (2×2) to 5×5',
    defaultGridSize: 2,
    description: 'Friendly baby green dinosaur hatching from a speckled egg with a festive party hat!',
    themeColor: 'from-lime-400 via-emerald-400 to-amber-300',
    accentColor: 'text-lime-600',
    isBuiltIn: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="sky_dino" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#BAE6FD"/>
      <stop offset="50%" stop-color="#FEF08A"/>
      <stop offset="100%" stop-color="#BBF7D0"/>
    </linearGradient>
    <linearGradient id="dino_green" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A3E635"/>
      <stop offset="100%" stop-color="#65A30D"/>
    </linearGradient>
    <linearGradient id="dino_belly" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FEF9C3"/>
      <stop offset="100%" stop-color="#FEF08A"/>
    </linearGradient>
    <linearGradient id="egg_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
    <filter id="dino_shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#14532D" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Sky -->
  <rect width="600" height="600" fill="url(#sky_dino)"/>

  <!-- Smiling Sun in Corner -->
  <g transform="translate(80, 80)">
    <circle cx="0" cy="0" r="42" fill="#FBBF24"/>
    <circle cx="0" cy="0" r="36" fill="#F59E0B"/>
    <!-- Sunglasses -->
    <rect x="-24" y="-8" width="20" height="14" rx="4" fill="#1E293B"/>
    <rect x="4" y="-8" width="20" height="14" rx="4" fill="#1E293B"/>
    <line x1="-4" y1="-2" x2="4" y2="-2" stroke="#1E293B" stroke-width="3"/>
    <!-- Big Smile -->
    <path d="M -12 14 Q 0 24 12 14" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
  </g>

  <!-- Distant Volcano with Gentle Heart Steam Puff -->
  <polygon points="500,430 430,260 480,260 550,430" fill="#78716C"/>
  <polygon points="450,260 440,265 470,265 460,260" fill="#EF4444"/>
  <path d="M 455 230 C 455 210 475 210 475 230 C 475 245 455 260 455 260 C 455 260 435 245 435 230 C 435 210 455 210 455 230 Z" fill="#F472B6" opacity="0.75"/>

  <!-- Prehistoric Hills and Jungle Greens -->
  <path d="M -20 460 Q 250 370 620 430 L 620 620 L -20 620 Z" fill="#4ADE80"/>
  <path d="M -20 500 Q 300 440 620 490 L 620 620 L -20 620 Z" fill="#22C55E"/>

  <!-- Tropical Palm Tree -->
  <path d="M 500 480 Q 520 380 500 290 Q 490 380 485 480 Z" fill="#92400E"/>
  <path d="M 500 290 Q 430 250 380 290" fill="none" stroke="#16A34A" stroke-width="12" stroke-linecap="round"/>
  <path d="M 500 290 Q 530 220 580 250" fill="none" stroke="#16A34A" stroke-width="12" stroke-linecap="round"/>
  <path d="M 500 290 Q 560 300 610 320" fill="none" stroke="#15803D" stroke-width="12" stroke-linecap="round"/>
  <path d="M 500 290 Q 450 320 420 360" fill="none" stroke="#15803D" stroke-width="12" stroke-linecap="round"/>

  <!-- Baby Dinosaur Hatching Egg (Right) -->
  <g transform="translate(420, 440)" filter="url(#dino_shadow)">
    <path d="M -60 30 C -60 80 60 80 60 30 L 40 10 L 20 25 L 0 5 L -20 25 L -40 10 Z" fill="url(#egg_grad)"/>
    <circle cx="-25" cy="50" r="8" fill="#F472B6"/>
    <circle cx="20" cy="55" r="10" fill="#60A5FA"/>
    <circle cx="0" cy="40" r="6" fill="#FBBF24"/>

    <!-- Tiny Baby Yellow Dino Poking Out -->
    <ellipse cx="0" cy="0" rx="36" ry="34" fill="#FACC15"/>
    <ellipse cx="-12" cy="-6" rx="6" ry="8" fill="#1E293B"/>
    <ellipse cx="12" cy="-6" rx="6" ry="8" fill="#1E293B"/>
    <circle cx="-14" cy="-9" r="2.5" fill="#FFFFFF"/>
    <circle cx="10" cy="-9" r="2.5" fill="#FFFFFF"/>
    <path d="M -6 8 Q 0 15 6 8" fill="none" stroke="#78350F" stroke-width="3" stroke-linecap="round"/>
    <circle cx="-20" cy="4" r="5" fill="#FB7185" opacity="0.6"/>
    <circle cx="20" cy="4" r="5" fill="#FB7185" opacity="0.6"/>
    <!-- Top Egg Shell Hat -->
    <path d="M -30 -18 L -15 -10 L 0 -22 L 15 -10 L 30 -18 Q 0 -45 -30 -18 Z" fill="url(#egg_grad)"/>
    <circle cx="0" cy="-28" r="5" fill="#F472B6"/>
    <ellipse cx="36" cy="10" rx="10" ry="6" fill="#FACC15" transform="rotate(-30, 36, 10)"/>
  </g>

  <!-- Big Friendly Baby Green T-Rex (Center Left) -->
  <g transform="translate(210, 360)" filter="url(#dino_shadow)">
    <!-- Tail -->
    <path d="M -80 70 Q -170 50 -150 10 Q -110 30 -60 40 Z" fill="url(#dino_green)"/>
    <polygon points="-135,15 -125,5 -120,22" fill="#F59E0B"/>
    <polygon points="-105,25 -95,12 -90,32" fill="#F59E0B"/>

    <!-- Back Spikes -->
    <polygon points="-55,-10 -65,-30 -40,-25" fill="#F59E0B"/>
    <polygon points="-30,-45 -40,-65 -15,-60" fill="#F59E0B"/>
    <polygon points="0,-75 -10,-95 15,-90" fill="#F59E0B"/>

    <!-- Plump Body -->
    <ellipse cx="0" cy="50" rx="95" ry="90" fill="url(#dino_green)"/>
    <ellipse cx="30" cy="58" rx="60" ry="65" fill="url(#dino_belly)"/>
    <path d="M 0 35 Q 25 35 45 45" stroke="#FBBF24" stroke-width="3" fill="none"/>
    <path d="M 5 60 Q 30 60 50 70" stroke="#FBBF24" stroke-width="3" fill="none"/>

    <!-- Dinosaur Feet -->
    <g transform="translate(-40, 120)">
      <ellipse cx="0" cy="15" rx="35" ry="22" fill="url(#dino_green)"/>
      <circle cx="-20" cy="25" r="7" fill="#FFFFFF"/>
      <circle cx="0" cy="28" r="7" fill="#FFFFFF"/>
      <circle cx="20" cy="25" r="7" fill="#FFFFFF"/>
    </g>
    <g transform="translate(50, 120)">
      <ellipse cx="0" cy="15" rx="35" ry="22" fill="url(#dino_green)"/>
      <circle cx="-20" cy="25" r="7" fill="#FFFFFF"/>
      <circle cx="0" cy="28" r="7" fill="#FFFFFF"/>
      <circle cx="20" cy="25" r="7" fill="#FFFFFF"/>
    </g>

    <!-- Arms -->
    <g transform="translate(60, 40)">
      <ellipse cx="15" cy="0" rx="20" ry="12" fill="url(#dino_green)" transform="rotate(-15, 15, 0)"/>
      <circle cx="32" cy="-4" r="4" fill="#FFFFFF"/>
      <circle cx="35" cy="2" r="4" fill="#FFFFFF"/>
    </g>
    <g transform="translate(-20, 45)">
      <ellipse cx="-15" cy="0" rx="18" ry="10" fill="url(#dino_green)" transform="rotate(20, -15, 0)"/>
    </g>

    <!-- Head -->
    <ellipse cx="30" cy="-60" rx="80" ry="70" fill="url(#dino_green)"/>
    <ellipse cx="75" cy="-45" rx="50" ry="42" fill="url(#dino_green)"/>
    <ellipse cx="40" cy="-40" rx="16" ry="10" fill="#FB7185" opacity="0.6"/>

    <!-- Shiny Cartoon Eye -->
    <ellipse cx="35" cy="-75" rx="22" ry="26" fill="#1E293B"/>
    <circle cx="28" cy="-84" r="9" fill="#FFFFFF"/>
    <circle cx="44" cy="-66" r="4.5" fill="#FFFFFF"/>

    <!-- Smile with Cute Teeth -->
    <path d="M 60 -45 Q 110 -40 100 -10 Q 75 10 50 -25 Z" fill="#B91C1C"/>
    <path d="M 65 -15 Q 85 -5 95 -12" fill="#F87171"/>
    <path d="M 70 -44 L 75 -36 L 80 -44" fill="#FFFFFF"/>
    <path d="M 85 -43 L 90 -35 L 95 -43" fill="#FFFFFF"/>

    <!-- Party Hat -->
    <g transform="translate(10, -125)">
      <polygon points="0,0 45,0 22,-65" fill="#EC4899"/>
      <polygon points="8,-15 37,-15 22,-65" fill="#FACC15"/>
      <polygon points="14,-35 30,-35 22,-65" fill="#38BDF8"/>
      <circle cx="22" cy="-70" r="10" fill="#FDE047"/>
    </g>
  </g>

  <!-- Butterfly -->
  <g transform="translate(130, 240) rotate(15)">
    <ellipse cx="0" cy="0" rx="3" ry="12" fill="#475569"/>
    <circle cx="-10" cy="-6" r="10" fill="#F43F5E"/>
    <circle cx="10" cy="-6" r="10" fill="#F43F5E"/>
    <circle cx="-7" cy="8" r="7" fill="#FBBF24"/>
    <circle cx="7" cy="8" r="7" fill="#FBBF24"/>
  </g>
</svg>`
  },
  {
    id: 'sample_candy',
    name: 'Sweet Cupcake Castle',
    category: 'Candy Kingdom (5yo Favorite)',
    difficulty: 'Junior (2×2) to 5×5',
    defaultGridSize: 2,
    description: 'Fluffy strawberry frosting castle, candy-cane lollipop, and smiling gingerbread friend!',
    themeColor: 'from-pink-400 via-rose-300 to-purple-300',
    accentColor: 'text-pink-500',
    isBuiltIn: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="candy_sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#F3E8FF"/>
      <stop offset="50%" stop-color="#FCE7F3"/>
      <stop offset="100%" stop-color="#FFE4E6"/>
    </linearGradient>
    <linearGradient id="frosting_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F472B6"/>
      <stop offset="50%" stop-color="#FB7185"/>
      <stop offset="100%" stop-color="#EC4899"/>
    </linearGradient>
    <linearGradient id="wafer_grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <filter id="candy_shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#831843" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Sky -->
  <rect width="600" height="600" fill="url(#candy_sky)"/>

  <!-- Puffy Marshmallow Clouds -->
  <g fill="#FFFFFF" opacity="0.85">
    <ellipse cx="120" cy="110" rx="60" ry="35"/>
    <ellipse cx="160" cy="95" rx="45" ry="30"/>
    <ellipse cx="480" cy="130" rx="70" ry="40"/>
    <ellipse cx="430" cy="115" rx="50" ry="30"/>
  </g>

  <!-- Floating Gumdrops in Sky -->
  <ellipse cx="280" cy="70" rx="14" ry="18" fill="#38BDF8"/>
  <ellipse cx="340" cy="110" rx="12" ry="15" fill="#A855F7"/>
  <ellipse cx="80" cy="200" rx="15" ry="20" fill="#34D399"/>

  <!-- Pink Sugar Pasture Hills -->
  <path d="M -20 470 Q 250 410 620 460 L 620 620 L -20 620 Z" fill="#FBCFE8"/>
  <path d="M -20 510 Q 350 450 620 490 L 620 620 L -20 620 Z" fill="#F472B6"/>

  <!-- Giant Swirl Peppermint Lollipop (Left) -->
  <g transform="translate(100, 360)" filter="url(#candy_shadow)">
    <rect x="-6" y="0" width="12" height="180" rx="6" fill="#F8FAFC"/>
    <path d="M -6 30 L 6 45 M -6 70 L 6 85 M -6 110 L 6 125" stroke="#F43F5E" stroke-width="4"/>
    <circle cx="0" cy="-20" r="60" fill="#FFFFFF"/>
    <circle cx="0" cy="-20" r="56" fill="#EF4444"/>
    <path d="M 0 -20 A 45 45 0 0 1 35 15 A 35 35 0 0 1 -25 5 A 25 25 0 0 1 0 -45 A 15 15 0 0 1 12 -12" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
    <polygon points="-25,40 0,30 -25,20" fill="#EC4899"/>
    <polygon points="25,40 0,30 25,20" fill="#EC4899"/>
    <circle cx="0" cy="30" r="8" fill="#DB2777"/>
  </g>

  <!-- Giant Cupcake Castle (Center) -->
  <g transform="translate(300, 340)" filter="url(#candy_shadow)">
    <!-- Waffle Cone Left Tower -->
    <g transform="translate(-130, 40)">
      <polygon points="-30,60 30,60 0,160" fill="url(#wafer_grad)"/>
      <path d="M -25 75 L 15 135 M 25 75 L -15 135" stroke="#B45309" stroke-width="2"/>
      <circle cx="0" cy="50" r="35" fill="#6EE7B7"/>
      <circle cx="0" cy="50" r="8" fill="#FDE047"/>
    </g>

    <!-- Waffle Cone Right Tower -->
    <g transform="translate(130, 40)">
      <polygon points="-30,60 30,60 0,160" fill="url(#wafer_grad)"/>
      <path d="M -25 75 L 15 135 M 25 75 L -15 135" stroke="#B45309" stroke-width="2"/>
      <circle cx="0" cy="50" r="35" fill="#38BDF8"/>
      <circle cx="0" cy="50" r="8" fill="#FDE047"/>
    </g>

    <!-- Main Cupcake Wafer Base -->
    <polygon points="-110,80 110,80 85,180 -85,180" fill="url(#wafer_grad)"/>
    <line x1="-80" y1="80" x2="-65" y2="180" stroke="#B45309" stroke-width="3"/>
    <line x1="-40" y1="80" x2="-30" y2="180" stroke="#B45309" stroke-width="3"/>
    <line x1="0" y1="80" x2="0" y2="180" stroke="#B45309" stroke-width="3"/>
    <line x1="40" y1="80" x2="30" y2="180" stroke="#B45309" stroke-width="3"/>
    <line x1="80" y1="80" x2="65" y2="180" stroke="#B45309" stroke-width="3"/>

    <!-- Chocolate Cookie Castle Door -->
    <path d="M -28 180 L -28 120 Q 0 95 28 120 L 28 180 Z" fill="#78350F"/>
    <circle cx="16" cy="150" r="4" fill="#FDE047"/>

    <!-- Huge Swirling Strawberry Frosting -->
    <ellipse cx="0" cy="70" rx="125" ry="38" fill="url(#frosting_grad)"/>
    <ellipse cx="0" cy="30" rx="100" ry="35" fill="url(#frosting_grad)"/>
    <ellipse cx="0" cy="-10" rx="75" ry="30" fill="url(#frosting_grad)"/>
    <path d="M -40 -15 Q 0 -65 20 -40 Q 0 -15 -40 -15 Z" fill="url(#frosting_grad)"/>

    <!-- Rainbow Sprinkles -->
    <rect x="-80" y="60" width="12" height="4" rx="2" fill="#FDE047" transform="rotate(25, -80, 60)"/>
    <rect x="-40" y="40" width="12" height="4" rx="2" fill="#38BDF8" transform="rotate(-35, -40, 40)"/>
    <rect x="20" y="55" width="12" height="4" rx="2" fill="#4ADE80" transform="rotate(45, 20, 55)"/>
    <rect x="60" y="30" width="12" height="4" rx="2" fill="#A855F7" transform="rotate(-15, 60, 30)"/>
    <rect x="-10" y="10" width="12" height="4" rx="2" fill="#FACC15" transform="rotate(30, -10, 10)"/>
    <rect x="35" y="-5" width="12" height="4" rx="2" fill="#FFFFFF" transform="rotate(-40, 35, -5)"/>

    <!-- Candied Cherry on Top -->
    <circle cx="5" cy="-60" r="22" fill="#DC2626"/>
    <circle cx="-2" cy="-68" r="6" fill="#FFFFFF" opacity="0.8"/>
    <path d="M 5 -78 Q 20 -105 35 -95" fill="none" stroke="#15803D" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="30" cy="-100" rx="10" ry="6" fill="#22C55E" transform="rotate(-20, 30, -100)"/>
  </g>

  <!-- Cute Smiling Gingerbread Buddy (Right) -->
  <g transform="translate(480, 430)" filter="url(#candy_shadow)">
    <ellipse cx="0" cy="40" rx="28" ry="34" fill="#B45309"/>
    <ellipse cx="-16" cy="78" rx="12" ry="18" fill="#B45309"/>
    <ellipse cx="16" cy="78" rx="12" ry="18" fill="#B45309"/>
    <ellipse cx="-32" cy="30" rx="16" ry="10" fill="#B45309" transform="rotate(30, -32, 30)"/>
    <ellipse cx="32" cy="15" rx="16" ry="10" fill="#B45309" transform="rotate(-40, 32, 15)"/>
    <circle cx="0" cy="-8" r="28" fill="#B45309"/>
    <circle cx="-10" cy="-12" r="4" fill="#1E293B"/>
    <circle cx="10" cy="-12" r="4" fill="#1E293B"/>
    <path d="M -10 2 Q 0 12 10 2" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
    <circle cx="-16" cy="-2" r="4" fill="#F43F5E" opacity="0.6"/>
    <circle cx="16" cy="-2" r="4" fill="#F43F5E" opacity="0.6"/>
    <polygon points="-10,18 0,22 -10,26" fill="#FFFFFF"/>
    <polygon points="10,18 0,22 10,26" fill="#FFFFFF"/>
    <circle cx="0" cy="38" r="5" fill="#EF4444"/>
    <circle cx="0" cy="54" r="5" fill="#10B981"/>
    <path d="M -24 82 Q -16 78 -8 82" stroke="#FFFFFF" stroke-width="2.5" fill="none"/>
    <path d="M 8 82 Q 16 78 24 82" stroke="#FFFFFF" stroke-width="2.5" fill="none"/>
  </g>
</svg>`
  },
  {
    id: 'sample_mermaid',
    name: 'Mermaid & Dolphin Pals',
    category: 'Ocean Magic (5yo Favorite)',
    difficulty: 'Junior (2×2) to 5×5',
    defaultGridSize: 2,
    description: 'Sweet little mermaid princess swimming with a joyful baby dolphin and sea turtle!',
    themeColor: 'from-teal-400 via-cyan-400 to-indigo-400',
    accentColor: 'text-teal-500',
    isBuiltIn: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="sea_grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="40%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="tail_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#0D9488"/>
    </linearGradient>
    <linearGradient id="hair_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E879F9"/>
      <stop offset="100%" stop-color="#A855F7"/>
    </linearGradient>
    <filter id="sea_shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0369A1" flood-opacity="0.2"/>
    </filter>
  </defs>

  <!-- Deep Ocean Background -->
  <rect width="600" height="600" fill="url(#sea_grad)"/>

  <!-- Sun Rays Through Water -->
  <polygon points="120,0 180,0 260,600 160,600" fill="#FFFFFF" opacity="0.08"/>
  <polygon points="320,0 400,0 520,600 400,600" fill="#FFFFFF" opacity="0.08"/>

  <!-- Bubbles -->
  <circle cx="80" cy="180" r="14" fill="#FFFFFF" opacity="0.25"/>
  <circle cx="76" cy="176" r="4" fill="#FFFFFF" opacity="0.6"/>
  <circle cx="480" cy="120" r="18" fill="#FFFFFF" opacity="0.25"/>
  <circle cx="474" cy="114" r="5" fill="#FFFFFF" opacity="0.6"/>
  <circle cx="280" cy="240" r="10" fill="#FFFFFF" opacity="0.2"/>
  <circle cx="520" cy="350" r="12" fill="#FFFFFF" opacity="0.25"/>

  <!-- Sandy Seafloor -->
  <path d="M -20 530 Q 300 470 620 520 L 620 620 L -20 620 Z" fill="#FDE68A"/>
  <g transform="translate(60, 500)">
    <path d="M 0 30 Q -15 0 -30 10 Q -10 40 0 40" fill="#F472B6"/>
    <path d="M 10 30 Q 0 -10 15 0 Q 15 35 10 40" fill="#FB7185"/>
    <path d="M 20 30 Q 35 -5 45 15 Q 30 40 20 40" fill="#F472B6"/>
  </g>
  <g transform="translate(540, 520)">
    <path d="M 0 30 Q -20 -30 0 -70 Q 20 -110 0 -140" fill="none" stroke="#22C55E" stroke-width="8" stroke-linecap="round"/>
    <path d="M 20 30 Q 40 -20 20 -60 Q 0 -90 20 -120" fill="none" stroke="#16A34A" stroke-width="8" stroke-linecap="round"/>
  </g>

  <!-- Golden Starfish on Sand -->
  <polygon points="120,535 125,548 138,550 128,559 131,572 120,564 109,572 112,559 102,550 115,548" fill="#FBBF24"/>
  <circle cx="120" cy="554" r="3" fill="#F59E0B"/>

  <!-- Playful Baby Dolphin (Top Right) -->
  <g transform="translate(420, 220)" filter="url(#sea_shadow)">
    <path d="M -80 40 C -40 -40 60 -50 100 0 C 110 15 90 25 70 15 C 30 -5 -30 10 -60 50 Z" fill="#38BDF8"/>
    <path d="M -50 40 C -20 5 40 -5 70 15 C 50 25 10 25 -30 45 Z" fill="#E0F2FE"/>
    <polygon points="15,-30 40,-60 45,-25" fill="#0284C7"/>
    <polygon points="0,5 20,35 -5,25" fill="#0284C7"/>
    <polygon points="-80,40 -105,25 -95,45 -115,55 -80,45" fill="#0284C7"/>
    <ellipse cx="80" cy="-2" rx="5" ry="6" fill="#0F172A"/>
    <circle cx="78" cy="-4" r="2" fill="#FFFFFF"/>
    <path d="M 85 8 Q 92 12 98 8" stroke="#0F172A" stroke-width="2" fill="none"/>
    <ellipse cx="60" cy="-25" rx="3" ry="1.5" fill="#0284C7"/>
  </g>

  <!-- Friendly Little Clownfish (Middle Left) -->
  <g transform="translate(140, 320)" filter="url(#sea_shadow)">
    <ellipse cx="0" cy="0" rx="36" ry="24" fill="#FB923C"/>
    <polygon points="-32,0 -52,-18 -45,0 -52,18" fill="#F97316"/>
    <path d="M -10 -22 Q -5 0 -10 22" stroke="#FFFFFF" stroke-width="8" fill="none"/>
    <path d="M 10 -22 Q 15 0 10 22" stroke="#FFFFFF" stroke-width="8" fill="none"/>
    <circle cx="22" cy="-4" r="7" fill="#1E293B"/>
    <circle cx="20" cy="-6" r="3" fill="#FFFFFF"/>
    <path d="M 28 4 Q 34 8 28 10" stroke="#7C2D12" stroke-width="2" fill="none"/>
  </g>

  <!-- Sweet Little Mermaid Princess (Center) -->
  <g transform="translate(270, 350)" filter="url(#sea_shadow)">
    <path d="M -45 -100 C -90 -30 -70 50 -50 90 C -30 60 -40 0 -25 -40 Z" fill="url(#hair_grad)"/>
    <path d="M 45 -100 C 90 -30 70 50 50 90 C 30 60 40 0 25 -40 Z" fill="url(#hair_grad)"/>
    <path d="M -25 35 C -30 90 -10 130 30 160 C 50 175 40 185 20 180 C -30 150 -50 100 -35 35 Z" fill="url(#tail_grad)"/>
    <g transform="translate(35, 175)">
      <path d="M 0 0 C 35 10 50 40 30 60 C 10 40 0 20 0 0 Z" fill="url(#tail_grad)"/>
      <path d="M 0 0 C 10 30 15 60 -10 70 C -5 45 0 20 0 0 Z" fill="url(#tail_grad)"/>
    </g>
    <circle cx="-15" cy="70" r="5" fill="#A7F3D0" opacity="0.6"/>
    <circle cx="-5" cy="90" r="5" fill="#A7F3D0" opacity="0.6"/>
    <circle cx="10" cy="115" r="5" fill="#A7F3D0" opacity="0.6"/>

    <ellipse cx="0" cy="0" rx="22" ry="32" fill="#FED7AA"/>
    <circle cx="-10" cy="-2" r="11" fill="#F472B6"/>
    <circle cx="10" cy="-2" r="11" fill="#F472B6"/>
    <path d="M -20 -5 Q -45 15 -35 35" stroke="#FED7AA" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M 20 -5 Q 45 15 35 35" stroke="#FED7AA" stroke-width="9" stroke-linecap="round" fill="none"/>

    <circle cx="0" cy="-55" r="32" fill="#FED7AA"/>
    <ellipse cx="-12" cy="-58" rx="8" ry="11" fill="#1E293B"/>
    <ellipse cx="12" cy="-58" rx="8" ry="11" fill="#1E293B"/>
    <circle cx="-14" cy="-62" r="3.5" fill="#FFFFFF"/>
    <circle cx="10" cy="-62" r="3.5" fill="#FFFFFF"/>
    <circle cx="-10" cy="-54" r="1.5" fill="#FFFFFF"/>
    <circle cx="14" cy="-54" r="1.5" fill="#FFFFFF"/>
    <path d="M -7 -42 Q 0 -34 7 -42" fill="none" stroke="#E11D48" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="-18" cy="-48" r="5.5" fill="#FB7185" opacity="0.6"/>
    <circle cx="18" cy="-48" r="5.5" fill="#FB7185" opacity="0.6"/>
    <path d="M -30 -75 Q 0 -95 30 -75 Q 15 -65 0 -68 Q -15 -65 -30 -75 Z" fill="url(#hair_grad)"/>
    <g transform="translate(24, -75)">
      <polygon points="0,-10 3,-3 10,0 3,3 0,10 -3,3 -10,0 -3,-3" fill="#FDE047"/>
      <circle cx="0" cy="0" r="3" fill="#F59E0B"/>
    </g>
  </g>
</svg>`
  },
  {
    id: 'sample_safari',
    name: 'Jungle Safari Express',
    category: 'Animal Friends (5yo Favorite)',
    difficulty: 'Junior (2×2) to 5×5',
    defaultGridSize: 3,
    description: 'Cheerful safari jeep driven by a smiling lion cub with baby giraffe and monkey pals!',
    themeColor: 'from-amber-400 via-yellow-400 to-orange-400',
    accentColor: 'text-amber-500',
    isBuiltIn: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="safari_sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FED7AA"/>
      <stop offset="50%" stop-color="#FEF08A"/>
      <stop offset="100%" stop-color="#BBF7D0"/>
    </linearGradient>
    <linearGradient id="bus_yellow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE047"/>
      <stop offset="100%" stop-color="#EAB308"/>
    </linearGradient>
    <filter id="safari_shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#78350F" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Savannah Sunset Sky -->
  <rect width="600" height="600" fill="url(#safari_sky)"/>
  <circle cx="480" cy="110" r="55" fill="#FDE68A" opacity="0.6"/>
  <circle cx="480" cy="110" r="42" fill="#FBBF24"/>

  <!-- Savannah Plains & Acacia Tree -->
  <path d="M -20 460 Q 300 420 620 450 L 620 620 L -20 620 Z" fill="#86EFAC"/>
  <path d="M -20 500 Q 250 460 620 490 L 620 620 L -20 620 Z" fill="#22C55E"/>

  <g transform="translate(490, 420)" opacity="0.75">
    <path d="M 0 40 L 0 -30 L -30 -60 M 0 -30 L 30 -60" stroke="#78350F" stroke-width="8" stroke-linecap="round"/>
    <ellipse cx="-35" cy="-65" rx="45" ry="14" fill="#15803D"/>
    <ellipse cx="35" cy="-65" rx="45" ry="14" fill="#15803D"/>
    <ellipse cx="0" cy="-80" rx="55" ry="16" fill="#16A34A"/>
  </g>

  <!-- Cheerful Yellow Safari Bus / Jeep (Center) -->
  <g transform="translate(290, 370)" filter="url(#safari_shadow)">
    <!-- Giraffe -->
    <g transform="translate(60, -90)">
      <rect x="-14" y="0" width="28" height="90" rx="8" fill="#FBBF24"/>
      <circle cx="-4" cy="25" r="6" fill="#B45309"/>
      <circle cx="6" cy="50" r="8" fill="#B45309"/>
      <circle cx="-5" cy="72" r="7" fill="#B45309"/>
      <ellipse cx="0" cy="-10" rx="24" ry="20" fill="#FBBF24"/>
      <line x1="-10" y1="-25" x2="-12" y2="-40" stroke="#B45309" stroke-width="4" stroke-linecap="round"/>
      <circle cx="-12" cy="-42" r="5" fill="#92400E"/>
      <line x1="10" y1="-25" x2="12" y2="-40" stroke="#B45309" stroke-width="4" stroke-linecap="round"/>
      <circle cx="12" cy="-42" r="5" fill="#92400E"/>
      <ellipse cx="-26" cy="-15" rx="8" ry="4" fill="#FBBF24" transform="rotate(-20, -26, -15)"/>
      <ellipse cx="26" cy="-15" rx="8" ry="4" fill="#FBBF24" transform="rotate(20, 26, -15)"/>
      <ellipse cx="-10" cy="-14" rx="5" ry="6" fill="#1E293B"/>
      <ellipse cx="10" cy="-14" rx="5" ry="6" fill="#1E293B"/>
      <circle cx="-12" cy="-16" r="2" fill="#FFFFFF"/>
      <circle cx="8" cy="-16" r="2" fill="#FFFFFF"/>
      <path d="M -6 0 Q 0 8 6 0" fill="none" stroke="#78350F" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="-16" cy="-4" r="4" fill="#FB7185" opacity="0.6"/>
      <circle cx="16" cy="-4" r="4" fill="#FB7185" opacity="0.6"/>
    </g>

    <!-- Monkey with Banana -->
    <g transform="translate(-160, -40)">
      <path d="M 25 10 Q 40 -20 20 -40 Q 5 -40 10 -25" fill="none" stroke="#78350F" stroke-width="6" stroke-linecap="round"/>
      <circle cx="15" cy="20" r="18" fill="#92400E"/>
      <circle cx="15" cy="-2" r="16" fill="#92400E"/>
      <circle cx="2" cy="-2" r="6" fill="#FED7AA"/>
      <circle cx="28" cy="-2" r="6" fill="#FED7AA"/>
      <ellipse cx="15" cy="0" rx="11" ry="9" fill="#FED7AA"/>
      <circle cx="11" cy="-2" r="2.5" fill="#1E293B"/>
      <circle cx="19" cy="-2" r="2.5" fill="#1E293B"/>
      <path d="M 12 4 Q 15 7 18 4" fill="none" stroke="#78350F" stroke-width="1.5"/>
      <path d="M 0 25 Q -15 28 -10 12" stroke="#FDE047" stroke-width="5" stroke-linecap="round" fill="none"/>
    </g>

    <!-- Roof -->
    <rect x="-150" y="-15" width="280" height="18" rx="8" fill="#15803D"/>
    <rect x="-140" y="3" width="10" height="45" fill="#15803D"/>
    <rect x="-20" y="3" width="10" height="45" fill="#15803D"/>
    <rect x="110" y="3" width="10" height="45" fill="#15803D"/>

    <!-- Body -->
    <rect x="-160" y="45" width="310" height="95" rx="24" fill="url(#bus_yellow)"/>
    <rect x="-160" y="85" width="310" height="16" fill="#16A34A"/>
    <rect x="-130" y="8" width="100" height="40" rx="8" fill="#BAE6FD" opacity="0.9"/>
    <rect x="-10" y="8" width="110" height="40" rx="8" fill="#BAE6FD" opacity="0.9"/>

    <!-- Lion Cub -->
    <g transform="translate(-80, 28)">
      <circle cx="0" cy="0" r="26" fill="#D97706"/>
      <circle cx="0" cy="2" r="18" fill="#FBBF24"/>
      <path d="M -16 -12 Q 0 -24 16 -12 Z" fill="#A16207"/>
      <rect x="-20" y="-12" width="40" height="4" rx="2" fill="#78350F"/>
      <circle cx="-6" cy="0" r="2.5" fill="#1E293B"/>
      <circle cx="6" cy="0" r="2.5" fill="#1E293B"/>
      <polygon points="0,5 -3,3 3,3" fill="#78350F"/>
      <path d="M -4 8 Q 0 12 4 8" fill="none" stroke="#78350F" stroke-width="1.5"/>
      <circle cx="-10" cy="4" r="3" fill="#FB7185" opacity="0.6"/>
      <circle cx="10" cy="4" r="3" fill="#FB7185" opacity="0.6"/>
    </g>

    <!-- Wheels -->
    <g transform="translate(-100, 140)">
      <circle cx="0" cy="0" r="34" fill="#1E293B"/>
      <circle cx="0" cy="0" r="20" fill="#94A3B8"/>
      <circle cx="0" cy="0" r="8" fill="#E2E8F0"/>
    </g>
    <g transform="translate(80, 140)">
      <circle cx="0" cy="0" r="34" fill="#1E293B"/>
      <circle cx="0" cy="0" r="20" fill="#94A3B8"/>
      <circle cx="0" cy="0" r="8" fill="#E2E8F0"/>
    </g>

    <rect x="140" y="90" width="16" height="20" rx="6" fill="#FDE047"/>
    <circle cx="148" cy="100" r="5" fill="#FFFFFF"/>
    <rect x="135" y="115" width="20" height="14" rx="4" fill="#475569"/>
  </g>
</svg>`
  },
  {
    id: 'sample_kitty',
    name: 'Playful Kitten',
    category: 'Cute Animals',
    difficulty: 'Easy (3×3)',
    defaultGridSize: 3,
    description: 'A sweet pastel kitten playing with a butterfly and ball of yarn!',
    themeColor: 'from-pink-400 to-rose-300',
    accentColor: 'text-pink-500',
    isBuiltIn: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="bg_kitty" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCE7F3"/>
      <stop offset="50%" stop-color="#F3E8FF"/>
      <stop offset="100%" stop-color="#E0E7FF"/>
    </linearGradient>
    <linearGradient id="fur_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFBEB"/>
      <stop offset="100%" stop-color="#FED7AA"/>
    </linearGradient>
    <linearGradient id="yarn_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    <filter id="soft_shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#831843" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="600" height="600" fill="url(#bg_kitty)"/>

  <!-- Decorative Clouds & Floating Hearts -->
  <path d="M 60 120 Q 90 90 130 110 Q 170 90 200 120 Q 210 150 180 160 Q 70 170 60 120 Z" fill="#FFFFFF" opacity="0.6"/>
  <path d="M 420 80 Q 450 50 490 70 Q 530 50 550 80 Q 560 110 530 120 Q 430 130 420 80 Z" fill="#FFFFFF" opacity="0.6"/>
  
  <!-- Floating Hearts & Sparkles -->
  <path d="M 120 220 C 120 200 145 200 145 220 C 145 235 120 250 120 250 C 120 250 95 235 95 220 C 95 200 120 200 120 220 Z" fill="#F43F5E" opacity="0.75"/>
  <path d="M 480 200 C 480 185 500 185 500 200 C 500 212 480 225 480 225 C 480 225 460 212 460 200 C 460 185 480 185 480 200 Z" fill="#FB7185" opacity="0.8"/>
  <polygon points="490,140 495,155 510,160 495,165 490,180 485,165 470,160 485,155" fill="#FDE047"/>
  <polygon points="100,80 103,90 115,93 103,96 100,108 97,96 85,93 97,90" fill="#FDE047"/>

  <!-- Ground Mound -->
  <path d="M -20 540 Q 300 460 620 540 L 620 620 L -20 620 Z" fill="#FBCFE8"/>

  <!-- Yarn Ball and Tangled String -->
  <path d="M 180 500 C 160 480 140 490 120 520 C 100 550 150 560 200 540" fill="none" stroke="#38BDF8" stroke-width="8" stroke-linecap="round"/>
  <circle cx="150" cy="510" r="50" fill="url(#yarn_grad)" filter="url(#soft_shadow)"/>
  <path d="M 115 500 Q 150 480 185 515" fill="none" stroke="#BAE6FD" stroke-width="6" stroke-linecap="round"/>
  <path d="M 125 530 Q 155 510 180 535" fill="none" stroke="#BAE6FD" stroke-width="6" stroke-linecap="round"/>
  <path d="M 140 470 Q 150 510 150 555" fill="none" stroke="#BAE6FD" stroke-width="6" stroke-linecap="round"/>

  <!-- Butterfly -->
  <g transform="translate(440, 260) rotate(-15)">
    <ellipse cx="0" cy="0" rx="4" ry="18" fill="#475569"/>
    <!-- Wings -->
    <path d="M 0 -5 C 30 -35 50 -10 20 5 C 45 15 35 40 0 10 Z" fill="#F59E0B" opacity="0.9"/>
    <path d="M 0 -5 C -30 -35 -50 -10 -20 5 C -45 15 -35 40 0 10 Z" fill="#F59E0B" opacity="0.9"/>
    <circle cx="15" cy="-8" r="4" fill="#FEF08A"/>
    <circle cx="-15" cy="-8" r="4" fill="#FEF08A"/>
  </g>

  <!-- Kitten Body & Tail -->
  <g filter="url(#soft_shadow)">
    <!-- Tail -->
    <path d="M 400 450 C 470 450 490 380 470 340 C 455 315 440 330 445 350 C 455 375 440 410 380 430 Z" fill="url(#fur_grad)"/>

    <!-- Body -->
    <ellipse cx="300" cy="420" rx="120" ry="105" fill="url(#fur_grad)"/>
    <ellipse cx="300" cy="435" rx="75" ry="65" fill="#FFFFFF" opacity="0.85"/>

    <!-- Paws Front -->
    <ellipse cx="245" cy="495" rx="32" ry="24" fill="#FFFFFF"/>
    <ellipse cx="355" cy="495" rx="32" ry="24" fill="#FFFFFF"/>
    <circle cx="235" cy="498" r="4" fill="#FDA4AF"/>
    <circle cx="245" cy="502" r="4" fill="#FDA4AF"/>
    <circle cx="255" cy="498" r="4" fill="#FDA4AF"/>
    <circle cx="345" cy="498" r="4" fill="#FDA4AF"/>
    <circle cx="355" cy="502" r="4" fill="#FDA4AF"/>
    <circle cx="365" cy="498" r="4" fill="#FDA4AF"/>

    <!-- Head -->
    <circle cx="300" cy="270" r="115" fill="url(#fur_grad)"/>

    <!-- Ears -->
    <polygon points="205,210 180,100 270,165" fill="url(#fur_grad)"/>
    <polygon points="210,195 195,120 258,165" fill="#FDA4AF"/>
    <polygon points="395,210 420,100 330,165" fill="url(#fur_grad)"/>
    <polygon points="390,195 405,120 342,165" fill="#FDA4AF"/>

    <!-- Cheeks Blush -->
    <ellipse cx="230" cy="295" rx="18" ry="12" fill="#FB7185" opacity="0.4"/>
    <ellipse cx="370" cy="295" rx="18" ry="12" fill="#FB7185" opacity="0.4"/>

    <!-- Big Cute Eyes -->
    <ellipse cx="250" cy="260" rx="22" ry="28" fill="#1E293B"/>
    <ellipse cx="350" cy="260" rx="22" ry="28" fill="#1E293B"/>
    <!-- Eye Highlights -->
    <circle cx="242" cy="250" r="9" fill="#FFFFFF"/>
    <circle cx="256" cy="272" r="4" fill="#FFFFFF"/>
    <circle cx="342" cy="250" r="9" fill="#FFFFFF"/>
    <circle cx="356" cy="272" r="4" fill="#FFFFFF"/>

    <!-- Cute Nose & Mouth -->
    <polygon points="300,282 292,274 308,274" fill="#F43F5E"/>
    <path d="M 292 284 Q 282 298 272 290" fill="none" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
    <path d="M 308 284 Q 318 298 328 290" fill="none" stroke="#475569" stroke-width="4" stroke-linecap="round"/>

    <!-- Whiskers -->
    <line x1="210" y1="278" x2="140" y2="265" stroke="#94A3B8" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="210" y1="288" x2="145" y2="295" stroke="#94A3B8" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="390" y1="278" x2="460" y2="265" stroke="#94A3B8" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="390" y1="288" x2="455" y2="295" stroke="#94A3B8" stroke-width="3.5" stroke-linecap="round"/>
  </g>
</svg>`
  },
  {
    id: 'sample_puppy',
    name: 'Sunny Puppy',
    category: 'Cute Animals',
    difficulty: 'Easy (3×3)',
    defaultGridSize: 3,
    description: 'A cheerful puppy enjoying a sunny day outdoors with a tennis ball!',
    themeColor: 'from-amber-400 to-yellow-300',
    accentColor: 'text-amber-500',
    isBuiltIn: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="sky_grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#BAE6FD"/>
      <stop offset="60%" stop-color="#E0F2FE"/>
      <stop offset="100%" stop-color="#FEF08A"/>
    </linearGradient>
    <linearGradient id="grass_grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#86EFAC"/>
      <stop offset="100%" stop-color="#22C55E"/>
    </linearGradient>
    <linearGradient id="dog_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDBA74"/>
      <stop offset="100%" stop-color="#EA580C"/>
    </linearGradient>
    <filter id="shadow_puppy" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#7C2D12" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Sky -->
  <rect width="600" height="600" fill="url(#sky_grad)"/>

  <!-- Rainbow in Sky -->
  <g opacity="0.65">
    <path d="M 50 280 A 250 250 0 0 1 550 280" fill="none" stroke="#F43F5E" stroke-width="12"/>
    <path d="M 62 280 A 238 238 0 0 1 538 280" fill="none" stroke="#FB923C" stroke-width="12"/>
    <path d="M 74 280 A 226 226 0 0 1 526 280" fill="none" stroke="#FBBF24" stroke-width="12"/>
    <path d="M 86 280 A 214 214 0 0 1 514 280" fill="none" stroke="#4ADE80" stroke-width="12"/>
    <path d="M 98 280 A 202 202 0 0 1 502 280" fill="none" stroke="#38BDF8" stroke-width="12"/>
  </g>

  <!-- Smiling Sun -->
  <g transform="translate(100, 100)">
    <circle cx="0" cy="0" r="45" fill="#FBBF24"/>
    <circle cx="0" cy="0" r="38" fill="#FDE047"/>
    <!-- Rays -->
    <path d="M 0 -55 L 0 -65 M 39 -39 L 46 -46 M 55 0 L 65 0 M 39 39 L 46 46 M 0 55 L 0 65 M -39 39 L -46 46 M -55 0 L -65 0 M -39 -39 L -46 -46" stroke="#F59E0B" stroke-width="6" stroke-linecap="round"/>
    <!-- Face -->
    <circle cx="-12" cy="-5" r="4" fill="#78350F"/>
    <circle cx="12" cy="-5" r="4" fill="#78350F"/>
    <path d="M -10 10 Q 0 20 10 10" fill="none" stroke="#78350F" stroke-width="3" stroke-linecap="round"/>
  </g>

  <!-- Green Grass Hills -->
  <path d="M -50 420 Q 180 370 380 430 Q 520 460 650 410 L 650 620 L -50 620 Z" fill="url(#grass_grad)"/>

  <!-- Flowers on grass -->
  <g transform="translate(80, 480)">
    <circle cx="0" cy="0" r="8" fill="#FDE047"/>
    <circle cx="-12" cy="0" r="6" fill="#FFFFFF"/>
    <circle cx="12" cy="0" r="6" fill="#FFFFFF"/>
    <circle cx="0" cy="-12" r="6" fill="#FFFFFF"/>
    <circle cx="0" cy="12" r="6" fill="#FFFFFF"/>
  </g>
  <g transform="translate(520, 490)">
    <circle cx="0" cy="0" r="8" fill="#FDE047"/>
    <circle cx="-12" cy="0" r="6" fill="#FB7185"/>
    <circle cx="12" cy="0" r="6" fill="#FB7185"/>
    <circle cx="0" cy="-12" r="6" fill="#FB7185"/>
    <circle cx="0" cy="12" r="6" fill="#FB7185"/>
  </g>

  <!-- Tennis Ball -->
  <g transform="translate(460, 450)" filter="url(#shadow_puppy)">
    <circle cx="0" cy="0" r="28" fill="#A3E635"/>
    <path d="M -20 -15 Q 0 0 -20 15" fill="none" stroke="#FFFFFF" stroke-width="3"/>
    <path d="M 20 -15 Q 0 0 20 15" fill="none" stroke="#FFFFFF" stroke-width="3"/>
  </g>

  <!-- Puppy -->
  <g filter="url(#shadow_puppy)">
    <!-- Wagging Tail -->
    <path d="M 400 400 Q 480 370 470 320 Q 450 330 435 360 Z" fill="#C2410C"/>

    <!-- Body -->
    <ellipse cx="310" cy="400" rx="115" ry="95" fill="url(#dog_grad)"/>
    <ellipse cx="290" cy="415" rx="65" ry="60" fill="#FFF7ED"/>

    <!-- Paws Front -->
    <ellipse cx="250" cy="475" rx="30" ry="22" fill="#FFF7ED"/>
    <ellipse cx="370" cy="475" rx="30" ry="22" fill="#FFF7ED"/>

    <!-- Collar & Medal -->
    <path d="M 230 320 Q 310 350 390 320" fill="none" stroke="#DC2626" stroke-width="16" stroke-linecap="round"/>
    <circle cx="310" cy="345" r="14" fill="#FBBF24"/>
    <polygon points="310,336 313,342 320,342 314,346 316,352 310,348 304,352 306,346 300,342 307,342" fill="#FFFFFF"/>

    <!-- Head -->
    <ellipse cx="310" cy="240" rx="100" ry="90" fill="url(#dog_grad)"/>

    <!-- White Snout Patch -->
    <ellipse cx="310" cy="265" rx="48" ry="38" fill="#FFF7ED"/>

    <!-- Floppy Ears -->
    <path d="M 215 190 C 160 210 160 310 200 325 C 220 330 230 300 230 260 Z" fill="#9A3412"/>
    <path d="M 405 190 C 460 210 460 310 420 325 C 400 330 390 300 390 260 Z" fill="#9A3412"/>

    <!-- Big Puppy Eyes -->
    <ellipse cx="265" cy="225" rx="18" ry="22" fill="#451A03"/>
    <ellipse cx="355" cy="225" rx="18" ry="22" fill="#451A03"/>
    <circle cx="260" cy="216" r="7" fill="#FFFFFF"/>
    <circle cx="270" cy="232" r="3" fill="#FFFFFF"/>
    <circle cx="350" cy="216" r="7" fill="#FFFFFF"/>
    <circle cx="360" cy="232" r="3" fill="#FFFFFF"/>

    <!-- Cheerful Nose -->
    <ellipse cx="310" cy="255" rx="16" ry="12" fill="#1C1917"/>

    <!-- Smiling Mouth & Tongue -->
    <path d="M 310 267 L 310 275" stroke="#1C1917" stroke-width="4"/>
    <path d="M 292 275 Q 310 288 328 275" fill="none" stroke="#1C1917" stroke-width="4" stroke-linecap="round"/>
    <!-- Happy Tongue -->
    <path d="M 302 280 C 302 305 320 305 320 280 Z" fill="#F43F5E"/>
  </g>
</svg>`
  },
  {
    id: 'sample_space',
    name: 'Cosmic Explorer',
    category: 'Adventure',
    difficulty: 'Medium (4×4)',
    defaultGridSize: 4,
    description: 'A friendly astronaut and colorful rocket blasting off into outer space!',
    themeColor: 'from-indigo-600 to-purple-500',
    accentColor: 'text-indigo-500',
    isBuiltIn: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <radialGradient id="space_grad" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#312E81"/>
      <stop offset="60%" stop-color="#1E1B4B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </radialGradient>
    <linearGradient id="rocket_body" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
    <linearGradient id="flame_grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FDE047"/>
      <stop offset="50%" stop-color="#F97316"/>
      <stop offset="100%" stop-color="#EF4444"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Deep Space Background -->
  <rect width="600" height="600" fill="url(#space_grad)"/>

  <!-- Stars -->
  <g fill="#FDE047">
    <circle cx="80" cy="120" r="3"/>
    <circle cx="150" cy="70" r="4"/>
    <circle cx="280" cy="40" r="3"/>
    <circle cx="450" cy="90" r="5" opacity="0.9"/>
    <circle cx="530" cy="180" r="3"/>
    <circle cx="90" cy="360" r="4"/>
    <circle cx="50" cy="480" r="3"/>
    <circle cx="530" cy="460" r="4"/>
    <!-- Twinkle stars -->
    <polygon points="120,200 123,212 135,215 123,218 120,230 117,218 105,215 117,212"/>
    <polygon points="480,260 482,270 492,272 482,274 480,284 478,274 468,272 478,270"/>
    <polygon points="340,120 342,128 350,130 342,132 340,140 338,132 330,130 338,128"/>
  </g>

  <!-- Saturn Planet with Rings -->
  <g transform="translate(110, 480)">
    <!-- Behind Ring -->
    <ellipse cx="0" cy="0" rx="70" ry="16" fill="none" stroke="#FBBF24" stroke-width="8" opacity="0.5" transform="rotate(-20)"/>
    <!-- Planet Ball -->
    <circle cx="0" cy="0" r="42" fill="#FB923C"/>
    <circle cx="0" cy="0" r="42" fill="#F472B6" opacity="0.4"/>
    <!-- Front Ring -->
    <path d="M -66 23 A 70 16 0 0 0 66 -23" fill="none" stroke="#FDE047" stroke-width="8" transform="rotate(-20)"/>
  </g>

  <!-- Smiling Crescent Moon -->
  <g transform="translate(480, 100)">
    <path d="M 0 -45 A 50 50 0 1 0 45 45 A 40 40 0 1 1 0 -45 Z" fill="#FDE047" filter="url(#glow)"/>
    <circle cx="8" cy="8" r="4" fill="#CA8A04"/>
    <path d="M 12 20 Q 22 25 24 15" fill="none" stroke="#CA8A04" stroke-width="3" stroke-linecap="round"/>
  </g>

  <!-- Cartoon Rocket -->
  <g transform="translate(420, 360) rotate(-45)">
    <!-- Flame Blast -->
    <path d="M -24 90 Q 0 160 24 90 Z" fill="url(#flame_grad)"/>
    <path d="M -12 90 Q 0 135 12 90 Z" fill="#FEF08A"/>

    <!-- Fins -->
    <path d="M -35 40 L -70 85 L -35 80 Z" fill="#EF4444"/>
    <path d="M 35 40 L 70 85 L 35 80 Z" fill="#EF4444"/>

    <!-- Rocket Body -->
    <path d="M -35 85 Q -38 0 0 -70 Q 38 0 35 85 Z" fill="url(#rocket_body)"/>
    <!-- Nosecone -->
    <path d="M -25 -25 Q 0 -70 0 -70 Q 0 -70 25 -25 Z" fill="#EF4444"/>
    <!-- Porthole Window -->
    <circle cx="0" cy="15" r="20" fill="#38BDF8" stroke="#0284C7" stroke-width="5"/>
    <circle cx="-6" cy="10" r="5" fill="#FFFFFF"/>
  </g>

  <!-- Friendly Floating Astronaut -->
  <g transform="translate(250, 310)">
    <!-- Space Backpack -->
    <rect x="-65" y="-50" width="130" height="110" rx="25" fill="#94A3B8"/>

    <!-- Body -->
    <rect x="-50" y="-30" width="100" height="110" rx="30" fill="#F8FAFC"/>
    <!-- Chest Control Panel -->
    <rect x="-24" y="0" width="48" height="32" rx="8" fill="#E2E8F0"/>
    <circle cx="-12" cy="16" r="5" fill="#3B82F6"/>
    <circle cx="0" cy="16" r="5" fill="#EF4444"/>
    <circle cx="12" cy="16" r="5" fill="#10B981"/>

    <!-- Legs & Boots -->
    <rect x="-42" y="70" width="32" height="45" rx="14" fill="#F8FAFC"/>
    <rect x="10" y="70" width="32" height="45" rx="14" fill="#F8FAFC"/>
    <rect x="-46" y="102" width="38" height="20" rx="8" fill="#64748B"/>
    <rect x="8" y="102" width="38" height="20" rx="8" fill="#64748B"/>

    <!-- Waving Arms -->
    <path d="M -45 -10 Q -85 -20 -95 -50" fill="none" stroke="#F8FAFC" stroke-width="26" stroke-linecap="round"/>
    <circle cx="-95" cy="-55" r="14" fill="#64748B"/>

    <path d="M 45 -10 Q 75 10 85 30" fill="none" stroke="#F8FAFC" stroke-width="26" stroke-linecap="round"/>
    <circle cx="88" cy="34" r="14" fill="#64748B"/>

    <!-- Big Round Helmet -->
    <circle cx="0" cy="-80" r="62" fill="#F8FAFC"/>
    <!-- Visor Glass with Cute Smile -->
    <ellipse cx="0" cy="-80" rx="46" ry="38" fill="#0284C7"/>
    <ellipse cx="0" cy="-80" rx="42" ry="34" fill="#38BDF8"/>
    <!-- Visor reflections & happy eyes -->
    <path d="M -24 -92 Q 0 -105 24 -92" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
    <circle cx="-14" cy="-78" r="5" fill="#0C4A6E"/>
    <circle cx="14" cy="-78" r="5" fill="#0C4A6E"/>
    <path d="M -8 -66 Q 0 -58 8 -66" fill="none" stroke="#0C4A6E" stroke-width="4" stroke-linecap="round"/>
  </g>
</svg>`
  },
  {
    id: 'sample_unicorn',
    name: 'Magical Unicorn',
    category: 'Fantasy',
    difficulty: 'Medium (4×4)',
    defaultGridSize: 4,
    description: 'An enchanting unicorn with a golden horn and rainbow mane!',
    themeColor: 'from-purple-400 to-pink-300',
    accentColor: 'text-purple-500',
    isBuiltIn: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="magic_bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDF4FF"/>
      <stop offset="50%" stop-color="#F5D0FE"/>
      <stop offset="100%" stop-color="#C084FC"/>
    </linearGradient>
    <linearGradient id="horn_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A"/>
      <stop offset="50%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <filter id="sparkle_glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="600" height="600" fill="url(#magic_bg)"/>

  <!-- Puffy Clouds at Bottom -->
  <g fill="#FFFFFF" opacity="0.75">
    <circle cx="100" cy="540" r="90"/>
    <circle cx="220" cy="560" r="80"/>
    <circle cx="340" cy="530" r="100"/>
    <circle cx="480" cy="550" r="90"/>
    <circle cx="580" cy="530" r="80"/>
  </g>

  <!-- Floating Sparkles & Hearts -->
  <g fill="#FDE047" filter="url(#sparkle_glow)">
    <polygon points="120,140 124,152 136,156 124,160 120,172 116,160 104,156 116,152"/>
    <polygon points="460,110 463,120 473,123 463,126 460,136 457,126 447,123 457,120"/>
    <polygon points="500,240 504,250 514,254 504,258 500,268 496,258 486,254 496,250"/>
    <polygon points="90,320 93,328 101,331 93,334 90,342 87,334 79,331 87,328"/>
  </g>
  <g fill="#F43F5E" opacity="0.7">
    <path d="M 450 180 C 450 165 470 165 470 180 C 470 192 450 205 450 205 C 450 205 430 192 430 180 C 430 165 450 165 450 180 Z"/>
    <path d="M 140 240 C 140 228 156 228 156 240 C 156 250 140 260 140 260 C 140 260 124 250 124 240 C 124 228 140 228 140 240 Z"/>
  </g>

  <!-- Unicorn -->
  <g transform="translate(180, 110)">
    <!-- Rainbow Mane (Behind Neck) -->
    <path d="M 130 140 C 230 150 240 330 160 380 C 220 330 200 200 120 180 Z" fill="#F472B6"/>
    <path d="M 145 160 C 235 180 230 350 140 395 C 205 340 195 230 135 200 Z" fill="#C084FC"/>
    <path d="M 155 180 C 230 210 210 370 120 410 C 185 360 185 260 145 220 Z" fill="#60A5FA"/>
    <path d="M 165 200 C 235 240 200 390 100 420 C 170 380 175 290 150 240 Z" fill="#4ADE80"/>

    <!-- Neck & Chest -->
    <path d="M 70 210 Q 50 340 10 430 L 190 430 Q 180 320 120 190 Z" fill="#FFFFFF"/>

    <!-- Head -->
    <path d="M 120 190 C 120 120 60 90 -20 130 C -70 160 -90 220 -20 250 C 40 270 120 260 120 190 Z" fill="#FFFFFF"/>

    <!-- Cute Ear -->
    <polygon points="65,115 110,60 115,130" fill="#FFFFFF"/>
    <polygon points="75,112 103,75 106,122" fill="#F472B6"/>

    <!-- Golden Spiral Horn -->
    <polygon points="20,105 45,-20 50,95" fill="url(#horn_grad)"/>
    <path d="M 28 80 L 48 72 M 34 50 L 47 44 M 40 20 L 46 16" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>

    <!-- Mane Front Bangs -->
    <path d="M 50 110 C 40 70 -10 90 0 130 C 20 120 40 130 50 110 Z" fill="#F472B6"/>
    <path d="M 60 125 C 55 95 10 110 20 145 C 35 135 50 145 60 125 Z" fill="#FBBF24"/>

    <!-- Sweet Closed Eye with Eyelashes -->
    <path d="M -5 185 Q 15 205 35 185" fill="none" stroke="#4C1D95" stroke-width="4.5" stroke-linecap="round"/>
    <line x1="10" y1="198" x2="10" y2="208" stroke="#4C1D95" stroke-width="4" stroke-linecap="round"/>
    <line x1="22" y1="196" x2="28" y2="205" stroke="#4C1D95" stroke-width="4" stroke-linecap="round"/>
    <line x1="-2" y1="192" x2="-8" y2="201" stroke="#4C1D95" stroke-width="4" stroke-linecap="round"/>

    <!-- Cheerful Pink Cheek Blush -->
    <ellipse cx="25" cy="225" rx="16" ry="10" fill="#FB7185" opacity="0.45"/>

    <!-- Cute Nose & Smile -->
    <circle cx="-50" cy="195" r="4.5" fill="#FDA4AF"/>
    <path d="M -60 215 Q -45 230 -30 218" fill="none" stroke="#FDA4AF" stroke-width="3.5" stroke-linecap="round"/>
  </g>
</svg>`
  },
  {
    id: 'sample_turtle',
    name: 'Ocean Sea Turtle',
    category: 'Underwater',
    difficulty: 'Hard (5×5)',
    defaultGridSize: 5,
    description: 'A happy sea turtle swimming among coral reefs, bubbles, and fish!',
    themeColor: 'from-teal-400 to-cyan-300',
    accentColor: 'text-teal-500',
    isBuiltIn: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="ocean_grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="60%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#0F766E"/>
    </linearGradient>
    <linearGradient id="shell_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <filter id="ocean_shadow">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#042F2E" flood-opacity="0.2"/>
    </filter>
  </defs>

  <!-- Deep Ocean Background -->
  <rect width="600" height="600" fill="url(#ocean_grad)"/>

  <!-- Sun Rays Shining Down -->
  <polygon points="80,0 160,0 240,600 120,600" fill="#FFFFFF" opacity="0.1"/>
  <polygon points="320,0 420,0 480,600 360,600" fill="#FFFFFF" opacity="0.1"/>

  <!-- Sandy Seabed & Coral -->
  <path d="M -20 540 Q 200 500 620 550 L 620 620 L -20 620 Z" fill="#FDE047" opacity="0.8"/>
  <!-- Coral Plants -->
  <path d="M 60 550 C 40 460 70 420 50 380 C 80 410 90 470 100 550 Z" fill="#FB7185"/>
  <path d="M 100 550 C 120 480 150 450 140 400 C 160 440 150 500 130 550 Z" fill="#F43F5E"/>
  <path d="M 480 550 C 460 460 500 420 510 360 C 530 410 520 480 530 550 Z" fill="#A855F7"/>

  <!-- Pink Starfish on Sand -->
  <g transform="translate(160, 535) rotate(15)">
    <polygon points="0,-22 6,-6 22,-6 10,4 14,20 0,10 -14,20 -10,4 -22,-6 -6,-6" fill="#FB7185"/>
    <circle cx="-3" cy="2" r="2" fill="#881337"/>
    <circle cx="3" cy="2" r="2" fill="#881337"/>
  </g>

  <!-- Bubbles -->
  <g fill="#FFFFFF" opacity="0.4">
    <circle cx="200" cy="220" r="14"/>
    <circle cx="180" cy="180" r="8"/>
    <circle cx="215" cy="150" r="6"/>
    <circle cx="430" cy="280" r="12"/>
    <circle cx="450" cy="230" r="7"/>
    <circle cx="410" cy="190" r="10"/>
  </g>

  <!-- Little Orange Clownfish -->
  <g transform="translate(460, 180)">
    <ellipse cx="0" cy="0" rx="30" ry="18" fill="#F97316"/>
    <!-- Tail Fin -->
    <polygon points="25,0 45,-14 45,14" fill="#F97316"/>
    <!-- White Stripes -->
    <path d="M -8 -16 Q -5 0 -8 16" stroke="#FFFFFF" stroke-width="6"/>
    <path d="M 12 -14 Q 15 0 12 14" stroke="#FFFFFF" stroke-width="6"/>
    <!-- Eye -->
    <circle cx="-16" cy="-4" r="4" fill="#000000"/>
    <circle cx="-17" cy="-5" r="1.5" fill="#FFFFFF"/>
  </g>

  <!-- Happy Sea Turtle -->
  <g transform="translate(290, 310)" filter="url(#ocean_shadow)">
    <!-- Back Flippers -->
    <ellipse cx="-80" cy="80" rx="40" ry="20" fill="#6EE7B7" transform="rotate(-30, -80, 80)"/>
    <ellipse cx="80" cy="80" rx="40" ry="20" fill="#6EE7B7" transform="rotate(30, 80, 80)"/>

    <!-- Front Big Swimming Flippers -->
    <path d="M -80 -30 C -170 -60 -190 20 -110 30 C -80 35 -70 0 -80 -30 Z" fill="#6EE7B7"/>
    <path d="M 80 -30 C 170 -60 190 20 110 30 C 80 35 70 0 80 -30 Z" fill="#6EE7B7"/>

    <!-- Turtle Tail -->
    <polygon points="-12,120 0,150 12,120" fill="#6EE7B7"/>

    <!-- Turtle Head -->
    <ellipse cx="0" cy="-110" rx="45" ry="50" fill="#6EE7B7"/>
    <!-- Cheerful Eyes -->
    <ellipse cx="-20" cy="-122" rx="12" ry="15" fill="#064E3B"/>
    <ellipse cx="20" cy="-122" rx="12" ry="15" fill="#064E3B"/>
    <circle cx="-23" cy="-127" r="4.5" fill="#FFFFFF"/>
    <circle cx="17" cy="-127" r="4.5" fill="#FFFFFF"/>
    <!-- Smile & Cheeks -->
    <path d="M -15 -92 Q 0 -78 15 -92" fill="none" stroke="#047857" stroke-width="4" stroke-linecap="round"/>
    <circle cx="-30" cy="-100" r="7" fill="#F472B6" opacity="0.5"/>
    <circle cx="30" cy="-100" r="7" fill="#F472B6" opacity="0.5"/>

    <!-- Big Patterned Shell -->
    <ellipse cx="0" cy="15" rx="105" ry="115" fill="url(#shell_grad)"/>
    <ellipse cx="0" cy="15" rx="90" ry="100" fill="#10B981"/>

    <!-- Honeycomb Scute Patterns on Shell -->
    <polygon points="0,-40 30,-22 30,12 0,30 -30,12 -30,-22" fill="#047857" opacity="0.6"/>
    <polygon points="0,35 30,53 30,87 0,105 -30,87 -30,53" fill="#047857" opacity="0.6"/>
    <polygon points="35,-15 65,3 65,37 35,55 5,37 5,3" fill="#047857" opacity="0.5"/>
    <polygon points="-35,-15 -5,3 -5,37 -35,55 -65,37 -65,3" fill="#047857" opacity="0.5"/>
  </g>
</svg>`
  }
];

// Attach data URIs to samples so they can be rendered as normal images
SAMPLE_PUZZLES.forEach(puzzle => {
  puzzle.imageSrc = 'data:image/svg+xml;utf8,' + encodeURIComponent(puzzle.svg);
  puzzle.thumbSrc = puzzle.imageSrc;
});

// Helper to look up a sample puzzle by ID
function getSamplePuzzleById(id) {
  return SAMPLE_PUZZLES.find(p => p.id === id) || null;
}
