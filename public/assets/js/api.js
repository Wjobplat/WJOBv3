// JobFlow API Module - Supabase Version

var API = {
    // Auth
    login: async function (email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        localStorage.setItem('wjob_token', data.session.access_token);
        return data.user;
    },

    signup: async function (email, password, name) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name, role: 'user' }
            }
        });
        if (error) throw error;
        return data;
    },

    logout: async function () {
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.error('Sign out error:', e);
        }
        localStorage.removeItem('wjob_token');
        window.location.href = 'login.html';
    },

    getMe: async function () {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            localStorage.removeItem('wjob_token');
            window.location.href = 'login.html';
            throw new Error('Unauthorized');
        }
        return {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email.split('@')[0],
            firstName: user.user_metadata?.firstName || '',
            lastName: user.user_metadata?.lastName || '',
            role: user.user_metadata?.role || 'user'
        };
    },

    updateProfile: async function (data) {
        const updates = {};
        if (data.email) {
            updates.email = data.email;
        }
        const meta = {};
        if (data.firstName !== undefined) meta.firstName = data.firstName;
        if (data.lastName !== undefined) meta.lastName = data.lastName;
        if (data.firstName !== undefined || data.lastName !== undefined) {
            meta.name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
        }
        if (Object.keys(meta).length > 0) updates.data = meta;

        const { error } = await supabase.auth.updateUser(updates);
        if (error) throw error;
        return { success: true };
    },

    isAdmin: async function () {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        if (localStorage.getItem('wjob_admin_override') === 'true') return true;
        return user.user_metadata?.role === 'admin';
    },

    promoteMe: function () {
        localStorage.setItem('wjob_admin_override', 'true');
        showToast('Promotion Admin activée ! Redémarrage...', 'success');
        setTimeout(() => location.reload(), 1000);
    },

    // Jobs
    getJobs: async function () {
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .order('posted_date', { ascending: false });

        if (error) {
            console.error('Supabase getJobs error:', error);
            throw error;
        }
        return (data || []).map(job => ({
            id: job.id,
            company: job.company,
            title: job.title,
            location: job.location,
            contractType: job.contract_type,
            salary: job.salary,
            source: job.source,
            compatibility: job.compatibility,
            description: job.description,
            skills: job.skills || [],
            postedDate: job.posted_date,
            remote: job.remote
        }));
    },

    deleteJob: async function (id) {
        const { error } = await supabase.from('jobs').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
    },

    // Applications
    getApplications: async function () {
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                job:jobs (
                    company,
                    title,
                    location,
                    compatibility
                )
            `);

        if (error) throw error;

        return data.map(app => {
            const jobData = Array.isArray(app.job) ? app.job[0] : app.job;
            return {
                id: app.id,
                jobId: app.job_id,
                status: app.status,
                createdDate: app.created_date,
                sentDate: app.sent_date,
                responseDate: app.response_date,
                coverLetter: app.cover_letter,
                customEmail: app.custom_email,
                notes: app.notes,
                cv_path: app.cv_path,
                job: {
                    id: app.job_id,
                    company: jobData?.company,
                    title: jobData?.title,
                    location: jobData?.location,
                    compatibility: jobData?.compatibility
                }
            };
        });
    },

    createApplication: async function (data) {
        const { jobId, status, customEmail, notes } = data;
        const user = (await supabase.auth.getUser()).data.user;

        const { data: result, error } = await supabase
            .from('applications')
            .insert({
                job_id: jobId,
                user_id: user.id,
                status: status || 'draft',
                custom_email: customEmail,
                notes: notes,
                created_date: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, id: result.id };
    },

    updateApplicationStatus: async function (id, status) {
        const updates = { status };
        if (status === 'sent') updates.sent_date = new Date().toISOString();
        if (status === 'responded') updates.response_date = new Date().toISOString();

        const { error } = await supabase
            .from('applications')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    },

    updateApplication: async function (id, data) {
        const updates = {};
        if (data.coverLetter !== undefined) updates.cover_letter = data.coverLetter;
        if (data.customEmail !== undefined) updates.custom_email = data.customEmail;
        if (data.notes !== undefined) updates.notes = data.notes;

        const { error } = await supabase
            .from('applications')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    },

    uploadCV: async function (id, formData) {
        const file = formData.get('cv');
        if (!file) throw new Error('File missing');

        const fileName = `cv-${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
            .from('cvs')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
            .from('applications')
            .update({ cv_path: fileName })
            .eq('id', id);

        if (dbError) throw dbError;

        return { success: true, filename: fileName };
    },

    // Recruiters
    getRecruiters: async function () {
        const { data, error } = await supabase.from('recruiters').select('*');
        if (error) throw error;
        return data;
    },

    // Dashboard
    getStats: async function () {
        const [jobsRes, appsRes, recruitersRes] = await Promise.all([
            supabase.from('jobs').select('company', { count: 'exact' }),
            supabase.from('applications').select('status', { count: 'exact' }),
            supabase.from('recruiters').select('*', { count: 'exact', head: true })
        ]);

        const jobs = jobsRes.data || [];
        const apps = appsRes.data || [];
        const uniqueCompanies = new Set(jobs.map(j => j.company)).size;

        return {
            totalJobs: jobsRes.count || 0,
            totalApplications: appsRes.count || 0,
            totalCompanies: uniqueCompanies,
            totalRecruiters: recruitersRes.count || 0,
            draftCount: apps.filter(a => a.status === 'draft').length,
            pendingCount: apps.filter(a => a.status === 'pending').length,
            sentCount: apps.filter(a => a.status === 'sent').length,
            respondedCount: apps.filter(a => a.status === 'responded').length
        };
    },

    getActivity: async function () {
        const { data, error } = await supabase
            .from('agent_actions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error && error.code !== 'PGRST116') {
            console.error('Activity load error:', error);
            return [];
        }

        return (data || []).map(a => ({
            id: a.id,
            date: a.created_at?.split('T')[0],
            time: a.created_at ? new Date(a.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
            type: a.event,
            title: a.event?.replace(/\./g, ' ').replace(/^\w/, c => c.toUpperCase()),
            description: a.result?.message || a.status || ''
        }));
    },

    // Agent
    getAgentStatus: async function () {
        const { data, error } = await supabase
            .from('agent_actions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        const { count } = await supabase
            .from('agent_actions')
            .select('*', { count: 'exact', head: true });

        const lastActivity = data ? new Date(data.created_at) : null;
        const isConnected = lastActivity && (Date.now() - lastActivity.getTime() < 86400000);

        return {
            connected: !!isConnected,
            lastActivity: data?.created_at || null,
            totalActions: count || 0
        };
    },

    getAgentActions: async function () {
        const { data, error } = await supabase
            .from('agent_actions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;
        return data.map(action => ({
            id: action.id,
            event: action.event,
            status: action.status,
            result: action.result,
            timestamp: action.created_at
        }));
    },

    triggerAgent: async function (action) {
        const config = await this.getWebhookConfig();
        if (!config.enabled || !config.outgoingUrl) {
            throw new Error('Webhook non configuré ou désactivé');
        }

        const { data: { user } } = await supabase.auth.getUser();

        await supabase.from('agent_actions').insert({
            event: `manual.${action}`,
            user_id: user.id,
            status: 'pending',
            result: { message: `Déclenchement manuel de ${action}` }
        });

        try {
            const response = await fetch(config.outgoingUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: action,
                    user_id: user.id,
                    user_email: user.email,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return { success: true, result: { message: "Action transmise à l'agent" } };
        } catch (e) {
            console.error('Webhook trigger fail:', e);
            throw new Error('Erreur de communication avec l\'agent');
        }
    },

    generateAiEmail: async function (data) {
        try {
            const config = await this.getWebhookConfig();
            if (config.enabled && config.outgoingUrl) {
                const { data: { user } } = await supabase.auth.getUser();
                const payload = {
                    event: 'email.generate',
                    data: {
                        user_id: user?.id,
                        job_title: data.job?.title,
                        company: data.job?.company,
                        recruiter_name: data.job?.recruiter?.name,
                        recruiter_email: data.job?.recruiter?.email,
                        job_description: data.job?.description
                    }
                };
                const headers = { 'Content-Type': 'application/json' };
                if (config.secret) headers['X-Webhook-Secret'] = config.secret;

                const response = await fetch(config.outgoingUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.email) return { email: result.email };
                }
            }
        } catch (e) {
            console.warn('[W-JOB] Webhook email generation failed, using template:', e.message);
        }

        // Fallback: local template
        const { data: { user } } = await supabase.auth.getUser();
        const profile = user?.user_metadata || {};
        const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Candidat';
        const job = data.job || {};

        return {
            email: `Objet : Candidature au poste de ${job.title || 'Poste'} — ${job.company || 'Entreprise'}\n\nBonjour ${job.recruiter?.name || 'Madame, Monsieur'},\n\nJe me permets de vous contacter concernant le poste de ${job.title || 'développeur'} au sein de ${job.company || 'votre entreprise'}.\n\nAprès avoir pris connaissance de la description du poste, je suis convaincu(e) que mon profil correspond à vos attentes. Mon expérience et mes compétences me permettraient de contribuer efficacement à votre équipe.\n\nJe serais ravi(e) d'échanger avec vous lors d'un entretien pour vous présenter mon parcours plus en détail.\n\nCordialement,\n${name}`
        };
    },

    // ============================================================
    // analyzeCV — VERSION CORRIGÉE : lit la réponse de l'agent IA
    // ============================================================
    analyzeCV: async function (formData) {
        const file = formData.get('cv');
        if (!file) throw new Error('Aucun fichier CV fourni');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Utilisateur non connecté');

        // 1. Upload CV to Supabase Storage
        const fileName = `cv-${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
            .from('cvs')
            .upload(`${user.id}/${fileName}`, file, { upsert: true });

        let cvUrl = null;
        if (!uploadError) {
            const { data: signedData } = await supabase.storage
                .from('cvs')
                .createSignedUrl(`${user.id}/${fileName}`, 3600);
            cvUrl = signedData?.signedUrl || null;
        } else {
            console.warn('CV upload to storage failed, continuing without URL:', uploadError.message);
        }

        // 2. Send to AI Agent webhook and READ the response
        let webhookSent = false;
        try {
            const config = await this.getWebhookConfig();
            if (config.enabled && config.outgoingUrl) {
                const payload = {
                    event: 'cv.uploaded',
                    data: {
                        user_id: user.id,
                        file_name: file.name,
                        file_size: file.size,
                        cv_url: cvUrl,
                        timestamp: new Date().toISOString()
                    }
                };

                const headers = { 'Content-Type': 'application/json' };
                if (config.secret) headers['X-Webhook-Secret'] = config.secret;

                const response = await fetch(config.outgoingUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });

                console.log(`[W-JOB] Webhook cv.uploaded → status: ${response.status}`);

                // ✅ FIX: Read the agent's response and return real data
                if (response.ok) {
                    const agentResult = await response.json();
                    console.log('[W-JOB] Agent response:', agentResult);

                    return {
                        success: true,
                        analysis: agentResult.profile?.summary || agentResult.analysis || agentResult.message || "CV analysé avec succès par l'agent IA.",
                        recommendations: agentResult.profile?.skills || [],
                        jobs_found: agentResult.jobs_found || 0,
                        profile: agentResult.profile || {},
                        webhookSent: true,
                        cvUrl
                    };
                }
            } else {
                console.log('[W-JOB] Webhook sortant non configuré ou désactivé.');
            }
        } catch (webhookErr) {
            console.error('[W-JOB] Erreur envoi webhook:', webhookErr.message);
        }

        // Fallback if webhook fails or not configured
        return {
            success: true,
            analysis: webhookSent
                ? "CV envoyé à l'agent IA pour analyse. Vous recevrez les résultats prochainement."
                : "CV uploadé avec succès. Configurez le webhook sortant dans les Paramètres pour activer l'analyse par l'agent IA.",
            recommendations: [],
            webhookSent,
            cvUrl
        };
    },

    getWebhookConfig: async function () {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return this._defaultWebhookConfig();

            const { data, error } = await supabase
                .from('webhook_config')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && !['PGRST116', '42P01', '42501'].includes(error.code)) {
                console.warn('Webhook config error:', error);
            }

            if (!data) return this._defaultWebhookConfig();

            return {
                id: data.id,
                outgoingUrl: data.outgoing_url,
                secret: data.secret,
                enabled: data.enabled,
                events: data.events || {}
            };
        } catch (e) {
            console.warn('getWebhookConfig fallback:', e.message);
            return this._defaultWebhookConfig();
        }
    },

    _defaultWebhookConfig: function () {
        return {
            id: null,
            outgoingUrl: window.location.origin + '/api/trigger',
            secret: 'wjob_sec_' + Math.random().toString(36).substr(2, 9),
            enabled: false,
            events: {
                'job.created': true,
                'recruiter.found': true,
                'application.generated': false,
                'application.status_changed': true
            }
        };
    },

    saveWebhookConfig: async function (config) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const payload = {
            user_id: user.id,
            outgoing_url: config.outgoingUrl,
            enabled: config.enabled,
            events: config.events,
            secret: config.secret
        };

        const { error } = await supabase
            .from('webhook_config')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) throw error;
        return { success: true };
    },

    testWebhook: async function () {
        const config = await this.getWebhookConfig();
        if (!config.enabled || !config.outgoingUrl) {
            return { success: false, message: 'Webhook non configuré ou désactivé' };
        }

        const { data: { user } } = await supabase.auth.getUser();
        const payload = {
            event: 'test.ping',
            data: {
                user_id: user?.id,
                message: 'Test de connexion W-JOB',
                timestamp: new Date().toISOString()
            }
        };

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (config.secret) headers['X-Webhook-Secret'] = config.secret;

            const response = await fetch(config.outgoingUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10000)
            });

            await supabase.from('agent_actions').insert({
                user_id: user?.id,
                event: 'test',
                status: response.ok ? 'success' : 'error',
                result: { message: `Test webhook — HTTP ${response.status}` }
            });

            return {
                success: response.ok,
                message: response.ok ? `Webhook actif (HTTP ${response.status})` : `Erreur HTTP ${response.status}`
            };
        } catch (e) {
            return { success: false, message: `Erreur: ${e.message}` };
        }
    },

    getWebhookLogs: async function () {
        const { data, error } = await supabase
            .from('agent_actions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        return data.map(log => ({
            id: log.id,
            status: log.status,
            direction: log.event.startsWith('manual.') ? 'outgoing' : 'incoming',
            event: log.event,
            details: log.result?.message || log.result?.action || '',
            timestamp: log.created_at
        }));
    },

    getConsent: async function () {
        const stored = localStorage.getItem('wjob_consent');
        return stored ? JSON.parse(stored) : {
            dataProcessing: true,
            analytics: false,
            webhookSharing: false
        };
    },

    saveConsent: async function (consent) {
        localStorage.setItem('wjob_consent', JSON.stringify(consent));
        return { success: true };
    },

    exportData: async function () {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Non connecté');

        const [appsRes, jobsRes, recruitersRes, actionsRes, configRes] = await Promise.all([
            supabase.from('applications').select('*').eq('user_id', user.id),
            supabase.from('jobs').select('*'),
            supabase.from('recruiters').select('*'),
            supabase.from('agent_actions').select('*').eq('user_id', user.id),
            supabase.from('webhook_config').select('*').eq('user_id', user.id)
        ]);

        const exportPayload = {
            exportDate: new Date().toISOString(),
            user: { id: user.id, email: user.email, metadata: user.user_metadata },
            applications: appsRes.data || [],
            jobs: jobsRes.data || [],
            recruiters: recruitersRes.data || [],
            agentActions: actionsRes.data || [],
            webhookConfig: configRes.data || [],
            consent: JSON.parse(localStorage.getItem('wjob_consent') || '{}')
        };

        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wjob-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    deleteData: async function () {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Non connecté');

        await Promise.all([
            supabase.from('applications').delete().eq('user_id', user.id),
            supabase.from('agent_actions').delete().eq('user_id', user.id),
            supabase.from('webhook_config').delete().eq('user_id', user.id)
        ]);

        localStorage.clear();
        await supabase.auth.signOut();

        return { success: true, message: "Toutes vos données ont été supprimées de la plateforme." };
    }
};

// Helper functions
function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(dateString, timeString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${timeString || ''}`;
}

function formatRelativeTime(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {
        success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
        info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
        warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
    };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Auto-admin via URL parameter
(function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1') {
        localStorage.setItem('wjob_admin_override', 'true');
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        location.reload();
    }
})();

// Global UI Manager for Admin-only elements
document.addEventListener('DOMContentLoaded', async function () {
    try {
        const isAdmin = await API.isAdmin();
        if (isAdmin) {
            document.querySelectorAll('[data-admin-only]').forEach(el => {
                if (el.tagName === 'A' && el.classList.contains('top-nav-link')) {
                    el.style.display = 'flex';
                } else {
                    el.style.display = 'block';
                }
            });
        }
    } catch (e) {
        console.error('Global admin check failed:', e);
    }
});
