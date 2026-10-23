/* ═══════════════════════════════════════════════════════════════════════════
   ReconcileAI — Tailwind theme preset

   🛑 EVERY VALUE HERE IS var(--token). NOT ONE HEX IS INLINED, AND THAT IS THE
   WHOLE POINT OF THE FILE. A preset that copies #00303f into its palette FORKS
   THE KERNEL: the dark theme stops applying, and there are suddenly two places
   a colour is declared — which is the drift tokens.css exists to prevent.
   Consequence, stated rather than discovered: tokens.css STILL HAS TO BE
   LOADED. This preset names the system's vocabulary in Tailwind's shape; it
   does not carry the system's values.

   ⚠️ AND THE NAMES ARE THE JOBS. `text-refused` is legible at a call site in a
   way `text-slate-500` is not, and it is what makes a review able to catch
   "this disabled control is using the cleared-work step" by reading the class
   list. Do not add aliases, shades or numeric scales: a `refused-400` would be
   a step with no job.

   WHAT IS DELIBERATELY ABSENT
   · boxShadow — there is no elevation scale. A surface separates by rule or by
     ground (THE SURFACE RULE). The one shadow-shaped token is a hairline.
   · backgroundImage gradients beyond the mark — a gradient on a surface is an
     elevation claim without an elevation scale.
   · a colour scale (50…900) — every step here has one job, and a scale is what
     you build when they do not.
   · `screens` beyond the four tiers — a fifth breakpoint is a finding.
   ═══════════════════════════════════════════════════════════════════════════ */

const v = (name) => `var(--${name})`;

module.exports = {
  // The system owns its own reset and base type in tokens.css, so Tailwind's
  // preflight is left ON but the base layer below does not re-declare body.
  theme: {
    // ── COLOUR ───────────────────────────────────────────────────────────
    // Flat, not nested, so a class reads as the token's job: bg-sheet,
    // text-refused, border-rule-strong.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',

      paper:        v('paper'),
      sheet:        v('sheet'),
      'tile-hover': v('tile-hover'),
      'row-hover':  v('row-hover'),

      ink:           v('ink'),
      refused:       v('refused'),     // a control that was never usable
      muted:         v('muted'),       // supporting text, nothing else
      recede:        v('recede'),      // CLEARED work. never refused work
      'rule-strong': v('rule-strong'), // between sections. never text
      rule:          v('rule'),        // between rows. never text
      'on-ink':      v('on-ink'),
      'on-ink-2':    v('on-ink-2'),

      // 🛑 THE AGENT RULE: measurement only. Available as a colour because the
      // meter needs it; if you are reaching for it on a hover, a link, a
      // citation or an activity indicator, that is the defect and not the fix.
      agent:        v('agent'),
      'agent-deep': v('agent-deep'),
      track:        v('track'),

      // 🛑 R16: wayfinding only, and it REINFORCES. Remove it and wayfinding
      // still works — that is the test.
      accent:         v('accent'),
      'accent-deep':  v('accent-deep'),
      'accent-quiet': v('accent-quiet'),

      scrim: v('scrim'),
    },

    // ── TYPE ─────────────────────────────────────────────────────────────
    fontFamily: {
      sans: v('face-sans'),
      mono: v('face-mono'),
    },

    // Six steps. There is no s5, and `text-base` is deliberately not defined:
    // the default is set on body in tokens.css, and an undefined alias is
    // better than a second name for --s3.
    fontSize: {
      s1: [v('s1'), { lineHeight: v('lh-note'),    letterSpacing: v('tr-micro') }],
      s2: [v('s2'), { lineHeight: v('lh-note') }],
      s3: [v('s3'), { lineHeight: v('lh-body') }],
      s4: [v('s4'), { lineHeight: v('lh-body'),    letterSpacing: v('tr-title') }],
      s6: [v('s6'), { lineHeight: '1' }],
      s7: [v('s7'), { lineHeight: v('lh-display'), letterSpacing: v('tr-display') }],
    },
    // Each step arrives with its tracking and leading already paired, above —
    // these are for the cases the pairing does not cover (the wordmark).
    letterSpacing: {
      micro:   v('tr-micro'),
      title:   v('tr-title'),
      display: v('tr-display'),
      mark:    v('tr-mark'),
      none:    '0',
    },
    lineHeight: {
      display: v('lh-display'),
      body:    v('lh-body'),
      note:    v('lh-note'),
    },
    fontWeight: {
      display: v('w-display'),
      lede:    v('w-lede'),
      body:    v('w-body'),
      figure:  v('w-figure'),
      emph:    v('w-emph'),
      mark:    v('w-mark'),
    },

    // ── SPACE ────────────────────────────────────────────────────────────
    // Multiples of --u, named by the multiple. `p-4` is four units, which is
    // 16px at a 16px root — the number in the class is the multiple, and that
    // is what keeps the call site legible.
    spacing: {
      0:   '0',
      px:  '1px',                       // hairline compensation only
      0.5: `calc(${v('u')} * .5)`,      // THE FLOOR. a quarter-unit is a finding
      1:   `calc(${v('u')} * 1)`,
      2:   `calc(${v('u')} * 2)`,
      3:   `calc(${v('u')} * 3)`,
      4:   `calc(${v('u')} * 4)`,
      5:   `calc(${v('u')} * 5)`,
      6:   `calc(${v('u')} * 6)`,
      8:   `calc(${v('u')} * 8)`,
      10:  `calc(${v('u')} * 10)`,
      12:  `calc(${v('u')} * 12)`,
      16:  `calc(${v('u')} * 16)`,
      24:  `calc(${v('u')} * 24)`,
      gutter: v('gutter'),
    },

    // ── SIZE ─────────────────────────────────────────────────────────────
    minHeight: {
      0: '0',
      target: v('target-min'),   // 2.5.8 floor — the default for a new control
      control: v('target'),      // what the system's controls are
      touch: '2.75rem',          // the phone tab bar only
      full: '100%',
      dvh: '100dvh',             // never 100vh: a retracting toolbar makes vh lie
    },
    minWidth: {
      0: '0',
      target: v('target-min'),
      col: v('col-min'),
    },
    maxWidth: {
      none: 'none',
      full: '100%',
      measure: v('measure'),            // a PAGE
      text: v('measure-text'),          // a LINE — 80ch
      lede: v('measure-lede'),          // 64ch
      act:  v('measure-act'),           // 56ch
      form: `calc(${v('u')} * 102)`,    // the entry-tier form column. NOT measure
    },

    // ── BORDER ───────────────────────────────────────────────────────────
    // 🛑 R2: radius is 0 everywhere except the connection light and the
    // revertable badge corner. `rounded-*` is therefore not available, which
    // is intentional — it is cheaper to have no class than to have one nobody
    // may use.
    borderRadius: {
      none: '0',
      badge: v('badge-radius'),
      dot: '50%',                 // the connection light. the only other radius
    },
    borderWidth: {
      0: '0',
      DEFAULT: '1px',             // the only edge weight the system has
      emph: '2px',                // EMPHASIS: the 1px edge DOUBLED, in full ink
    },

    // ── MOTION ───────────────────────────────────────────────────────────
    transitionTimingFunction: {
      spring: v('spring'),
      linear: 'linear',
    },
    transitionDuration: {
      spring: v('t-spring'),   // anything that MOVES, on the way in
      fade:   v('t-fade'),     // opacity and colour. not a move
    },
    // The three ambient animations are not exposed as utilities. They belong to
    // three specific components (.lit--running, .conn, .agent), all declared in
    // tokens.css, and a fifth animation is a finding — an `animate-sweep`
    // utility is an invitation to mint one.
    animation: {},
    keyframes: {},

    // ── LAYER ────────────────────────────────────────────────────────────
    zIndex: {
      0: '0',
      popover: v('z-popover'),
      overlay: v('z-overlay'),
      modal:   v('z-modal'),
      skip:    v('z-skip'),
    },

    // ── TIERS ────────────────────────────────────────────────────────────
    // ⚠️ THESE ARE THE ONLY PLACE THE BREAKPOINT NUMBERS MAY BE WRITTEN
    // OUTSIDE tokens.css, and they are written as literals because a custom
    // property cannot be read inside @media — Tailwind emits a media query, so
    // var(--bp-narrow) here would silently produce a rule that never matches.
    // If you change one, change it in tokens.css FIRST; that file is the
    // authority and this is a copy that has to be kept honest by hand.
    // 320px is the floor and is a 1.4.10 Reflow requirement, so there is no
    // breakpoint below `mid` — narrow is the unprefixed base.
    screens: {
      mid:   '720px',
      wide:  '1080px',
      ultra: '1440px',
    },

    extend: {
      backgroundImage: {
        // The only two gradients in the system.
        badge: v('badge-gradient'),
        'badge-glyph': v('badge-gradient-glyph'),
      },
      boxShadow: {
        // Not a shadow — a hairline under a panel. There is no elevation scale.
        sheet: v('sheet-shadow'),
        // The component edge, as a shadow, for the cases that cannot take a
        // border without changing their box. 🛑 It cannot erase the focus ring:
        // the ring is an outline, and the two are different properties.
        edge: `inset 0 0 0 1px ${v('rule-strong')}`,
      },
      outlineWidth: { ring: '2px' },
      outlineOffset: { ring: '2px' },
    },
  },

  plugins: [],
};
