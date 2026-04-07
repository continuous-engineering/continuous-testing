// ── Active project (persisted) ────────────────────────────
window._activeProject = localStorage.getItem('activeProject') || 'default';

const API = {
    baseURL: '/api',

    _h(extra, proj) {
        return { 'X-Project': proj || window._activeProject, ...extra };
    },

    async get(path, proj) {
        return fetch(`${this.baseURL}${path}`, { headers: this._h({}, proj) }).then(r => r.json());
    },

    async post(path, data, proj) {
        return fetch(`${this.baseURL}${path}`, {
            method: 'POST',
            headers: this._h({ 'Content-Type': 'application/json' }, proj),
            body: JSON.stringify(data)
        }).then(r => r.json());
    },

    async put(path, data, proj) {
        return fetch(`${this.baseURL}${path}`, {
            method: 'PUT',
            headers: this._h({ 'Content-Type': 'application/json' }, proj),
            body: JSON.stringify(data)
        }).then(r => r.json());
    },

    async delete(path, proj) {
        return fetch(`${this.baseURL}${path}`, {
            method: 'DELETE',
            headers: this._h({}, proj)
        }).then(r => r.json());
    }
};

// ── Notifications ─────────────────────────────────────────
function toast(msg, type='info') {
    const container = document.getElementById('toast');
    const el = document.createElement('div');
    const colors = { info: '#3498db', success: '#27ae60', error: '#e74c3c', warn: '#e67e22' };
    el.style = `background:${colors[type]||colors.info};color:#fff;padding:10px 18px;border-radius:7px;font-size:14px;box-shadow:0 3px 12px rgba(0,0,0,0.18);pointer-events:auto;max-width:340px;line-height:1.4;opacity:1;transition:opacity 0.4s;`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 420); }, 3200);
}

function uiConfirm(msg, okLabel='Delete', okStyle='danger') {
    return new Promise(resolve => {
        const overlay = document.getElementById('confirm-overlay');
        document.getElementById('confirm-msg').textContent = msg;
        const okBtn = document.getElementById('confirm-ok-btn');
        okBtn.textContent = okLabel;
        okBtn.className = `btn ${okStyle}`;
        overlay.style.display = 'flex';
        const close = (result) => {
            overlay.style.display = 'none';
            okBtn.replaceWith(okBtn.cloneNode(true));
            document.getElementById('confirm-cancel-btn').replaceWith(document.getElementById('confirm-cancel-btn').cloneNode(true));
            resolve(result);
        };
        document.getElementById('confirm-ok-btn').onclick = () => close(true);
        document.getElementById('confirm-cancel-btn').onclick = () => close(false);
    });
}

// Navigation
function switchPage(page, sourceEvent) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const e = sourceEvent || event;
    if (e && e.target) {
        const navItem = e.target.closest('.nav-item');
        if (navItem) navItem.classList.add('active');
    }

    document.getElementById('page-title').textContent = {
        dashboard: 'Dashboard',
        agents: 'Agents',
        'test-cases': 'Test Cases',
        'test-plans': 'Test Plans',
        'test-runs': 'Test Runs',
        results: 'Results',
        environments: 'Environments',
        tags: 'Tags',
        reports: 'Reports',
        logs: 'Logs',
        git: 'Git Commit'
    }[page] || page;

    if (page === 'dashboard') loadDashboard();
    else if (page === 'agents') loadAgentsPage();
    else if (page === 'test-cases') loadTestCasesPage();
    else if (page === 'test-plans') loadTestPlansPage();
    else if (page === 'test-runs') loadTestRunsPage();
    else if (page === 'results') loadResultsPage();
    else if (page === 'environments') loadEnvironmentsPage();
    else if (page === 'tags') loadTagsPage();
    else if (page === 'reports') loadReportsPage();
    else if (page === 'logs') loadLogsPage();
    else if (page === 'git') { loadGitStatus(); loadGitInfo(); }
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// ── Full-screen overlay helpers ───────────────────────────
function _openOverlay(id)  { const el = document.getElementById(id); if (el) { el.style.display = 'flex'; el.scrollTop = 0; } }
function _closeOverlay(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

function openAgentEditor()   { _openOverlay('agent-overlay'); }
function closeAgentEditor()  { _closeOverlay('agent-overlay'); }
function openTagEditor()     { _openOverlay('tag-overlay'); }
function closeTagEditor()    { _closeOverlay('tag-overlay'); }
function openTestRunEditor() { _openOverlay('run-overlay'); }
function closeTestRunEditor(){ _closeOverlay('run-overlay'); }
function openProjectEditor() { document.getElementById('new-project-name').value = ''; _openOverlay('project-overlay'); }
function closeProjectEditor(){ _closeOverlay('project-overlay'); }

function highlightProjectSelector() {
    const sel = document.getElementById('project-select');
    if (sel) {
        sel.focus();
        sel.style.outline = '3px solid #3498db';
        setTimeout(() => { sel.style.outline = ''; }, 1800);
    }
}

function switchToSuite(suite) {
    switchPage('test-cases');
    setTimeout(() => {
        const el = document.getElementById('tests-suite-filter');
        if (el) { el.value = suite; loadTestCasesPage(); }
    }, 50);
}

// Load functions
async function loadDashboard() {
    try {
        const data = await API.get('/dashboard');
        document.getElementById('stat-workspaces').textContent = data.workspaces || 0;
        document.getElementById('stat-agents').textContent = data.agents || 0;
        document.getElementById('stat-tests').textContent = data.total_tests || 0;
        document.getElementById('stat-test-runs').textContent = data.recent_test_runs || 0;
        document.getElementById('stat-functional').textContent = data.functional_tests || 0;
        document.getElementById('stat-security').textContent = data.security_tests || 0;
        document.getElementById('stat-passed').textContent = data.total_passed || 0;
        document.getElementById('stat-failed').textContent = data.total_failed || 0;
        document.getElementById('stat-passrate').textContent = ((data.avg_pass_rate || 0) * 100).toFixed(1) + '%';

        const runs = await API.get('/test-runs?limit=5');
        const tbody = document.getElementById('dashboard-runs');
        tbody.innerHTML = '';
        runs.forEach(run => {
            const row = document.createElement('tr');
            const status = run.status || 'pending';
            row.innerHTML = `
                <td>${run.agent_id}</td>
                <td>${run.suite_type}</td>
                <td><span class="badge badge-${status}">${status}</span></td>
                <td>${run.summary?.passed || 0}/${run.summary?.total || 0}</td>
                <td>${run.duration_seconds || 0}s</td>
                <td>${new Date(run.started_at).toLocaleString()}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (e) {
        console.error(e);
    }
}

async function loadAgentsPage() {
    try {
        const agents = await API.get('/agents');
        window._agentsCache = agents;
        const tbody = document.getElementById('agents-list');
        tbody.innerHTML = '';

        agents.forEach(agent => {
            const row = document.createElement('tr');
            const testCount = (agent.suites?.functional?.test_count || 0) +
                             (agent.suites?.security?.test_count || 0);
            row.innerHTML = `
                <td>${agent.name}</td>
                <td><code style="background:#f0f0f0;padding:4px 8px;border-radius:4px;">${agent.endpoint || '—'}</code></td>
                <td>${agent.model_version || '—'}</td>
                <td>${testCount}</td>
                <td><span class="badge badge-pass">${agent.status}</span></td>
                <td>
                    <button class="btn small" onclick="editAgent('${agent.agent_id}')">Edit</button>
                    <button class="btn small danger" onclick="deleteAgent('${agent.agent_id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (e) {
        console.error(e);
    }
}

// ── Test Cases page ───────────────────────────────────────
let _testsDebounce = null;
function debounceLoadTestCases() {
    clearTimeout(_testsDebounce);
    _testsDebounce = setTimeout(loadTestCasesPage, 280);
}

const _srcColors = { global: '#8e44ad', workspace: '#2980b9', agent: '#27ae60' };

function renderTestsTable(tests) {
    const tbody = document.getElementById('tests-list');
    tbody.innerHTML = '';

    if (!tests.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="color:#888;text-align:center;padding:20px;">No tests found — adjust filters or click "+ Add Test"</td></tr>';
        return;
    }

    const inGlobal = window._activeProject === '_global';

    tests.forEach(test => {
        const row = document.createElement('tr');
        const tags = (test.tags || []).map(t => `<span class="tag">${escHtml(t)}</span>`).join(' ');
        const src = test._source || 'global';
        const srcBadge = `<span style="background:${_srcColors[src]||'#888'};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${src}</span>`;
        const agentHint = test._agent_name ? ` <small style="color:#888;">${test._agent_name}</small>` : '';

        const isGlobalReadOnly = src === 'global' && !inGlobal;
        const actions = isGlobalReadOnly
            ? `<span style="font-size:11px;color:#aaa;font-style:italic;">view only — edit in Global project</span>`
            : `<button class="btn small" onclick="editTest('${escHtml(test.test_id)}')">Edit</button>
               <button class="btn small danger" onclick="deleteTest('${escHtml(test.test_id)}')">Delete</button>`;

        row.innerHTML = `
            <td style="font-family:monospace;font-size:12px;">${escHtml(test.test_id)}</td>
            <td>${escHtml(test.test_name || '')}</td>
            <td>${srcBadge}${agentHint}</td>
            <td><span class="badge badge-pending" style="font-size:11px;">${test.suite_type || ''}</span></td>
            <td>${escHtml(test.category || '-')}</td>
            <td>${test.priority || 'medium'}</td>
            <td>${tags}</td>
            <td style="white-space:nowrap;">${actions}</td>
        `;
        tbody.appendChild(row);
    });
}

async function loadTestCasesPage() {
    const scope    = document.getElementById('tests-scope-filter')?.value    || '';
    const suite    = document.getElementById('tests-suite-filter')?.value    || '';
    const category = document.getElementById('tests-category-filter')?.value || '';
    const tag      = document.getElementById('tests-tag-input')?.value.trim() || '';

    let url = '/test-cases?';
    if (scope)    url += `scope=${encodeURIComponent(scope)}&`;
    if (suite)    url += `suite_type=${encodeURIComponent(suite)}&`;
    if (tag)      url += `tag=${encodeURIComponent(tag)}&`;
    // category is applied client-side (populated dynamically)

    try {
        let tests = await API.get(url);
        if (category) tests = tests.filter(t => t.category === category);

        // Rebuild category dropdown from current result set
        const catSel = document.getElementById('tests-category-filter');
        const prevCat = catSel.value;
        const cats = [...new Set(tests.map(t => t.category).filter(Boolean))].sort();
        catSel.innerHTML = '<option value="">All Categories</option>';
        cats.forEach(c => {
            const o = document.createElement('option');
            o.value = c; o.textContent = c;
            catSel.appendChild(o);
        });
        catSel.value = prevCat;

        renderTestsTable(tests);
    } catch (e) {
        console.error(e);
    }
}

async function loadTestRunsPage() {
    // Populate agent filter
    const agentSel = document.getElementById('test-runs-agent-select');
    const prevAgent = agentSel.value;
    agentSel.innerHTML = '<option value="">All Agents</option>';
    (window._agentsCache || []).forEach(a => {
        const o = document.createElement('option');
        o.value = a.agent_id;
        o.textContent = a.name;
        agentSel.appendChild(o);
    });
    agentSel.value = prevAgent;

    // Populate plan filter
    const planSel = document.getElementById('test-runs-plan-select');
    const prevPlan = planSel.value;
    planSel.innerHTML = '<option value="">All Plans</option>';
    (window._testPlansCache || []).forEach(c => {
        const o = document.createElement('option');
        o.value = c.config_id;
        o.textContent = c.name;
        planSel.appendChild(o);
    });
    planSel.value = prevPlan;

    try {
        const agentFilter = agentSel.value ? `&agent_id=${agentSel.value}` : '';
        let runs = await API.get(`/test-runs?limit=100${agentFilter}`);

        // Client-side plan filter
        if (planSel.value) {
            runs = runs.filter(r => r.config_id === planSel.value);
        }

        const tbody = document.getElementById('test-runs-list');
        tbody.innerHTML = '';

        if (!runs.length) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#888;padding:20px;">No runs yet — click "+ New Run" to start one</td></tr>';
            return;
        }

        runs.slice().reverse().forEach(run => {
            const row = document.createElement('tr');
            const status = run.status || 'pending';
            const passRate = run.pass_rate != null ? (run.pass_rate * 100).toFixed(1) + '%' : '-';
            const s = run.summary || {};
            const planCell = run.config_name
                ? `<span style="background:#e8f4fd;color:#1a5276;padding:2px 8px;border-radius:10px;font-size:12px;white-space:nowrap;">${run.config_name}</span>`
                : `<span style="color:#bbb;font-size:12px;">Quick</span>`;
            row.innerHTML = `
                <td>${planCell}</td>
                <td>${run.agent_name || run.agent_id}</td>
                <td>${run.suite_type}</td>
                <td><span class="badge badge-${status}">${status}</span></td>
                <td>${s.passed || 0}P / ${s.failed || 0}F / ${s.errors || 0}E</td>
                <td>${passRate}</td>
                <td>${run.duration_seconds || 0}s</td>
                <td style="font-size:12px;">${new Date(run.started_at).toLocaleString()}</td>
                <td><button class="btn small" onclick="viewTestRun('${run.run_id}')">View</button></td>
            `;
            tbody.appendChild(row);
        });
    } catch (e) {
        console.error(e);
    }
}

window._runMode = 'config';

function setTestRunMode(mode) {
    window._runMode = mode;
    document.getElementById('run-mode-config').style.display = mode === 'config' ? '' : 'none';
    document.getElementById('run-mode-quick').style.display  = mode === 'quick'  ? '' : 'none';
    document.getElementById('run-tab-config').style.background = mode === 'config' ? '#3498db' : '#ecf0f1';
    document.getElementById('run-tab-config').style.color     = mode === 'config' ? '#fff'    : '#555';
    document.getElementById('run-tab-quick').style.background  = mode === 'quick'  ? '#3498db' : '#ecf0f1';
    document.getElementById('run-tab-quick').style.color      = mode === 'quick'  ? '#fff'    : '#555';
}

function previewTestPlan(configId) {
    const preview = document.getElementById('test-plan-preview');
    if (!configId) { preview.style.display = 'none'; return; }
    const cfg = (window._testPlansCache || []).find(c => c.config_id === configId);
    if (!cfg) { preview.style.display = 'none'; return; }
    const agentNames = cfg.agent_ids.length === 0
        ? '<em>All agents</em>'
        : cfg.agent_ids.map(id => {
            const a = (window._agentsCache || []).find(a => a.agent_id === id);
            return a ? a.name : id;
        }).join(', ');
    const tags = cfg.tags.length ? cfg.tags.join(', ') : '<em>all tests</em>';
    preview.innerHTML = `
        <strong>Agents:</strong> ${agentNames}<br>
        <strong>Suites:</strong> ${cfg.suite_types.join(', ')}<br>
        <strong>Tag filter:</strong> ${tags}
    `;
    preview.style.display = '';
}

function openNewTestRunModal() {
    // Populate test plan picker
    const cfgSel = document.getElementById('test-plan-pick');
    cfgSel.innerHTML = '<option value="">Select a saved test plan...</option>';
    (window._testPlansCache || []).forEach(c => {
        const o = document.createElement('option');
        o.value = c.config_id;
        o.textContent = c.name;
        cfgSel.appendChild(o);
    });
    document.getElementById('test-plan-preview').style.display = 'none';

    // Populate agent picker (quick mode)
    const agentSel = document.getElementById('run-agent-select');
    agentSel.innerHTML = '<option value="">Select Agent...</option>';
    (window._agentsCache || []).forEach(a => {
        const o = document.createElement('option');
        o.value = a.agent_id;
        o.textContent = a.name;
        agentSel.appendChild(o);
    });

    document.getElementById('run-modal-status').textContent = '';
    document.getElementById('run-start-btn').disabled = false;

    // Default to config mode if test plans exist, else quick
    const mode = (window._testPlansCache || []).length > 0 ? 'config' : 'quick';
    setTestRunMode(mode);
    openTestRunEditor();
}

async function startTestRun() {
    const btn = document.getElementById('run-start-btn');
    const statusEl = document.getElementById('run-modal-status');
    btn.disabled = true;
    statusEl.style.color = '#888';

    let payload;
    if (window._runMode === 'config') {
        const configId = document.getElementById('test-plan-pick').value;
        if (!configId) { toast('Select a test plan', 'warn'); btn.disabled = false; return; }
        payload = { config_id: configId };
        statusEl.textContent = 'Running test plan...';
    } else {
        const agentId  = document.getElementById('run-agent-select').value;
        const suiteType = document.getElementById('run-suite-select').value;
        if (!agentId) { toast('Select an agent', 'warn'); btn.disabled = false; return; }
        payload = { agent_id: agentId, suite_type: suiteType };
        statusEl.textContent = 'Running tests...';
    }

    try {
        const res = await fetch('/api/test-runs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Project': window._activeProject },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            statusEl.textContent = data.error || 'Error starting run';
            statusEl.style.color = '#e74c3c';
            btn.disabled = false;
            return;
        }
        closeTestRunEditor();
        if (data.batch) {
            const s = data.total_summary;
            toast(`Test plan run complete: ${s.passed}/${s.total} passed across ${s.run_count} run(s)`, 'success');
        } else {
            toast(`Run complete: ${data.summary?.passed || 0}/${data.summary?.total || 0} passed`, 'success');
        }
        loadTestRunsPage();
    } catch (e) {
        statusEl.textContent = String(e);
        statusEl.style.color = '#e74c3c';
        btn.disabled = false;
    }
}

// ── Test Plans ────────────────────────────────────────────
window._testPlansCache = [];

async function loadTestPlansPage() {
    try {
        const [configs, agents] = await Promise.all([API.get('/test-plans'), API.get('/agents')]);
        window._testPlansCache = configs;
        window._agentsCache = window._agentsCache || agents;

        const tbody = document.getElementById('test-plans-list');
        tbody.innerHTML = '';

        if (!configs.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">No test plans yet — click "+ New Test Plan"</td></tr>';
            return;
        }

        configs.forEach(c => {
            const agentLabel = c.agent_ids.length === 0
                ? '<em style="color:#888;">All agents</em>'
                : c.agent_ids.map(id => {
                    const a = (window._agentsCache || []).find(a => a.agent_id === id);
                    return `<span style="background:#eaf4fb;padding:1px 7px;border-radius:10px;font-size:12px;">${a ? a.name : id}</span>`;
                }).join(' ');
            const suitesLabel = c.suite_types.map(s =>
                `<span class="badge badge-pending" style="font-size:11px;">${s}</span>`
            ).join(' ');
            const tagsLabel = c.tags.length
                ? c.tags.map(t => `<span class="tag">${t}</span>`).join('')
                : '<em style="color:#888;">all</em>';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${c.name}</strong></td>
                <td>${agentLabel}</td>
                <td>${suitesLabel}</td>
                <td>${tagsLabel}</td>
                <td style="white-space:nowrap;">
                    <button class="btn small success" onclick="runTestPlanNow('${c.config_id}')">Run</button>
                    <button class="btn small" onclick="editTestPlan('${c.config_id}')">Edit</button>
                    <button class="btn small danger" onclick="deleteTestPlan('${c.config_id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (e) { console.error(e); }
}

async function runTestPlanNow(configId) {
    toast('Starting run...', 'info');
    try {
        const res = await fetch('/api/test-runs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Project': window._activeProject },
            body: JSON.stringify({ config_id: configId })
        });
        const data = await res.json();
        if (!res.ok) { toast(data.error || 'Run failed', 'error'); return; }
        const s = data.total_summary;
        toast(`Done: ${s.passed}/${s.total} passed across ${s.run_count} run(s)`, 'success');
        loadTestPlansPage();
    } catch (e) { toast(String(e), 'error'); }
}

function openTestPlanModal(configId) {
    const agents = (window._agentsCache || []).filter(a => a.agent_id !== '_shared');
    const cfg = configId ? (window._testPlansCache || []).find(c => c.config_id === configId) : null;

    document.getElementById('tp-modal-title').textContent = cfg ? 'Edit Test Plan' : 'New Test Plan';
    document.getElementById('rc-id').value = cfg ? cfg.config_id : '';
    document.getElementById('rc-name').value = cfg ? cfg.name : '';

    const funcChecked = cfg ? cfg.suite_types.includes('functional') : true;
    const secChecked  = cfg ? cfg.suite_types.includes('security')   : false;
    document.getElementById('rc-suite-functional').checked = funcChecked;
    document.getElementById('rc-suite-security').checked   = secChecked;
    document.getElementById('rc-suite-functional-wrap').style.borderColor = funcChecked ? '#3498db' : '#ddd';
    document.getElementById('rc-suite-security-wrap').style.borderColor   = secChecked  ? '#3498db' : '#ddd';
    document.getElementById('rc-tags').value = cfg ? (cfg.tags || []).join(', ') : '';

    const checksDiv = document.getElementById('rc-agents-checks');
    checksDiv.innerHTML = '';
    if (!agents.length) {
        checksDiv.innerHTML = '<p style="color:#888;font-size:13px;">No agents yet — add agents first.</p>';
    } else {
        agents.forEach(a => {
            const isChecked = cfg && cfg.agent_ids && cfg.agent_ids.length > 0 && cfg.agent_ids.includes(a.agent_id);
            const card = document.createElement('label');
            card.style = `display:flex;align-items:center;gap:12px;cursor:pointer;background:#fff;border:2px solid ${isChecked ? '#3498db' : '#e0e0e0'};border-radius:8px;padding:12px 16px;transition:border-color .15s;`;
            card.innerHTML = `
                <input type="checkbox" value="${a.agent_id}" ${isChecked ? 'checked' : ''} style="width:16px;height:16px;flex-shrink:0;"
                       onchange="this.closest('label').style.borderColor=this.checked?'#3498db':'#e0e0e0'">
                <div>
                    <div style="font-weight:600;font-size:14px;">${escHtml(a.name)}</div>
                    <div style="font-size:11px;color:#888;margin-top:2px;">${escHtml(a.endpoint || '—')}</div>
                </div>`;
            checksDiv.appendChild(card);
        });
    }

    const overlay = document.getElementById('test-plan-overlay');
    overlay.style.display = 'flex';
    overlay.scrollTop = 0;
}

function closeTestPlanEditor() {
    document.getElementById('test-plan-overlay').style.display = 'none';
}

function editTestPlan(configId) {
    openTestPlanModal(configId);
}

async function saveTestPlan() {
    const id = document.getElementById('rc-id').value;
    const name = document.getElementById('rc-name').value.trim();
    if (!name) { toast('Enter a test plan name', 'warn'); return; }

    const agentIds = Array.from(document.querySelectorAll('#rc-agents-checks input:checked')).map(el => el.value);
    const suiteTypes = [];
    if (document.getElementById('rc-suite-functional').checked) suiteTypes.push('functional');
    if (document.getElementById('rc-suite-security').checked)   suiteTypes.push('security');
    if (!suiteTypes.length) { toast('Select at least one suite type', 'warn'); return; }

    const tagsRaw = document.getElementById('rc-tags').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    const payload = { name, agent_ids: agentIds, suite_types: suiteTypes, tags };
    try {
        if (id) {
            await API.put(`/test-plans/${id}`, payload);
        } else {
            await API.post('/test-plans', payload);
        }
        closeTestPlanEditor();
        toast('Test plan saved', 'success');
        loadTestPlansPage();
    } catch (e) { toast('Error saving test plan', 'error'); }
}

async function deleteTestPlan(configId) {
    if (!await uiConfirm('Delete this test plan?')) return;
    await API.delete(`/test-plans/${configId}`);
    toast('Deleted', 'info');
    loadTestPlansPage();
}

function viewTestRun(runId) {
    // Navigate to results page without relying on a click event
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('results').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById('page-title').textContent = 'Results';
    loadResultsPage(runId);
}

async function loadResultsPage(preselectedRunId) {
    try {
        const runs = await API.get('/test-runs?limit=100');
        const sel = document.getElementById('results-test-run-select');
        sel.innerHTML = '<option value="">Select Run...</option>';
        runs.slice().reverse().forEach(r => {
            const o = document.createElement('option');
            o.value = r.run_id;
            const ts = new Date(r.started_at).toLocaleString();
            const s = r.summary || {};
            o.textContent = `${r.agent_name || r.agent_id} / ${r.suite_type} — ${ts} (${s.passed||0}/${s.total||0})`;
            sel.appendChild(o);
        });

        if (preselectedRunId) {
            sel.value = preselectedRunId;
        }

        if (sel.value) {
            await renderRunDetail(sel.value);
        } else {
            document.getElementById('results-content').innerHTML = '';
        }

    } catch (e) {
        console.error(e);
    }
}

async function renderRunDetail(runId) {
    const content = document.getElementById('results-content');
    content.innerHTML = '<p style="color:#888;padding:20px;">Loading...</p>';
    try {
        const run = await API.get(`/test-runs/${runId}`);
        const s = run.summary || {};
        const passRate = run.pass_rate != null ? (run.pass_rate * 100).toFixed(1) + '%' : '-';

        let html = `
            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card"><div class="stat-label">Passed</div><div class="stat-value" style="color:#27ae60;">${s.passed||0}</div></div>
                <div class="stat-card"><div class="stat-label">Failed</div><div class="stat-value" style="color:#e74c3c;">${s.failed||0}</div></div>
                <div class="stat-card"><div class="stat-label">Errors</div><div class="stat-value" style="color:#e67e22;">${s.errors||0}</div></div>
                <div class="stat-card"><div class="stat-label">Pass Rate</div><div class="stat-value">${passRate}</div></div>
            </div>
            <div class="card">
                <div class="card-header">
                    <h3>Test Results — ${run.agent_name || run.agent_id} / ${run.suite_type}</h3>
                    <span style="font-size:13px;color:#888;">${run.duration_seconds}s total</span>
                </div>
                <div class="card-content" style="padding:0;">
                    <table>
                        <thead><tr>
                            <th>ID</th><th>Name</th><th>Status</th>
                            <th>Score</th><th>Latency</th><th>Details</th>
                        </tr></thead>
                        <tbody>
        `;

        (run.results || []).forEach((r, i) => {
            const badge = r.status === 'pass' ? 'badge-pass' : r.status === 'error' ? 'badge-error' : 'badge-fail';
            const latencyWarn = r.latency_ok === false ? ' style="color:#e67e22;"' : '';
            html += `
                <tr>
                    <td style="font-family:monospace;font-size:12px;">${r.test_id}</td>
                    <td>${r.test_name || ''}</td>
                    <td><span class="badge ${badge}">${r.status}</span></td>
                    <td>${r.score != null ? (r.score * 100).toFixed(0) + '%' : '-'}</td>
                    <td${latencyWarn}>${r.latency_ms != null ? r.latency_ms + 'ms' : '-'}</td>
                    <td><button class="btn small" onclick="toggleResultDetail('rd-${i}')">Expand</button></td>
                </tr>
                <tr id="rd-${i}" style="display:none;background:#fafafa;">
                    <td colspan="6" style="padding:16px;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div>
                                <div style="font-size:11px;font-weight:600;color:#555;margin-bottom:6px;text-transform:uppercase;">Expected</div>
                                <pre style="background:#e8f5e9;padding:12px;border-radius:4px;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto;">${escHtml(r.expected_response || '')}</pre>
                            </div>
                            <div>
                                <div style="font-size:11px;font-weight:600;color:#555;margin-bottom:6px;text-transform:uppercase;">Actual</div>
                                <pre style="background:${r.status==='pass'?'#e8f5e9':r.status==='error'?'#fff3e0':'#fce4ec'};padding:12px;border-radius:4px;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto;">${escHtml(r.error || r.actual_response || '')}</pre>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div></div>';
        content.innerHTML = html;
    } catch (e) {
        content.innerHTML = `<p style="color:#e74c3c;padding:20px;">Error loading run: ${e}</p>`;
    }
}

function toggleResultDetail(id) {
    const row = document.getElementById(id);
    if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
}

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function loadTagsPage() {
    try {
        const tags = await API.get('/tags');
        const container = document.getElementById('tags-list');
        if (!tags.length) {
            container.innerHTML = '<p style="color:#888;">No tags yet.</p>';
            return;
        }
        container.innerHTML = '<p style="font-size:12px;color:#888;margin-bottom:12px;">Click a tag to filter tests by it.</p>' +
            tags.map(t => `
            <span class="tag custom" onclick="filterTestsByTag('${t.name}')" style="background:${t.color || '#3498db'};color:#fff;font-size:14px;padding:6px 14px;margin:4px;border-radius:16px;display:inline-block;cursor:pointer;" title="Filter tests by ${t.name}">
                ${t.name}
            </span>
        `).join('');
    } catch (e) {
        console.error(e);
    }
}

function filterTestsByTag(tagName) {
    window._activeTagFilters.clear();
    window._activeTagFilters.add(tagName);
    switchPage('test-cases');
    // loadTestCasesPage is called by switchPage; after it loads, renderTagFilterChips will reflect the active filter
}

async function loadReportsPage() {
    // Placeholder
}

// ── Environments ──────────────────────────────────────────
window._profiles = [];
window._activeEnvironmentId = localStorage.getItem('activeEnvironmentId') || '';

function applyVars(text) {
    const profile = window._profiles.find(p => p.id === window._activeEnvironmentId);
    if (!profile || !profile.variables) return text;
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => profile.variables[key] ?? `{{${key}}}`);
}

async function loadEnvironmentsPage() {
    await refreshEnvironments();
    renderEnvironmentList();
    document.getElementById('ee-id').value = '';
    document.getElementById('ee-name').value = '';
    document.getElementById('ee-vars-body').innerHTML = '';
    document.getElementById('ee-delete-btn').style.display = 'none';
}

async function refreshEnvironments() {
    try {
        window._profiles = await API.get('/environments');
        const sel = document.getElementById('active-environment-select');
        const prev = sel.value;
        sel.innerHTML = '<option value="">No Environment</option>';
        window._profiles.forEach(p => {
            const o = document.createElement('option');
            o.value = p.id;
            o.textContent = p.name;
            sel.appendChild(o);
        });
        sel.value = window._activeEnvironmentId || prev;
    } catch(e) { console.error(e); }
}

function renderEnvironmentList() {
    const el = document.getElementById('environments-list');
    el.innerHTML = '';
    window._profiles.forEach(p => {
        const d = document.createElement('div');
        d.style = 'padding:8px 12px;border-radius:6px;cursor:pointer;margin-bottom:4px;border:2px solid ' + (p.id === window._activeEnvironmentId ? '#3498db' : '#eee') + ';background:' + (p.id === window._activeEnvironmentId ? '#ebf5fb' : '#fff');
        d.textContent = p.name;
        d.onclick = () => openEnvironmentEditor(p);
        el.appendChild(d);
    });
}

function openEnvironmentEditor(p) {
    document.getElementById('ee-id').value = p.id;
    document.getElementById('ee-name').value = p.name;
    document.getElementById('ee-delete-btn').style.display = '';
    const tbody = document.getElementById('ee-vars-body');
    tbody.innerHTML = '';
    Object.entries(p.variables || {}).forEach(([k, v]) => addVarRow(k, v));
    renderEnvironmentList();
}

function newEnvironment() {
    document.getElementById('ee-id').value = '';
    document.getElementById('ee-name').value = '';
    document.getElementById('ee-vars-body').innerHTML = '';
    document.getElementById('ee-delete-btn').style.display = 'none';
}

function addVarRow(key='', value='') {
    const tbody = document.getElementById('ee-vars-body');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" value="${key}" placeholder="variable_name" style="width:100%;padding:5px 8px;border:1px solid #ddd;border-radius:4px;font-family:monospace;font-size:13px;"></td>
        <td><input type="text" value="${value}" placeholder="value" style="width:100%;padding:5px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;"></td>
        <td><button onclick="this.closest('tr').remove()" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:16px;">&times;</button></td>
    `;
    tbody.appendChild(tr);
}

async function saveEnvironment() {
    const id = document.getElementById('ee-id').value;
    const name = document.getElementById('ee-name').value.trim();
    if (!name) { toast('Enter an environment name', 'warn'); return; }
    const variables = {};
    document.querySelectorAll('#ee-vars-body tr').forEach(tr => {
        const inputs = tr.querySelectorAll('input');
        const k = inputs[0].value.trim();
        const v = inputs[1].value;
        if (k) variables[k] = v;
    });
    try {
        if (id) {
            await API.put(`/environments/${id}`, {name, variables});
        } else {
            const p = await API.post('/environments', {name, variables});
            document.getElementById('ee-id').value = p.id;
            document.getElementById('ee-delete-btn').style.display = '';
        }
        await refreshEnvironments();
        renderEnvironmentList();
    } catch(e) { toast('Error saving environment', 'error'); }
}

async function deleteEnvironment() {
    const id = document.getElementById('ee-id').value;
    if (!id) return;
    if (!await uiConfirm('Delete this environment?')) return;
    await API.delete(`/environments/${id}`);
    if (window._activeEnvironmentId === id) setActiveEnvironment('');
    newEnvironment();
    await refreshEnvironments();
    renderEnvironmentList();
}

function setActiveEnvironment(id) {
    window._activeEnvironmentId = id;
    localStorage.setItem('activeEnvironmentId', id);
    renderEnvironmentList();
}

// ── Git dirty indicator ───────────────────────────────────
function updateGitDirtyIndicator(dirty) {
    const dot = document.getElementById('git-dirty-dot');
    if (!dot) return;
    dot.style.display = dirty ? 'inline-block' : 'none';
    const navItem = document.getElementById('git-nav-item');
    if (navItem) {
        navItem.style.background = dirty ? 'rgba(231,76,60,0.18)' : '';
        navItem.title = dirty ? 'You have uncommitted changes!' : '';
    }
}

// ── Git ───────────────────────────────────────────────────
async function loadGitStatus() {
    document.getElementById('git-status').textContent = 'Loading...';
    try {
        const data = await API.get('/git/status');
        document.getElementById('git-status').textContent = data.output || 'Nothing to commit';
        updateGitDirtyIndicator(data.dirty || false);
    } catch(e) {
        document.getElementById('git-status').textContent = 'Error: ' + e;
    }
}

async function loadGitInfo() {
    try {
        const info = await API.get('/git/info');
        const branchEl = document.getElementById('git-branch-label');
        const abEl = document.getElementById('git-ahead-behind');
        const syncEl = document.getElementById('git-last-sync');
        if (branchEl) branchEl.textContent = 'branch: ' + (info.branch || '?');
        if (abEl) {
            const parts = [];
            if (info.ahead) parts.push(`${info.ahead} ahead`);
            if (info.behind) parts.push(`${info.behind} behind`);
            abEl.textContent = parts.join(', ') || 'up to date';
            abEl.style.color = info.behind ? '#e67e22' : '#27ae60';
        }
        if (syncEl) syncEl.textContent = info.last_sync ? 'last sync: ' + new Date(info.last_sync).toLocaleTimeString() : 'never synced';
        updateGitDirtyIndicator(info.dirty || false);
    } catch(e) { /* git may not be set up */ }
}

async function doGitSync() {
    const btn = document.getElementById('git-sync-btn');
    const progress = document.getElementById('git-sync-progress');
    const conflictPanel = document.getElementById('git-conflict-panel');
    const outEl = document.getElementById('git-output');
    if (btn) btn.disabled = true;
    if (progress) progress.style.display = 'block';
    if (conflictPanel) conflictPanel.style.display = 'none';
    try {
        const data = await API.post('/git/sync', {});
        if (data.success) {
            toast('Sync complete', 'success');
            loadGitStatus();
            loadGitInfo();
        } else {
            // Conflict
            if (conflictPanel) {
                conflictPanel.style.display = 'block';
                const list = document.getElementById('git-conflict-list');
                if (list) list.innerHTML = (data.conflicts || []).map(f => `<li>${f}</li>`).join('');
            }
            if (outEl) { outEl.textContent = data.output || ''; outEl.style.display = 'block'; }
            toast('Sync conflict — rebase aborted, your files are safe', 'error');
        }
    } catch(e) {
        toast('Sync error: ' + e, 'error');
    } finally {
        if (btn) btn.disabled = false;
        if (progress) progress.style.display = 'none';
    }
}

async function doGitPush() {
    const btn = document.getElementById('git-push-btn');
    const statusEl = document.getElementById('git-commit-status');
    const outEl = document.getElementById('git-output');
    if (btn) btn.disabled = true;
    statusEl.textContent = 'Pushing...';
    try {
        const data = await API.post('/git/push', {});
        statusEl.textContent = data.success ? `Pushed to ${data.branch}` : 'Push failed';
        statusEl.style.color = data.success ? '#27ae60' : '#e74c3c';
        outEl.textContent = data.output || '';
        outEl.style.display = 'block';
        if (data.success) loadGitInfo();
    } catch(e) {
        statusEl.textContent = 'Error';
        outEl.textContent = String(e);
        outEl.style.display = 'block';
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function doSmartCommit() {
    const msg = document.getElementById('git-message').value.trim();
    if (!msg) { toast('Enter a commit message first', 'warn'); return; }
    const statusEl = document.getElementById('git-commit-status');
    const outEl = document.getElementById('git-output');
    const commitsPanel = document.getElementById('git-commits-panel');
    const commitsList = document.getElementById('git-commits-list');
    const conflictPanel = document.getElementById('git-conflict-panel');

    statusEl.textContent = 'Committing by scope...';
    statusEl.style.color = '#888';
    outEl.style.display = 'none';
    if (commitsPanel) commitsPanel.style.display = 'none';
    if (conflictPanel) conflictPanel.style.display = 'none';

    try {
        const data = await API.post('/git/smart-commit', { message: msg });

        // Show per-commit breakdown
        if (data.commits && data.commits.length && commitsPanel) {
            commitsPanel.style.display = 'block';
            commitsList.innerHTML = data.commits.map(c => `
                <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #eee;font-size:13px;">
                    <span style="color:${c.success ? '#27ae60' : '#e74c3c'};font-size:16px;">${c.success ? '&#10003;' : '&#10007;'}</span>
                    <code style="flex:1;font-size:12px;">${c.subject}</code>
                    <span style="color:#888;">${c.files} file${c.files !== 1 ? 's' : ''}</span>
                </div>
            `).join('');
        }

        if (data.conflicts && data.conflicts.length && conflictPanel) {
            conflictPanel.style.display = 'block';
            const list = document.getElementById('git-conflict-list');
            if (list) list.innerHTML = data.conflicts.map(f => `<li>${f}</li>`).join('');
        }

        outEl.textContent = data.output || '';
        outEl.style.display = 'block';

        if (data.success) {
            document.getElementById('git-message').value = '';
            statusEl.textContent = data.pushed ? `${data.commits.length} commit(s) — pushed` : `${data.commits.length} commit(s) — not pushed`;
            statusEl.style.color = '#27ae60';
            loadGitStatus();
            loadGitInfo();
            updateGitDirtyIndicator(data.dirty || false);
        } else {
            statusEl.textContent = 'Commit failed';
            statusEl.style.color = '#e74c3c';
        }
    } catch(e) {
        statusEl.textContent = 'Error';
        outEl.textContent = String(e);
        outEl.style.display = 'block';
    }
}

async function doGitCommit() {
    const msg = document.getElementById('git-message').value.trim();
    if (!msg) { toast('Enter a commit message', 'warn'); return; }
    const statusEl = document.getElementById('git-commit-status');
    const outEl = document.getElementById('git-output');
    statusEl.textContent = 'Committing...';
    outEl.style.display = 'none';
    try {
        const data = await API.post('/git/commit', { message: msg });
        statusEl.textContent = data.success ? 'Committed!' : 'Failed';
        statusEl.style.color = data.success ? '#27ae60' : '#e74c3c';
        outEl.textContent = data.output || '';
        outEl.style.display = 'block';
        if (data.success) {
            document.getElementById('git-message').value = '';
            loadGitStatus();
            loadGitInfo();
            updateGitDirtyIndicator(data.dirty || false);
        }
    } catch(e) {
        statusEl.textContent = 'Error';
        outEl.textContent = String(e);
        outEl.style.display = 'block';
    }
}

async function loadLogsPage() {
    try {
        const type = document.getElementById('logs-type').value;
        const data = await API.get(`/logs/${type}`);
        document.getElementById('logs-content').textContent = data.content || 'No logs';
    } catch (e) {
        console.error(e);
        document.getElementById('logs-content').textContent = 'Error loading logs';
    }
}

async function clearLogsPage() {
    if (!await uiConfirm('Clear logs?', 'Clear', 'danger')) return;
    try {
        const type = document.getElementById('logs-type').value;
        await API.delete(`/logs/${type}`);
        loadLogsPage();
    } catch (e) {
        console.error(e);
    }
}

function toggleAuthFields() {
    const authType = document.getElementById('agent-auth-type').value;
    const showValue = authType !== 'none';
    const showHeader = authType === 'api_key';
    document.getElementById('auth-value-group').style.display = showValue ? '' : 'none';
    document.getElementById('auth-header-group').style.display = showHeader ? '' : 'none';
    const labels = { bearer: 'Bearer Token', basic: 'Credentials (user:pass)', api_key: 'Key Value' };
    document.getElementById('agent-auth-value-label').textContent = labels[authType] || 'Token / Key';
}

function editAgent(agentId) {
    const agent = (window._agentsCache || []).find(a => a.agent_id === agentId);
    if (!agent) return;
    document.getElementById('agent-modal-title').textContent = 'Edit Agent';
    document.getElementById('agent-id').value = agent.agent_id;
    document.getElementById('agent-name').value = agent.name;
    document.getElementById('agent-endpoint').value = agent.endpoint;
    document.getElementById('agent-model').value = agent.model_version;
    document.getElementById('agent-auth-type').value = agent.auth_type || 'none';
    document.getElementById('agent-auth-header').value = agent.auth_header || '';
    document.getElementById('agent-auth-value').value = agent.auth_value || '';
    document.getElementById('agent-body-template').value = agent.body_template || '';
    document.getElementById('agent-response-path').value = agent.response_path || '';
    toggleAuthFields();
    openAgentEditor();
}

async function deleteAgent(agentId) {
    if (!await uiConfirm('Delete this agent and all its tests?')) return;
    try {
        await API.delete(`/agents/${agentId}`);
        loadAgentsPage();
    } catch (e) {
        console.error(e);
        toast('Error deleting agent', 'error');
    }
}

async function saveAgent() {
    const agentId = document.getElementById('agent-id').value;
    const agent = {
        name: document.getElementById('agent-name').value,
        endpoint: document.getElementById('agent-endpoint').value,
        model_version: document.getElementById('agent-model').value,
        auth_type: document.getElementById('agent-auth-type').value,
        auth_header: document.getElementById('agent-auth-header').value,
        auth_value: document.getElementById('agent-auth-value').value,
        body_template: document.getElementById('agent-body-template').value.trim(),
        response_path: document.getElementById('agent-response-path').value.trim(),
    };

    try {
        if (agentId) {
            await API.put(`/agents/${agentId}`, agent);
        } else {
            await API.post('/agents', agent);
        }
        closeAgentEditor();
        document.getElementById('agent-id').value = '';
        document.getElementById('agent-modal-title').textContent = 'Add Agent';
        document.getElementById('agent-name').value = '';
        document.getElementById('agent-endpoint').value = '';
        document.getElementById('agent-model').value = '';
        document.getElementById('agent-auth-type').value = 'none';
        document.getElementById('agent-auth-header').value = '';
        document.getElementById('agent-auth-value').value = '';
        document.getElementById('agent-body-template').value = '';
        document.getElementById('agent-response-path').value = '';
        toggleAuthFields();
        updateGitDirtyIndicator(true);
        loadAgentsPage();
    } catch (e) {
        console.error(e);
        toast('Error saving agent', 'error');
    }
}

function onScopeChange() {
    const scope = document.getElementById('te-scope').value;
    document.getElementById('te-agent-wrap').style.display = scope === 'agent' ? '' : 'none';
}

function openTestEditor(prefillTest) {
    const inGlobal = window._activeProject === '_global';

    // Populate agent pickers
    const agentSel  = document.getElementById('te-agent');
    const probeSel  = document.getElementById('te-probe-agent');
    [agentSel, probeSel].forEach((sel, i) => {
        sel.innerHTML = `<option value="">${i ? 'Try against agent...' : 'Select Agent...'}</option>`;
        (window._agentsCache || []).filter(a => a.agent_id !== '_shared').forEach(a => {
            const o = document.createElement('option');
            o.value = a.agent_id; o.textContent = a.name;
            sel.appendChild(o);
        });
    });

    // Show/hide Global scope option based on active project
    const scopeSel = document.getElementById('te-scope');
    const globalOpt = scopeSel.querySelector('option[value="global"]');
    if (globalOpt) globalOpt.style.display = inGlobal ? '' : 'none';

    if (prefillTest) {
        document.getElementById('te-title').textContent = 'Edit Test Case';
        document.getElementById('te-editing-id').value = prefillTest.test_id;
        document.getElementById('te-id').value = prefillTest.test_id;
        document.getElementById('te-name').value = prefillTest.test_name || '';
        document.getElementById('te-prompt').value = prefillTest.user_prompt || '';
        document.getElementById('te-expected').value = prefillTest.expected_response || '';
        document.getElementById('te-category').value = prefillTest.category || '';
        document.getElementById('te-priority').value = prefillTest.priority || 'medium';
        document.getElementById('te-tags').value = (prefillTest.tags || []).join(', ');
        document.getElementById('te-suite').value = prefillTest.suite_type || 'functional';
        // Only set global scope if we're in the global project
        const src = prefillTest._source || 'global';
        scopeSel.value = (src === 'global' && !inGlobal) ? 'workspace' : src;
        if (prefillTest._agent_id) agentSel.value = prefillTest._agent_id;
    } else {
        document.getElementById('te-title').textContent = 'New Test Case';
        document.getElementById('te-editing-id').value = '';
        ['te-id','te-name','te-prompt','te-expected','te-category','te-tags'].forEach(id => {
            document.getElementById(id).value = '';
        });
        document.getElementById('te-priority').value = 'medium';
        scopeSel.value = inGlobal ? 'global' : 'workspace';
    }

    onScopeChange();
    document.getElementById('te-actual').textContent = 'Hit "Try It" to send the prompt to the selected agent.';
    document.getElementById('te-probe-status').textContent = '';
    document.getElementById('te-format-tabs').style.display = 'none';
    window._responseFormat = 'auto';
    document.querySelectorAll('.rfmt-btn').forEach(b => b.classList.remove('rfmt-active'));
    const autoBtn = document.getElementById('rfmt-auto');
    if (autoBtn) autoBtn.classList.add('rfmt-active');
    document.getElementById('test-editor-overlay').style.display = 'flex';
}

function closeTestEditor() {
    document.getElementById('test-editor-overlay').style.display = 'none';
    loadTestCasesPage();
}

// ── Response formatter ────────────────────────────────────
window._lastRawResponse = '';
window._responseFormat = 'auto';

function setResponseFormat(fmt) {
    window._responseFormat = fmt;
    document.querySelectorAll('.rfmt-btn').forEach(b => b.classList.remove('rfmt-active'));
    const btn = document.getElementById(`rfmt-${fmt}`);
    if (btn) btn.classList.add('rfmt-active');
    renderActualResponse(window._lastRawResponse);
}

function renderActualResponse(raw) {
    window._lastRawResponse = raw;
    const el = document.getElementById('te-actual');
    const fmt = window._responseFormat;

    if (!raw) { el.textContent = ''; return; }

    // Auto-detect
    const detected = detectFormat(raw);
    const use = (fmt === 'auto') ? detected : fmt;

    el.style.color = '#2c3e50';

    if (use === 'json') {
        try {
            const parsed = JSON.parse(raw);
            el.innerHTML = syntaxHighlightJson(JSON.stringify(parsed, null, 2));
            el.style.whiteSpace = 'pre-wrap';
            return;
        } catch(e) { /* fall through */ }
    }

    if (use === 'markdown') {
        el.innerHTML = renderMarkdown(raw);
        el.style.whiteSpace = 'normal';
        return;
    }

    // text or raw — plain pre-wrap
    el.textContent = raw;
    el.style.whiteSpace = 'pre-wrap';
}

function detectFormat(s) {
    const t = s.trim();
    if (t.startsWith('{') || t.startsWith('[')) return 'json';
    if (/^#{1,6} |^\*\*|^- |\n#{1,6} /.test(t)) return 'markdown';
    return 'text';
}

function syntaxHighlightJson(str) {
    return str.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
        let cls = 'json-num';
        if (/^"/.test(match)) {
            cls = /:$/.test(match) ? 'json-key' : 'json-str';
        } else if (/true|false/.test(match)) {
            cls = 'json-bool';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }
        return `<span class="${cls}">${escHtml(match)}</span>`;
    });
}

function renderMarkdown(text) {
    return escHtml(text)
        .replace(/^#{3} (.+)$/gm,  '<h3 style="margin:.6em 0 .3em;font-size:14px;color:#2c3e50;">$1</h3>')
        .replace(/^#{2} (.+)$/gm,  '<h2 style="margin:.6em 0 .3em;font-size:15px;color:#2c3e50;">$1</h2>')
        .replace(/^#{1} (.+)$/gm,  '<h1 style="margin:.6em 0 .3em;font-size:16px;color:#2c3e50;">$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,     '<em>$1</em>')
        .replace(/`([^`]+)`/g,     '<code style="background:#eee;padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
        .replace(/^- (.+)$/gm,     '<li style="margin:.2em 0 .2em 16px;">$1</li>')
        .replace(/\n\n/g,          '<br><br>')
        .replace(/\n/g,            '<br>');
}

async function runProbe() {
    const agentId = document.getElementById('te-probe-agent').value || document.getElementById('te-agent').value;
    const rawPrompt = document.getElementById('te-prompt').value.trim();
    const prompt = applyVars(rawPrompt);
    if (!agentId) { toast('Select an agent to probe against', 'warn'); return; }
    if (!prompt) { toast('Enter a prompt first', 'warn'); return; }

    const btn = document.getElementById('te-try-btn');
    const statusEl = document.getElementById('te-probe-status');
    const actualEl = document.getElementById('te-actual');
    btn.textContent = 'Running...';
    btn.disabled = true;
    statusEl.textContent = 'sending...';
    actualEl.textContent = '';

    const start = Date.now();
    try {
        const res = await fetch('/api/probe', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-Project': window._activeProject},
            body: JSON.stringify({agent_id: agentId, prompt})
        });
        const data = await res.json();
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);
        statusEl.textContent = `${res.ok ? 'OK' : 'ERROR'} — ${elapsed}s`;
        statusEl.style.color = res.ok ? '#2ecc71' : '#e74c3c';

        // Show format tabs
        document.getElementById('te-format-tabs').style.display = 'flex';

        if (data.error) {
            actualEl.style.color = '#e74c3c';
            renderActualResponse('ERROR: ' + data.error);
        } else {
            const raw = typeof data.response === 'string' ? data.response : JSON.stringify(data.response, null, 2);
            actualEl.style.color = '#2c3e50';
            renderActualResponse(raw);
        }
    } catch (e) {
        statusEl.textContent = 'failed';
        renderActualResponse(String(e));
        actualEl.style.color = '#e74c3c';
    } finally {
        btn.textContent = '\u25b6 Try It';
        btn.disabled = false;
    }
}

async function saveTestFromEditor() {
    const editingId = document.getElementById('te-editing-id').value;
    const scope = document.getElementById('te-scope').value;
    const agentId = scope === 'agent' ? document.getElementById('te-agent').value : '';
    if (scope === 'agent' && !agentId) { toast('Select an agent', 'warn'); return; }

    const test_name = document.getElementById('te-name').value.trim();
    if (!test_name) { toast('Enter a test name', 'warn'); return; }

    const payload = {
        scope,
        agent_id: agentId,
        editing_id: editingId,
        test_id: document.getElementById('te-id').value.trim() || ('test_' + Date.now()),
        test_name,
        suite_type: document.getElementById('te-suite').value,
        user_prompt: document.getElementById('te-prompt').value,
        expected_response: document.getElementById('te-expected').value,
        category: document.getElementById('te-category').value.trim(),
        priority: document.getElementById('te-priority').value,
        tags: document.getElementById('te-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    };

    try {
        const saved = await API.post('/test-cases', payload);
        document.getElementById('te-editing-id').value = saved.test_id || payload.test_id;
        document.getElementById('te-id').value = saved.test_id || payload.test_id;
        document.getElementById('te-title').textContent = 'Saved!';
        if (typeof updateGitDirtyIndicator === 'function') updateGitDirtyIndicator(true);
        setTimeout(() => document.getElementById('te-title').textContent = 'Edit Test', 1500);
    } catch (e) {
        console.error(e);
        toast('Error saving test', 'error');
    }
}

async function editTest(testId) {
    try {
        const test = await API.get(`/test-cases/${testId}`);
        openTestEditor(test);
    } catch (e) {
        console.error(e);
        toast('Error loading test', 'error');
    }
}

async function deleteTest(testId) {
    if (!await uiConfirm('Delete this test?')) return;
    try {
        await API.delete(`/test-cases/${testId}`);
        if (typeof updateGitDirtyIndicator === 'function') updateGitDirtyIndicator(true);
        loadTestCasesPage();
    } catch (e) {
        console.error(e);
        toast('Error deleting test', 'error');
    }
}

async function saveTag() {
    const tag = {
        name: document.getElementById('tag-name').value,
        color: document.getElementById('tag-color').value
    };

    try {
        await API.post('/tags', tag);
        closeTagEditor();
        loadTagsPage();
        document.getElementById('tag-name').value = '';
        document.getElementById('tag-color').value = '';
    } catch (e) {
        console.error(e);
        toast('Error saving tag', 'error');
    }
}

// ── Projects ──────────────────────────────────────────────
async function loadProjectsDropdown() {
    try {
        const projects = await fetch('/api/projects').then(r => r.json());
        const sel = document.getElementById('project-select');
        sel.innerHTML = '';
        projects.forEach(proj => {
            const o = document.createElement('option');
            o.value = proj.id;
            o.textContent = proj.name;
            sel.appendChild(o);
        });
        // Ensure saved project exists, else fall back to first
        if (projects.find(p => p.id === window._activeProject)) {
            sel.value = window._activeProject;
        } else if (projects.length) {
            window._activeProject = projects[0].id;
            sel.value = window._activeProject;
            localStorage.setItem('activeProject', window._activeProject);
        }
    } catch(e) { console.error(e); }
}

function updateNavForProject(project) {
    const isGlobal = project === '_global';
    // In _global: show only Test Cases. Hide everything else.
    const hideWhenGlobal = [
        'nav-dashboard', 'nav-agents',
        'nav-section-execution',
        'nav-section-management',
    ];
    hideWhenGlobal.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isGlobal ? 'none' : '';
    });
    // If on a hidden page, jump to test-cases
    if (isGlobal) {
        const currentPage = document.querySelector('.page.active');
        if (currentPage && currentPage.id !== 'test-cases') {
            switchPage('test-cases');
        }
    }
}

function switchProject(id) {
    window._activeProject = id;
    localStorage.setItem('activeProject', id);
    window._testPlansCache = [];
    updateNavForProject(id);
    if (id === '_global') {
        loadTestCasesPage();
    } else {
        loadDashboard();
        loadAgentsPage();
        refreshEnvironments();
        API.get('/test-plans').then(c => { window._testPlansCache = c; }).catch(() => {});
    }
}

async function createProject() {
    const nameEl = document.getElementById('new-project-name');
    const name = nameEl.value.trim();
    if (!name) { toast('Enter a project name', 'warn'); return; }
    const id = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!id) { toast('Invalid name', 'warn'); return; }
    try {
        const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name })
        });
        const data = await res.json();
        if (!res.ok) { toast(data.error || 'Error creating project', 'error'); return; }
        nameEl.value = '';
        closeProjectEditor();
        await loadProjectsDropdown();
        switchProject(id);
        toast(`Project "${name}" created`, 'success');
    } catch(e) {
        toast('Error creating project', 'error');
    }
}

// Init
loadProjectsDropdown().then(() => {
    updateNavForProject(window._activeProject);
    if (window._activeProject === '_global') {
        loadTestCasesPage();
    } else {
        loadDashboard();
        loadAgentsPage();
        refreshEnvironments();
        API.get('/test-plans').then(c => { window._testPlansCache = c; }).catch(() => {});
    }
    if (typeof loadGitInfo === 'function') loadGitInfo();
});

// Auto-sync every 5 minutes
setInterval(() => {
    doGitSync();
}, 5 * 60 * 1000);
