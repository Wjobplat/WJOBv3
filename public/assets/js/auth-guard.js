// Auth guard — protège les pages internes, redirige vers /login si non connecté
(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = '/login';
  } catch (e) {
    window.location.href = '/login';
  }
})();
