// design.js — bascule « nouveau design » / « classique » (chargé dans <head>, avant le rendu)
(function () {
    var KEY = 'wjob-design';
    var mode;
    try { mode = localStorage.getItem(KEY) || 'v2'; } catch (e) { mode = 'v2'; }

    window.wjobDesign = mode;
    window.wjobSetDesign = function (m) {
        try { localStorage.setItem(KEY, m); } catch (e) { }
        location.reload();
    };
    if (mode !== 'v2') return;

    var root = document.documentElement;
    root.classList.add('v2');
    // document.write depuis un script synchrone du <head> : feuille bloquante, pas de flash de l'ancien design
    document.write('<link rel="stylesheet" href="/assets/css/v2.css?v=3">');

    var TITLES = ['Product Designer', 'Data Analyst', 'Chef de projet', 'Développeur React', 'Ingénieur méca', 'UX Writer', 'Business Developer', 'Comptable', 'DevOps', 'Chargé·e RH', 'Account Manager', 'Juriste', 'Community Manager', 'Data Scientist', 'Product Owner', 'Commercial B2B', 'Architecte cloud', 'Designer UI'];
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.addEventListener('DOMContentLoaded', function () {
        // Mur d'intitulés révélé par le curseur
        var n = Math.ceil(innerWidth * innerHeight / 900), html = '';
        for (var i = 0; i < n; i++) html += '<span>' + TITLES[(i * 7 + (i >> 3)) % TITLES.length] + '</span> ';
        var wall = document.createElement('div'), lit = document.createElement('div'), grain = document.createElement('div');
        wall.className = 'v2-wall'; lit.className = 'v2-wall lit'; grain.className = 'v2-grain';
        [wall, lit, grain].forEach(function (el) { el.setAttribute('aria-hidden', 'true'); });
        wall.innerHTML = lit.innerHTML = html;
        document.body.prepend(wall, lit);
        document.body.appendChild(grain);

        addEventListener('pointermove', function (e) {
            lit.style.setProperty('--cx', e.clientX + 'px');
            lit.style.setProperty('--cy', e.clientY + 'px');
            var card = e.target.closest && e.target.closest('.kpi-card, .stat-pill, .job-card, .app-card, .recruiter-card, .section-card, .glass-card, .stat-card');
            if (card) {
                var r = card.getBoundingClientRect();
                card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
                card.style.setProperty('--my', (e.clientY - r.top) + 'px');
            }
        }, { passive: true });

        // Entrée échelonnée des blocs principaux
        if (!reduce) {
            var blocks = document.querySelectorAll('.page > *, main > *, .container > *');
            // seulement les blocs sans animation propre (sinon on écraserait un fade-in qui part d'opacity 0)
            Array.prototype.filter.call(blocks, function (el) { return getComputedStyle(el).animationName === 'none'; }).slice(0, 14).forEach(function (el, k) {
                el.classList.add('v2-in');
                el.style.animationDelay = (k * 60) + 'ms';
            });
        }
    });
})();
