// Runs before paint: apply the saved sidebar state.
try { if (localStorage.getItem('sidebar') === 'collapsed') document.documentElement.classList.add('nav-collapsed'); } catch (e) {}
