// ── Active project (persisted) ────────────────────────────
window._activeProject = localStorage.getItem('activeProject') || 'default';

// ── Electron scorer IPC ───────────────────────────────────
if (window.electronAPI) {
    window.electronAPI.onScorerProgress((pct) => {
        const dot = document.getElementById('scorer-dot');
        const label = document.getElementById('scorer-label');
        if (dot) dot.style.background = '#f39c12';
        if (label) label.textContent = `Loading model... ${pct}%`;
    });
    window.electronAPI.onScorerReady(() => {
        const dot = document.getElementById('scorer-dot');
        const label = document.getElementById('scorer-label');
        if (dot) dot.style.background = '#27ae60';
        if (label) label.textContent = 'Ready';
    });
}

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
    const pageEl = document.getElementById(page);
    if (pageEl) pageEl.classList.add('active');

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
        git: 'Git Commit',
        settings: 'Settings'
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
    else if (page === 'settings') openSettings();
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
            const agentTagsHtml = (agent.tags || []).map(t =>
                `<span style="background:#e8f4fd;color:#1a5276;padding:1px 7px;border-radius:10px;font-size:11px;margin:1px;">${escHtml(t)}</span>`
            ).join('') || '<span style="color:#ccc;font-size:12px;">—</span>';
            row.innerHTML = `
                <td>${agent.name}</td>
                <td><code style="background:#f0f0f0;padding:4px 8px;border-radius:4px;">${agent.endpoint || '—'}</code></td>
                <td>${agent.model_version || '—'}</td>
                <td>${agentTagsHtml}</td>
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

        let anyRunning = false;
        runs.slice().reverse().forEach(run => {
            const row = document.createElement('tr');
            const status = run.status || 'pending';
            if (status === 'running') anyRunning = true;
            row.setAttribute('data-run-status', status);

            const passRate = run.pass_rate != null ? (run.pass_rate * 100).toFixed(1) + '%' : '-';
            const s = run.summary || {};
            const planCell = run.config_name
                ? `<span style="background:#e8f4fd;color:#1a5276;padding:2px 8px;border-radius:10px;font-size:12px;white-space:nowrap;">${run.config_name}</span>`
                : `<span style="color:#bbb;font-size:12px;">Quick</span>`;

            let statusCell;
            if (status === 'running') {
                const prog = run.progress || {};
                const done = prog.completed || 0;
                const total = prog.total || 0;
                const pct = total ? Math.round(done / total * 100) : 0;
                statusCell = `<div>
                    <span class="badge badge-running">running</span>
                    <div style="margin-top:4px;background:#e0e0e0;border-radius:3px;height:4px;width:80px;display:inline-block;vertical-align:middle;">
                        <div style="background:#3498db;height:100%;border-radius:3px;width:${pct}%;transition:width .5s;"></div>
                    </div>
                    <span style="font-size:11px;color:#888;margin-left:4px;">${done}/${total}</span>
                </div>`;
            } else {
                statusCell = `<span class="badge badge-${status}">${status}</span>`;
            }

            row.innerHTML = `
                <td>${planCell}</td>
                <td>${run.agent_name || run.agent_id}</td>
                <td>${run.suite_type}</td>
                <td>${statusCell}</td>
                <td>${s.passed || 0}P / ${s.failed || 0}F / ${s.errors || 0}E</td>
                <td>${passRate}</td>
                <td>${run.duration_seconds != null ? run.duration_seconds + 's' : '—'}</td>
                <td style="font-size:12px;">${new Date(run.started_at).toLocaleString()}</td>
                <td><button class="btn small" onclick="viewTestRun('${run.run_id}')" ${status==='running'?'disabled style="opacity:.5"':''}>View</button></td>
            `;
            tbody.appendChild(row);
        });

        if (anyRunning) startRunPolling();
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
            toast(`${data.run_count} test run(s) started`, 'info');
        } else {
            toast(`Test run started — ${data.progress?.total || 0} tests queued`, 'info');
        }
        loadTestRunsPage();
        startRunPolling();
    } catch (e) {
        statusEl.textContent = String(e);
        statusEl.style.color = '#e74c3c';
        btn.disabled = false;
    }
}

// ── Run polling ──────────────────────────────────────────
let _runPollTimer = null;

function startRunPolling() {
    if (_runPollTimer) return;
    _runPollTimer = setInterval(async () => {
        const running = document.querySelectorAll('#test-runs-list tr[data-run-status="running"]');
        if (running.length === 0) {
            clearInterval(_runPollTimer);
            _runPollTimer = null;
            return;
        }
        await loadTestRunsPage();
    }, 2500);
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
    document.getElementById('rc-agent-tags').value = cfg ? (cfg.agent_tags || []).join(', ') : '';
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

    const agentTagsRaw = document.getElementById('rc-agent-tags').value.trim();
    const agent_tags = agentTagsRaw ? agentTagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    const payload = { name, agent_ids: agentIds, agent_tags, suite_types: suiteTypes, tags };
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
                <tr id="rd-${i}" style="display:none;background:#f8f9fa;">
                    <td colspan="6" style="padding:0;">
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid #e0e0e0;">
                            <div style="padding:14px;border-right:1px solid #e0e0e0;">
                                <div style="font-size:10px;font-weight:700;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">Prompt Sent</div>
                                <pre style="background:#fff;border:1px solid #e0e0e0;padding:10px;border-radius:4px;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow-y:auto;margin:0;">${escHtml(r.user_prompt || '')}</pre>
                            </div>
                            <div style="padding:14px;border-right:1px solid #e0e0e0;">
                                <div style="font-size:10px;font-weight:700;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">Expected</div>
                                <pre style="background:#e8f5e9;border:1px solid #c8e6c9;padding:10px;border-radius:4px;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow-y:auto;margin:0;">${escHtml(r.expected_response || '')}</pre>
                            </div>
                            <div style="padding:14px;">
                                <div style="font-size:10px;font-weight:700;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;">Actual${r.score != null ? ` &nbsp;<span style="font-weight:400;color:#3498db;">${(r.score*100).toFixed(0)}% match</span>` : ''}</div>
                                <pre style="background:${r.status==='pass'?'#e8f5e9;border:1px solid #c8e6c9':r.status==='error'?'#fff3e0;border:1px solid #ffe0b2':'#fce4ec;border:1px solid #f8bbd0'};padding:10px;border-radius:4px;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow-y:auto;margin:0;">${escHtml(r.error || r.actual_response || '')}</pre>
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
    const el = document.getElementById('reports-content');
    el.innerHTML = '<p style="color:#888;padding:20px;">Loading...</p>';

    try {
        const runs = await API.get('/test-runs?limit=200');
        if (!runs.length) {
            el.innerHTML = '<p style="color:#888;padding:20px;">No test runs yet.</p>';
            return;
        }

        const completed = runs.filter(r => r.status === 'completed');

        // ── Summary cards ───────────────────────────────────
        const totalRuns   = completed.length;
        const totalTests  = completed.reduce((s, r) => s + (r.summary?.total || 0), 0);
        const totalPassed = completed.reduce((s, r) => s + (r.summary?.passed || 0), 0);
        const totalFailed = completed.reduce((s, r) => s + (r.summary?.failed || 0), 0);
        const avgRate     = totalTests ? (totalPassed / totalTests * 100).toFixed(1) : '-';
        const avgLatency  = completed.reduce((s, r) => s + (r.duration_seconds || 0), 0) / (completed.length || 1);

        // ── Per-agent stats ─────────────────────────────────
        const agentStats = {};
        completed.forEach(r => {
            const k = r.agent_name || r.agent_id;
            if (!agentStats[k]) agentStats[k] = { runs: 0, passed: 0, failed: 0, errors: 0, total: 0 };
            const s = r.summary || {};
            agentStats[k].runs++;
            agentStats[k].passed  += s.passed  || 0;
            agentStats[k].failed  += s.failed  || 0;
            agentStats[k].errors  += s.errors  || 0;
            agentStats[k].total   += s.total   || 0;
        });

        const agentRows = Object.entries(agentStats).map(([name, s]) => {
            const rate = s.total ? (s.passed / s.total * 100).toFixed(1) : '-';
            const color = parseFloat(rate) >= 75 ? '#27ae60' : parseFloat(rate) >= 50 ? '#e67e22' : '#e74c3c';
            return `<tr>
                <td>${escHtml(name)}</td>
                <td>${s.runs}</td>
                <td>${s.total}</td>
                <td style="color:${color};font-weight:600;">${rate}%</td>
                <td>${s.passed}</td>
                <td style="color:#e74c3c;">${s.failed}</td>
                <td style="color:#e67e22;">${s.errors}</td>
            </tr>`;
        }).join('');

        // ── Recent trend (last 10 completed runs) ───────────
        const recent = completed.slice(-10).reverse();
        const trendRows = recent.map(r => {
            const rate = r.pass_rate != null ? (r.pass_rate * 100).toFixed(1) : '-';
            const color = parseFloat(rate) >= 75 ? '#27ae60' : parseFloat(rate) >= 50 ? '#e67e22' : '#e74c3c';
            const s = r.summary || {};
            return `<tr>
                <td style="font-size:12px;">${new Date(r.started_at).toLocaleString()}</td>
                <td>${escHtml(r.agent_name || r.agent_id)}</td>
                <td>${r.suite_type}</td>
                <td>${s.total || 0}</td>
                <td style="color:${color};font-weight:600;">${rate}%</td>
                <td>${r.duration_seconds || 0}s</td>
            </tr>`;
        }).join('');

        el.innerHTML = `
            <div class="stats-grid" style="margin-bottom:24px;">
                <div class="stat-card"><div class="stat-label">Total Runs</div><div class="stat-value">${totalRuns}</div></div>
                <div class="stat-card"><div class="stat-label">Tests Executed</div><div class="stat-value">${totalTests}</div></div>
                <div class="stat-card"><div class="stat-label">Overall Pass Rate</div><div class="stat-value">${avgRate}%</div></div>
                <div class="stat-card"><div class="stat-label">Total Failed</div><div class="stat-value stat-value-red">${totalFailed}</div></div>
            </div>

            <div class="card" style="margin-bottom:20px;">
                <div class="card-header"><h3>Agent Performance</h3></div>
                <div class="card-content" style="padding:0;">
                    <table>
                        <thead><tr><th>Agent</th><th>Runs</th><th>Tests</th><th>Pass Rate</th><th>Passed</th><th>Failed</th><th>Errors</th></tr></thead>
                        <tbody>${agentRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><h3>Recent Runs</h3></div>
                <div class="card-content" style="padding:0;">
                    <table>
                        <thead><tr><th>Time</th><th>Agent</th><th>Suite</th><th>Tests</th><th>Pass Rate</th><th>Duration</th></tr></thead>
                        <tbody>${trendRows}</tbody>
                    </table>
                </div>
            </div>`;
    } catch (e) {
        el.innerHTML = `<p style="color:#e74c3c;padding:20px;">Error: ${e}</p>`;
    }
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
    document.getElementById('agent-tags').value = (agent.tags || []).join(', ');
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
        tags: document.getElementById('agent-tags').value.split(',').map(t => t.trim()).filter(Boolean),
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
        document.getElementById('agent-tags').value = '';
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
    const wrap = document.getElementById('te-agent-wrap');
    wrap.style.display = '';   // always visible — owner when scope=agent, probe target otherwise
    const agentSel = document.getElementById('te-agent');
    agentSel.options[0].text = scope === 'agent' ? 'Select Agent...' : 'Try It against...';
}

function openTestEditor(prefillTest) {
    const inGlobal = window._activeProject === '_global';

    // Populate agent picker
    const agentSel = document.getElementById('te-agent');
    agentSel.innerHTML = '<option value="">Select Agent...</option>';
    (window._agentsCache || []).filter(a => a.agent_id !== '_shared').forEach(a => {
        const o = document.createElement('option');
        o.value = a.agent_id; o.textContent = a.name;
        agentSel.appendChild(o);
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
    const agentId = document.getElementById('te-agent').value;
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
        return projects;
    } catch(e) { console.error(e); return []; }
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

// Init — show Settings if no workspace configured yet
async function init() {
    const projects = await loadProjectsDropdown();

    // First launch: no projects found → open Settings so user can configure data folder or clone a repo
    if (!projects || projects.length === 0) {
        openSettings();
        toast('Welcome! Configure your data folder or clone a project repo to get started.', 'info');
        return;
    }

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
}

init();

// Auto-sync every 5 minutes
setInterval(() => {
    doGitSync();
}, 5 * 60 * 1000);

// ── Settings ──────────────────────────────────────────────

async function openSettings() {
    const overlay = document.getElementById('settings-overlay');
    overlay.style.display = 'block';

    // Load current settings
    const pathEl  = document.getElementById('settings-workspace-path');
    const infoEl  = document.getElementById('settings-current-path');
    const resolved = document.getElementById('settings-workspace-resolved');
    const versionEl = document.getElementById('settings-version');

    if (window.electronAPI) {
        const settings = await window.electronAPI.getSettings();
        const current = await window.electronAPI.getWorkspacePath();
        pathEl.value = settings.workspacesDir || current;
        infoEl.textContent = `Active: ${current}`;
        resolved.textContent = `Active workspace path: ${current}`;

        // Update channel — only meaningful in packaged app
        const channel = settings.updateChannel || 'latest';
        const radio = document.querySelector(`input[name="update-channel"][value="${channel}"]`);
        if (radio) radio.checked = true;
        const channelCard = document.getElementById('update-channel-card');
        if (channelCard) channelCard.style.display = '';
    } else {
        document.getElementById('settings-browse-btn').disabled = true;
        infoEl.textContent = 'Browse requires the desktop app.';
    }

    // Version from package info if available
    try {
        const r = await fetch('/api/settings/app-info');
        if (r.ok) {
            const d = await r.json();
            if (versionEl) versionEl.textContent = `v${d.version}`;
        }
    } catch {}

    loadWorkspaceRepos();
}

// ── Projects table ────────────────────────────────────────
let _reposData  = [];
let _reposSort  = { col: 'name', dir: 1 };

async function loadWorkspaceRepos() {
    const tbody = document.getElementById('repos-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="padding:18px;color:#aaa;text-align:center;">Loading…</td></tr>';

    try {
        const r = await fetch('/api/git/workspace-repos');
        _reposData = r.ok ? await r.json() : [];
    } catch {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:18px;color:#e74c3c;text-align:center;">Failed to load projects.</td></tr>';
        return;
    }

    renderReposTable();
    // Load git status for each repo asynchronously
    _reposData.forEach(repo => { if (repo.isRepo) loadRepoRowStatus(repo.name); });
}

function getFilteredSortedRepos() {
    const q = (document.getElementById('repos-filter')?.value || '').toLowerCase().trim();
    let list = q
        ? _reposData.filter(r => r.name.toLowerCase().includes(q) || (r.remote || '').toLowerCase().includes(q))
        : [..._reposData];
    const { col, dir } = _reposSort;
    list.sort((a, b) => {
        const av = (a[col] || '').toLowerCase();
        const bv = (b[col] || '').toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
    });
    return list;
}

function renderReposTable() {
    const tbody = document.getElementById('repos-tbody');
    if (!tbody) return;
    const list = getFilteredSortedRepos();

    // Update sort indicators
    ['name','branch','remote'].forEach(col => {
        const el = document.getElementById(`sort-ind-${col}`);
        if (el) el.textContent = _reposSort.col === col ? (_reposSort.dir === 1 ? ' ▲' : ' ▼') : '';
    });

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:18px;color:#aaa;text-align:center;">No projects found.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(repo => {
        const sid = repo.name.replace(/[^a-z0-9_-]/gi, '_');
        const remoteShort = repo.remote
            ? repo.remote.replace(/^https?:\/\//, '').replace(/^git@/, '').replace(/.git$/, '')
            : '';

        const branchCell = repo.branch
            ? `<code style="background:#f0f2f5;padding:2px 6px;border-radius:3px;font-size:12px;">${repo.branch}</code>`
            : '<span style="color:#ccc;">—</span>';

        const remoteCell = repo.isRepo
            ? `<span id="remote-display-${sid}" title="${repo.remote || ''}" style="font-size:12px;color:${repo.remote ? '#555' : '#f39c12'};">
                ${repo.remote ? remoteShort : 'none'}
               </span>`
            : '<span style="color:#ccc;">—</span>';

        const statusCell = repo.isRepo
            ? `<span id="status-${sid}" style="font-size:11px;color:#aaa;">…</span>`
            : '<span style="color:#ccc;">—</span>';

        const aheadCell = repo.isRepo && repo.remote
            ? `<span id="ahead-${sid}" style="font-size:11px;color:#aaa;">…</span>`
            : '<span style="color:#ccc;">—</span>';

        let actions;
        if (repo.readOnly) {
            // _global — sync only, no commit/push
            actions = `<button class="btn small" onclick="repoGitOp('sync','${repo.name}','${sid}')"
                    title="Pull latest from continuous.engineering" style="font-size:11px;padding:4px 9px;">&#8595; Sync</button>`;
        } else if (!repo.isRepo) {
            actions = `<button class="btn small" onclick="repoInit('${repo.name}')" style="font-size:11px;padding:4px 9px;">Init Git</button>`;
        } else {
            actions = `
                <button class="btn small" onclick="repoGitOp('sync','${repo.name}','${sid}')"
                    title="Pull &amp; rebase from remote" style="font-size:11px;padding:4px 9px;">&#8595; Sync</button>
                <button class="btn small" onclick="toggleRepoCommit('${sid}')"
                    title="Commit changes" style="font-size:11px;padding:4px 9px;">&#10003; Commit</button>
                <button class="btn small" onclick="repoGitOp('push','${repo.name}','${sid}')"
                    title="Push to remote" style="font-size:11px;padding:4px 9px;"${!repo.remote ? ' disabled' : ''}>&#8593; Push</button>
                <button class="btn small" onclick="toggleRepoRemote('${sid}')"
                    title="${repo.remote ? 'Change remote' : 'Add remote'}" style="font-size:11px;padding:4px 9px;background:#95a5a6;">&#9881;</button>`;
        }

        const rowStyle = `border-bottom:1px solid #f0f0f5;${repo.readOnly ? 'background:#fafbfe;' : ''}`;
        const nameCell = repo.readOnly
            ? `${repo.name} <span title="Managed by continuous.engineering — sync only"
                style="font-size:10px;background:#e8eaf6;color:#5c6bc0;border-radius:3px;padding:1px 5px;font-weight:500;margin-left:4px;">&#128274; managed</span>`
            : repo.name;
        return `
        <tr id="row-${sid}" style="${rowStyle}">
            <td style="padding:9px 12px;font-weight:600;color:#2c3e50;">${nameCell}</td>
            <td style="padding:9px 12px;">${branchCell}</td>
            <td style="padding:9px 12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${remoteCell}</td>
            <td style="padding:9px 12px;text-align:center;">${statusCell}</td>
            <td style="padding:9px 12px;text-align:center;">${aheadCell}</td>
            <td style="padding:9px 12px;text-align:right;white-space:nowrap;">${actions}</td>
        </tr>
        <tr id="inline-${sid}" style="display:none;background:#fafbfc;">
            <td colspan="6" style="padding:8px 14px;">
                <div id="inline-content-${sid}"></div>
            </td>
        </tr>`;
    }).join('');
}

function filterReposTable() { renderReposTable(); }

function sortReposBy(col) {
    if (_reposSort.col === col) _reposSort.dir *= -1;
    else { _reposSort.col = col; _reposSort.dir = 1; }
    renderReposTable();
}

async function loadRepoRowStatus(name) {
    const sid = name.replace(/[^a-z0-9_-]/gi, '_');
    try {
        const r = await fetch('/api/git/info', { headers: { 'X-Project': name } });
        if (!r.ok) return;
        const d = await r.json();

        const statusEl = document.getElementById(`status-${sid}`);
        const aheadEl  = document.getElementById(`ahead-${sid}`);
        if (statusEl) {
            if (d.dirty) {
                statusEl.textContent = 'dirty';
                statusEl.style.color = '#e67e22';
            } else {
                statusEl.textContent = 'clean';
                statusEl.style.color = '#27ae60';
            }
        }
        if (aheadEl) {
            if (d.ahead || d.behind) {
                aheadEl.textContent = `+${d.ahead} -${d.behind}`;
                aheadEl.style.color = d.ahead ? '#3498db' : '#e74c3c';
            } else {
                aheadEl.textContent = '✓';
                aheadEl.style.color = '#27ae60';
            }
        }
    } catch {}
}

function toggleRepoCommit(sid) {
    const row   = document.getElementById(`inline-${sid}`);
    const panel = document.getElementById(`inline-content-${sid}`);
    if (!row || !panel) return;
    const open = row.style.display !== 'none';
    // close all other inlines
    document.querySelectorAll('[id^="inline-"]').forEach(el => {
        if (!el.id.startsWith('inline-content-')) el.style.display = 'none';
    });
    if (!open) {
        const name = sid.replace(/_/g, '-'); // approximate — panel carries data attr
        panel.innerHTML = `
            <div style="display:flex;gap:8px;align-items:center;padding:4px 0;">
                <input type="text" id="commit-msg-${sid}" placeholder="Commit message…"
                    style="flex:1;padding:6px 10px;border:1.5px solid #ddd;border-radius:5px;font-size:13px;font-family:inherit;"
                    data-project="${sid}"
                    onkeydown="if(event.key==='Enter') repoCommit('${sid}')">
                <button class="btn small success" onclick="repoCommit('${sid}')" style="font-size:12px;">Commit</button>
                <button class="btn small" onclick="toggleRepoCommit('${sid}')" style="font-size:12px;">Cancel</button>
                <span id="commit-status-${sid}" style="font-size:12px;color:#888;"></span>
            </div>`;
        row.style.display = '';
        document.getElementById(`commit-msg-${sid}`)?.focus();
    }
}

async function repoCommit(sid) {
    const msgEl = document.getElementById(`commit-msg-${sid}`);
    const msg = msgEl?.value.trim();
    if (!msg) { toast('Enter a commit message', 'warn'); return; }
    const statusEl = document.getElementById(`commit-status-${sid}`);
    if (statusEl) statusEl.textContent = 'committing…';

    // Recover original project name from _reposData using sid match
    const repo = _reposData.find(r => r.name.replace(/[^a-z0-9_-]/gi, '_') === sid);
    if (!repo) return;

    const r = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Project': repo.name },
        body: JSON.stringify({ message: msg }),
    });
    const d = await r.json();
    if (d.success) {
        toast(`Committed: ${repo.name}`, 'success');
        toggleRepoCommit(sid);
        loadRepoRowStatus(repo.name);
    } else {
        if (statusEl) statusEl.textContent = d.output || 'Failed';
        toast(d.output || 'Commit failed', 'error');
    }
}

function toggleRepoRemote(sid) {
    const row   = document.getElementById(`inline-${sid}`);
    const panel = document.getElementById(`inline-content-${sid}`);
    if (!row || !panel) return;
    const open = row.style.display !== 'none';
    document.querySelectorAll('[id^="inline-"]').forEach(el => {
        if (!el.id.startsWith('inline-content-')) el.style.display = 'none';
    });
    if (!open) {
        const repo = _reposData.find(r => r.name.replace(/[^a-z0-9_-]/gi, '_') === sid);
        panel.innerHTML = `
            <div style="display:flex;gap:8px;align-items:center;padding:4px 0;">
                <input type="text" id="remote-input-${sid}" placeholder="https://github.com/org/repo.git"
                    value="${repo?.remote || ''}"
                    style="flex:1;padding:6px 10px;border:1.5px solid #ddd;border-radius:5px;font-size:13px;font-family:inherit;"
                    onkeydown="if(event.key==='Enter') repoSetRemote('${sid}')">
                <button class="btn small success" onclick="repoSetRemote('${sid}')" style="font-size:12px;">Save</button>
                <button class="btn small" onclick="toggleRepoRemote('${sid}')" style="font-size:12px;">Cancel</button>
            </div>`;
        row.style.display = '';
        document.getElementById(`remote-input-${sid}`)?.focus();
    }
}

async function repoSetRemote(sid) {
    const url = document.getElementById(`remote-input-${sid}`)?.value.trim();
    if (!url) { toast('Enter a remote URL', 'warn'); return; }
    const repo = _reposData.find(r => r.name.replace(/[^a-z0-9_-]/gi, '_') === sid);
    if (!repo) return;

    const r = await fetch('/api/git/remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Project': repo.name },
        body: JSON.stringify({ url }),
    });
    const d = await r.json();
    if (d.success) {
        toast(d.output, 'success');
        repo.remote = url;
        toggleRepoRemote(sid);
        renderReposTable();
        loadRepoRowStatus(repo.name);
    } else {
        toast(d.output || 'Failed to set remote', 'error');
    }
}

async function repoInit(projectName) {
    const r = await fetch('/api/git/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Project': projectName },
    });
    const d = await r.json();
    if (d.success) { toast(`Git initialized: ${projectName}`, 'success'); loadWorkspaceRepos(); }
    else toast(d.output || 'Init failed', 'error');
}

async function repoGitOp(op, projectName, sid) {
    const btn = document.querySelector(`#row-${sid} button[onclick*="${op}"]`);
    const origText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    const r = await fetch(`/api/git/${op}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Project': projectName },
        body: JSON.stringify({}),
    });
    const d = await r.json();
    if (btn) { btn.disabled = false; btn.textContent = origText; }

    if (d.success) {
        toast(`${op === 'sync' ? 'Synced' : 'Pushed'}: ${projectName}`, 'success');
        loadRepoRowStatus(projectName);
    } else {
        toast(d.output || `${op} failed`, 'error');
    }
}

// ── Add project (table footer form) ──────────────────────
function toggleAddRepoForm() {
    const form = document.getElementById('add-repo-form');
    if (!form) return;
    const open = form.style.display !== 'none';
    form.style.display = open ? 'none' : 'block';
    if (!open) {
        document.getElementById('new-repo-url').value = '';
        document.getElementById('new-repo-name').value = '';
        const log = document.getElementById('add-repo-log');
        log.style.display = 'none'; log.textContent = '';
        document.getElementById('new-repo-url').focus();
    }
}

function deriveNewRepoName() {
    const url = document.getElementById('new-repo-url').value.trim();
    const nameEl = document.getElementById('new-repo-name');
    if (url && !nameEl.value) {
        nameEl.value = url.split('/').pop().replace(/\.git$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    }
}

async function submitAddRepo() {
    const url  = document.getElementById('new-repo-url').value.trim();
    const name = document.getElementById('new-repo-name').value.trim();
    const btn  = document.getElementById('add-repo-submit-btn');
    const log  = document.getElementById('add-repo-log');

    log.style.display = 'block';

    if (url) {
        // Clone
        btn.disabled = true; btn.textContent = 'Cloning…';
        log.textContent = `Cloning ${url} …\n`;
        try {
            const r = await fetch('/api/git/clone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, project_name: name || undefined }),
            });
            const d = await r.json();
            log.textContent += d.output || '';
            if (d.success) {
                log.textContent += `\n✓ Added "${d.project}"`;
                toast(`Project "${d.project}" cloned`, 'success');
                toggleAddRepoForm();
                await loadWorkspaceRepos();
                await loadProjectsDropdown();
                switchProject(d.project);
            } else {
                toast(d.output || 'Clone failed', 'error');
            }
        } catch (e) {
            log.textContent += `\nError: ${e.message}`;
            toast('Clone failed', 'error');
        } finally {
            btn.disabled = false; btn.textContent = 'Clone & Add';
        }
    } else if (name) {
        // Local init
        log.textContent = `Initializing local project "${name}" …\n`;
        const r = await fetch('/api/git/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Project': name },
        });
        const d = await r.json();
        log.textContent += d.output || '';
        if (d.success) {
            toast(`Project "${name}" initialized`, 'success');
            toggleAddRepoForm();
            await loadWorkspaceRepos();
        } else {
            toast(d.output || 'Init failed', 'error');
        }
    } else {
        toast('Enter a URL to clone, or a project name for a local init', 'warn');
    }
}

function closeSettings() {
    document.getElementById('settings-overlay').style.display = 'none';
}

async function saveUpdateChannel(value) {
    if (!window.electronAPI) return;
    await window.electronAPI.saveSettings({ updateChannel: value });
    const status = document.getElementById('channel-save-status');
    if (status) {
        status.style.display = 'block';
        setTimeout(() => { status.style.display = 'none'; }, 3000);
    }
}

async function browseWorkspaceDir() {
    if (!window.electronAPI) return;
    const folder = await window.electronAPI.openFolderDialog();
    if (folder) {
        document.getElementById('settings-workspace-path').value = folder;
    }
}


async function saveSettings() {
    const workspacesDir = document.getElementById('settings-workspace-path').value.trim();
    if (!workspacesDir) { toast('Enter a workspace path first', 'warn'); return; }

    if (window.electronAPI) {
        await window.electronAPI.saveSettings({ workspacesDir });
    } else {
        await API.post('/settings', { workspacesDir });
    }

    document.getElementById('settings-current-path').textContent = `Active: ${workspacesDir}`;
    const status = document.getElementById('settings-save-status');
    status.style.display = 'inline';
    setTimeout(() => { status.style.display = 'none'; }, 2500);
    toast('Workspace path saved — reloading projects', 'success');

    // Refresh the project dropdown with the new workspace
    setTimeout(() => loadProjectsDropdown(), 300);
}

async function clearWorkspaceDir() {
    if (!await uiConfirm('Reset workspace path to default (app data folder)?', 'Reset', 'danger')) return;
    if (window.electronAPI) {
        await window.electronAPI.saveSettings({ workspacesDir: '' });
    }
    document.getElementById('settings-workspace-path').value = '';
    toast('Reset to default workspace', 'info');
    setTimeout(() => loadProjectsDropdown(), 300);
}

