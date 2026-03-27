// Auth guard — synchrone, lit directement localStorage (Supabase v2)
// Zéro async, zéro race condition possible
(function () {
  var KEY = 'sb-bqobpkwkwypiuhtprjva-auth-token';
  var raw = localStorage.getItem(KEY);
  if (!raw) { window.location.replace('/login'); return; }
  try {
    var s = JSON.parse(raw);
    if (!s || !s.access_token) { window.location.replace('/login'); }
  } catch (e) {
    window.location.replace('/login');
  }
})();
