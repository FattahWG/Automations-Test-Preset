// Sidebar shell: a drawer on phones, an icon rail on desktop when collapsed.
(() => {
  const root = document.documentElement;
  const menuBtn = document.querySelector('.menu-btn');
  const sidebar = document.getElementById('sidebar');
  const scrim = document.querySelector('.scrim');
  if (menuBtn && sidebar) {
    const setOpen = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      sidebar.classList.toggle('open', open);
      if (scrim) scrim.hidden = !open;
    };
    menuBtn.addEventListener('click', () => setOpen(menuBtn.getAttribute('aria-expanded') !== 'true'));
    if (scrim) scrim.addEventListener('click', () => setOpen(false));
    sidebar.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) { setOpen(false); menuBtn.focus(); }
    });
    matchMedia('(min-width: 761px)').addEventListener('change', (e) => e.matches && setOpen(false));
  }
  const collapseBtn = document.querySelector('.collapse-btn');
  if (collapseBtn) {
    const sync = () => collapseBtn.setAttribute('aria-pressed', String(root.classList.contains('nav-collapsed')));
    sync();
    collapseBtn.addEventListener('click', () => {
      root.classList.toggle('nav-collapsed');
      try { localStorage.setItem('sidebar', root.classList.contains('nav-collapsed') ? 'collapsed' : 'open'); } catch (e) { /* storage blocked */ }
      sync();
    });
  }
})();
