// Auth guard — protège les pages internes, utilise window.wjob
(async () => {
  try {
    const { data: { session } } = await window.wjob.auth.getSession();
    if (!session) {
      console.warn('[W-JOB] Pas de session → login');
      window.location.href = '/login';
    }
  } catch (e) {
    console.error('[W-JOB] Auth guard error:', e);
    window.location.href = '/login';
  }
})();
