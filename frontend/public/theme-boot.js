/* RV-13 (G3392) — first-paint theme. A copy of frontend/src/theme.ts's
   resolve(): the stored preference ('reconcile.theme'), else the OS. Every
   access is wrapped; blocked storage degrades to the OS setting. Served
   unhashed from frontend/public/ so index.html can name it before the bundle.
   tests/app/theme.test.ts fails if this drifts from the module. */
try{var p=null;try{p=localStorage.getItem('reconcile.theme')}catch(e){}if(p!=='light'&&p!=='dark')p=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',p)}catch(e){}
