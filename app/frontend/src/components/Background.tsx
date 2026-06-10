export default function Background() {
  return (
    <div className="bg-pattern">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Hexagon path for turtle-shell pattern */}
          <polygon id="hex" points="30,0 60,17 60,51 30,68 0,51 0,17" />
        </defs>

        {/* Layer 1 — large faint circles */}
        <circle cx="5%" cy="10%" r="180" fill="#D6CFC0" opacity="0.25" />
        <circle cx="92%" cy="8%" r="220" fill="#C8C0AF" opacity="0.18" />
        <circle cx="15%" cy="75%" r="260" fill="#D6CFC0" opacity="0.2" />
        <circle cx="88%" cy="80%" r="200" fill="#C5BEA8" opacity="0.22" />
        <circle cx="50%" cy="50%" r="300" fill="#DDD8CC" opacity="0.12" />

        {/* Layer 2 — medium rings (outline only) */}
        <circle cx="20%" cy="30%" r="120" fill="none" stroke="#BEB7A4" strokeWidth="1.5" opacity="0.3" />
        <circle cx="75%" cy="60%" r="150" fill="none" stroke="#BEB7A4" strokeWidth="1.5" opacity="0.25" />
        <circle cx="40%" cy="85%" r="90" fill="none" stroke="#C2BAA5" strokeWidth="1" opacity="0.3" />
        <circle cx="85%" cy="20%" r="100" fill="none" stroke="#BEB7A4" strokeWidth="1" opacity="0.25" />

        {/* Layer 3 — turtle shell hexagons scattered */}
        <g opacity="0.12" fill="#6B8F4E" transform="translate(60,40) scale(0.7)">
          <use href="#hex" />
        </g>
        <g opacity="0.1" fill="#6B8F4E" transform="translate(200,120) scale(0.5)">
          <use href="#hex" />
        </g>
        <g opacity="0.12" fill="#6B8F4E" transform="translate(80,300) scale(0.9)">
          <use href="#hex" />
        </g>
        <g opacity="0.08" fill="#6B8F4E" transform="translate(400,80) scale(1.2)">
          <use href="#hex" />
        </g>
        <g opacity="0.1" fill="#6B8F4E" transform="translate(700,200) scale(0.8)">
          <use href="#hex" />
        </g>
        <g opacity="0.12" fill="#6B8F4E" transform="translate(900,50) scale(0.6)">
          <use href="#hex" />
        </g>
        <g opacity="0.08" fill="#6B8F4E" transform="translate(1100,300) scale(1.0)">
          <use href="#hex" />
        </g>
        <g opacity="0.1" fill="#6B8F4E" transform="translate(300,500) scale(0.7)">
          <use href="#hex" />
        </g>
        <g opacity="0.12" fill="#6B8F4E" transform="translate(600,600) scale(1.1)">
          <use href="#hex" />
        </g>
        <g opacity="0.08" fill="#6B8F4E" transform="translate(1000,550) scale(0.9)">
          <use href="#hex" />
        </g>
        <g opacity="0.1" fill="#6B8F4E" transform="translate(150,700) scale(0.6)">
          <use href="#hex" />
        </g>
        <g opacity="0.12" fill="#6B8F4E" transform="translate(850,750) scale(0.8)">
          <use href="#hex" />
        </g>

        {/* Layer 4 — leaf/oval shapes */}
        <ellipse cx="12%" cy="55%" rx="40" ry="18" fill="#7A9E58" opacity="0.1" transform="rotate(-30, 200, 400)" />
        <ellipse cx="78%" cy="35%" rx="50" ry="20" fill="#7A9E58" opacity="0.1" transform="rotate(20, 1100, 300)" />
        <ellipse cx="55%" cy="90%" rx="35" ry="14" fill="#7A9E58" opacity="0.08" transform="rotate(-15, 800, 700)" />
        <ellipse cx="30%" cy="20%" rx="45" ry="16" fill="#7A9E58" opacity="0.09" transform="rotate(40, 400, 150)" />
        <ellipse cx="90%" cy="65%" rx="38" ry="15" fill="#7A9E58" opacity="0.08" transform="rotate(-20, 1300, 500)" />

        {/* Layer 5 — small dots scattered */}
        {[
          [10,15],[25,40],[45,10],[60,25],[80,15],[95,35],
          [5,60],[20,80],[35,65],[55,75],[70,55],[85,70],[98,85],
          [15,95],[40,90],[65,95],[90,90],[50,50],[30,50],[70,80],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={`${cx}%`} cy={`${cy}%`} r={i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 4}
            fill="#A09880" opacity={0.12 + (i % 4) * 0.04} />
        ))}

        {/* Layer 6 — diagonal lines (subtle) */}
        <line x1="0" y1="0" x2="100%" y2="100%" stroke="#C2BAA5" strokeWidth="0.5" opacity="0.1" />
        <line x1="0" y1="20%" x2="80%" y2="100%" stroke="#C2BAA5" strokeWidth="0.5" opacity="0.08" />
        <line x1="20%" y1="0" x2="100%" y2="80%" stroke="#C2BAA5" strokeWidth="0.5" opacity="0.08" />

        {/* Layer 7 — small hexagon outlines at corners */}
        <g opacity="0.15" fill="none" stroke="#8FAF6A" strokeWidth="1.5" transform="translate(30,80) scale(1.5)">
          <use href="#hex" />
        </g>
        <g opacity="0.12" fill="none" stroke="#8FAF6A" strokeWidth="1" transform="translate(1200,100) scale(1.2)">
          <use href="#hex" />
        </g>
        <g opacity="0.1" fill="none" stroke="#8FAF6A" strokeWidth="1" transform="translate(50,650) scale(1.8)">
          <use href="#hex" />
        </g>
        <g opacity="0.12" fill="none" stroke="#8FAF6A" strokeWidth="1.5" transform="translate(1150,600) scale(1.4)">
          <use href="#hex" />
        </g>
      </svg>
    </div>
  );
}
