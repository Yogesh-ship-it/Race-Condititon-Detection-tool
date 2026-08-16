/**
 * RaceGuard Dashboard Interactive Application Logic
 * Implements Execution Timeline Animation, SVG Conflict Arcs, Sub-Tabs,
 * and Bernstein / Lockset Concurrency Engine Visualizations.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global Application State
  const state = {
    activeTab: 'design',
    activeSubtab: 'timeline',
    currentScenario: 'counter',
    isFixedMode: false,
    variables: ['counter'],
    threads: [],
    presets: [],
    lastDetectionResult: null,
    currentStep: 'all',
    autoPlayTimer: null,
    threadColors: ['#a855f7', '#06b6d4', '#ec4899', '#eab308', '#10b981', '#f59e0b'],
    activeExportLang: 'c',
    generatedCode: { c_code: '', python_code: '', c_instructions: '', py_instructions: '' }
  };

  // DOM Selectors
  const elements = {
    // Navigation Tabs
    navTabs: document.querySelectorAll('.nav-tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    subnavTabs: document.querySelectorAll('.subnav-tab'),
    subtabContents: document.querySelectorAll('.subtab-content'),

    // Action Buttons
    btnReset: document.getElementById('btn-reset'),
    btnDetect: document.getElementById('btn-detect'),
    fixModeToggle: document.getElementById('fix-mode-toggle'),

    // Design Tab Elements
    presetsContainer: document.getElementById('presets-container'),
    variablesList: document.getElementById('variables-list'),
    formAddVar: document.getElementById('form-add-var'),
    inputNewVar: document.getElementById('input-new-var'),
    threadsContainer: document.getElementById('threads-container'),
    btnAddThread: document.getElementById('btn-add-thread'),

    // Results Summary & Metrics
    summaryRaceCount: document.getElementById('summary-race-count'),
    summaryRacePlural: document.getElementById('summary-race-plural'),
    summaryThreadCount: document.getElementById('summary-thread-count'),
    summaryVarCount: document.getElementById('summary-var-count'),
    metricThreads: document.getElementById('metric-threads'),
    metricVars: document.getElementById('metric-vars'),
    metricRaces: document.getElementById('metric-races'),
    metricProtected: document.getElementById('metric-protected'),

    // Timeline Controls & Matrix Grid
    btnCtrlPrev: document.getElementById('btn-ctrl-prev'),
    btnCtrlAll: document.getElementById('btn-ctrl-all'),
    btnCtrlNext: document.getElementById('btn-ctrl-next'),
    btnCtrlAuto: document.getElementById('btn-ctrl-auto'),
    timelineMatrixWrapper: document.getElementById('timeline-matrix-wrapper'),
    timelineMatrix: document.getElementById('timeline-matrix'),
    timelineSvgOverlay: document.getElementById('timeline-svg-overlay'),

    // Heatmap & Reports & State Tracker
    heatmapGrid: document.getElementById('heatmap-grid'),
    reportsContainer: document.getElementById('reports-container'),
    varStatesCards: document.getElementById('var-states-cards'),
    varStatesHistory: document.getElementById('var-states-history'),

    // Code Exporter Elements
    btnLangC: document.getElementById('btn-lang-c'),
    btnLangPy: document.getElementById('btn-lang-py'),
    btnCopyCode: document.getElementById('btn-copy-code'),
    btnDownloadCode: document.getElementById('btn-download-code'),
    terminalCmd: document.getElementById('terminal-cmd'),
    codeFileTitle: document.getElementById('code-file-title'),
    codeModeBadge: document.getElementById('code-mode-badge'),
    codeEditorContent: document.getElementById('code-editor-content'),

    // Bottom Alert & How It Works
    bottomRaceCard: document.getElementById('bottom-race-card'),
    bottomRaceText: document.getElementById('bottom-race-text'),
    howItWorksHeader: document.getElementById('how-it-works-header'),
    howItWorksBody: document.getElementById('how-it-works-body')
  };

  // --- Initialize Application ---
  async function init() {
    setupEventListeners();
    await fetchPresetsList();
    await loadScenario('counter', false);
    await runDetection();
  }

  // --- Setup Event Listeners ---
  function setupEventListeners() {
    // Navigation Tabs (Design / Results / Learn)
    elements.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
      });
    });

    // Sub-Tabs (Timeline / Heatmap / Report)
    elements.subnavTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        switchSubtab(tab.dataset.subtab);
      });
    });

    // Reset Action
    elements.btnReset.addEventListener('click', async () => {
      stopAutoPlay();
      elements.fixModeToggle.checked = false;
      state.isFixedMode = false;
      await loadScenario('counter', false);
      runDetection();
    });

    // Detect Races Action
    elements.btnDetect.addEventListener('click', async () => {
      await runDetection();
      switchTab('results');
      switchSubtab('timeline');
    });

    // Mutex Fix Mode Toggle
    elements.fixModeToggle.addEventListener('change', async (e) => {
      state.isFixedMode = e.target.checked;
      if (state.currentScenario) {
        await loadScenario(state.currentScenario, state.isFixedMode);
        runDetection();
      }
    });

    // Shared Variable Form
    elements.formAddVar.addEventListener('submit', (e) => {
      e.preventDefault();
      const newVar = elements.inputNewVar.value.trim().toLowerCase();
      if (newVar && !state.variables.includes(newVar)) {
        state.variables.push(newVar);
        elements.inputNewVar.value = '';
        renderVariablesBar();
        renderThreads();
      }
    });

    // Add Thread Action
    elements.btnAddThread.addEventListener('click', () => {
      const threadIndex = state.threads.length + 1;
      const newThread = {
        id: `th_${Date.now()}`,
        name: `Thread ${String.fromCharCode(64 + threadIndex)}`,
        events: [
          {
            id: `ev_${Date.now()}_1`,
            timestamp: 1,
            variable_name: state.variables[0] || 'var',
            operation: 'read',
            locks_held: []
          }
        ]
      };
      state.threads.push(newThread);
      renderThreads();
    });

    // Code Exporter Language Switcher
    if (elements.btnLangC) {
      elements.btnLangC.addEventListener('click', () => {
        state.activeExportLang = 'c';
        renderGeneratedCode();
      });
    }
    if (elements.btnLangPy) {
      elements.btnLangPy.addEventListener('click', () => {
        state.activeExportLang = 'python';
        renderGeneratedCode();
      });
    }

    // Code Exporter Copy to Clipboard
    if (elements.btnCopyCode) {
      elements.btnCopyCode.addEventListener('click', () => {
        const textToCopy = elements.codeEditorContent ? elements.codeEditorContent.textContent : '';
        if (textToCopy) {
          navigator.clipboard.writeText(textToCopy);
          const origText = elements.btnCopyCode.innerHTML;
          elements.btnCopyCode.innerHTML = '<span>✓</span> Copied!';
          setTimeout(() => {
            elements.btnCopyCode.innerHTML = origText;
          }, 2000);
        }
      });
    }

    // Code Exporter Download File
    if (elements.btnDownloadCode) {
      elements.btnDownloadCode.addEventListener('click', () => {
        const textToDownload = elements.codeEditorContent ? elements.codeEditorContent.textContent : '';
        const fileName = state.activeExportLang === 'c' ? 'race_demo.c' : 'race_demo.py';
        if (textToDownload) {
          const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      });
    }

    // Timeline Step Controls
    elements.btnCtrlPrev.addEventListener('click', () => {
      stopAutoPlay();
      stepTimeline(-1);
    });

    elements.btnCtrlNext.addEventListener('click', () => {
      stopAutoPlay();
      stepTimeline(1);
    });

    elements.btnCtrlAll.addEventListener('click', () => {
      stopAutoPlay();
      setTimelineStep('all');
    });

    elements.btnCtrlAuto.addEventListener('click', () => {
      toggleAutoPlay();
    });

    // How It Works Toggle
    if (elements.howItWorksHeader && elements.howItWorksBody) {
      elements.howItWorksHeader.addEventListener('click', () => {
        const isHidden = elements.howItWorksBody.style.display === 'none';
        elements.howItWorksBody.style.display = isHidden ? 'block' : 'none';
        const icon = elements.howItWorksHeader.querySelector('.toggle-icon');
        if (icon) icon.innerText = isHidden ? '▲' : '▼';
      });
    }

    // Window Resize -> Redraw SVG Arcs
    window.addEventListener('resize', () => {
      if (state.activeTab === 'results' && state.activeSubtab === 'timeline') {
        drawTimelineArcs();
      }
    });
  }

  // --- Navigation Helpers ---
  function switchTab(tabName) {
    state.activeTab = tabName;
    elements.navTabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    elements.tabContents.forEach(content => {
      if (content.id === `tab-${tabName}`) {
        content.style.display = 'block';
      } else {
        content.style.display = 'none';
      }
    });

    if (tabName === 'results') {
      setTimeout(() => {
        drawTimelineArcs();
      }, 50);
    }
  }

  function switchSubtab(subtabName) {
    state.activeSubtab = subtabName;
    elements.subnavTabs.forEach(tab => {
      if (tab.dataset.subtab === subtabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    elements.subtabContents.forEach(content => {
      if (content.id === `subtab-${subtabName}`) {
        content.style.display = 'block';
      } else {
        content.style.display = 'none';
      }
    });

    if (subtabName === 'timeline') {
      setTimeout(() => {
        drawTimelineArcs();
      }, 50);
    } else if (subtabName === 'codeexport') {
      fetchGeneratedCode();
    }
  }

  async function fetchGeneratedCode() {
    const allEvents = [];
    state.threads.forEach(t => {
      t.events.forEach(ev => {
        allEvents.push({
          id: ev.id,
          thread_id: t.name,
          variable_name: ev.variable_name,
          operation: ev.operation,
          timestamp: parseInt(ev.timestamp) || 1,
          locks_held: ev.locks_held || []
        });
      });
    });

    try {
      const res = await fetch('/api/export-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: allEvents,
          variables: state.variables,
          is_fixed: state.isFixedMode
        })
      });
      const data = await res.json();
      state.generatedCode = data;
      renderGeneratedCode();
    } catch (err) {
      console.error('Failed to generate code:', err);
    }
  }

  function renderGeneratedCode() {
    if (!elements.codeEditorContent) return;

    if (elements.codeModeBadge) {
      elements.codeModeBadge.innerText = state.isFixedMode ? 'MUTEX FIXED MODE' : 'BUGGY MODE';
      elements.codeModeBadge.className = `code-mode-badge ${state.isFixedMode ? 'fixed' : ''}`;
    }

    if (state.activeExportLang === 'c') {
      if (elements.btnLangC) elements.btnLangC.classList.add('active');
      if (elements.btnLangPy) elements.btnLangPy.classList.remove('active');
      if (elements.codeFileTitle) elements.codeFileTitle.innerText = 'race_demo.c';
      if (elements.terminalCmd) elements.terminalCmd.innerText = state.generatedCode.c_instructions || 'gcc -pthread race_demo.c -o race_demo && ./race_demo';
      if (elements.codeEditorContent) elements.codeEditorContent.textContent = state.generatedCode.c_code || '// Generating C code...';
    } else {
      if (elements.btnLangPy) elements.btnLangPy.classList.add('active');
      if (elements.btnLangC) elements.btnLangC.classList.remove('active');
      if (elements.codeFileTitle) elements.codeFileTitle.innerText = 'race_demo.py';
      if (elements.terminalCmd) elements.terminalCmd.innerText = state.generatedCode.py_instructions || 'python race_demo.py';
      if (elements.codeEditorContent) elements.codeEditorContent.textContent = state.generatedCode.python_code || '# Generating Python code...';
    }
  }

  // --- API Functions ---
  async function fetchPresetsList() {
    try {
      const res = await fetch('/api/scenarios');
      const data = await res.json();
      state.presets = data.scenarios || [];
      renderPresets();
    } catch (err) {
      console.error('Failed to fetch scenarios:', err);
    }
  }

  async function loadScenario(scenarioId, isFixed) {
    try {
      state.currentScenario = scenarioId;
      const res = await fetch(`/api/scenarios/${scenarioId}?fixed=${isFixed}`);
      const data = await res.json();

      state.variables = data.variables || ['var'];

      // Group events by thread
      const threadsMap = {};
      (data.events || []).forEach(ev => {
        const tName = ev.thread_id;
        if (!threadsMap[tName]) {
          threadsMap[tName] = {
            id: `th_${tName.replace(/\s+/g, '_')}`,
            name: tName,
            events: []
          };
        }
        threadsMap[tName].events.push({
          id: ev.id,
          timestamp: ev.timestamp,
          variable_name: ev.variable_name,
          operation: ev.operation,
          locks_held: ev.locks_held || []
        });
      });

      state.threads = Object.values(threadsMap);

      renderPresets();
      renderVariablesBar();
      renderThreads();
    } catch (err) {
      console.error(`Failed to load scenario ${scenarioId}:`, err);
    }
  }

  async function runDetection() {
    const allEvents = [];
    state.threads.forEach(t => {
      t.events.forEach(ev => {
        allEvents.push({
          id: ev.id,
          thread_id: t.name,
          variable_name: ev.variable_name,
          operation: ev.operation,
          timestamp: parseInt(ev.timestamp) || 1,
          locks_held: ev.locks_held
        });
      });
    });

    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: allEvents })
      });
      const data = await res.json();
      state.lastDetectionResult = data;
      renderResults(data);
      fetchGeneratedCode();
    } catch (err) {
      console.error('Detection failed:', err);
    }
  }

  function triggerPresetAnimation() {
    if (elements.threadsContainer) {
      elements.threadsContainer.classList.remove('preset-updated-anim');
      void elements.threadsContainer.offsetWidth; // force reflow
      elements.threadsContainer.classList.add('preset-updated-anim');
    }
    if (elements.variablesList) {
      elements.variablesList.classList.remove('preset-updated-anim');
      void elements.variablesList.offsetWidth;
      elements.variablesList.classList.add('preset-updated-anim');
    }
  }

  // --- Render UI Components ---

  // 1. Preset Cards
  function renderPresets() {
    elements.presetsContainer.innerHTML = '';

    // Custom icon blocks matching Image 1
    const iconTemplates = {
      counter: `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:2px; width:20px; height:20px; font-weight:800; font-size:0.65rem; color:#38bdf8; align-items:center; justify-items:center;">
          <span>1</span><span>2</span><span>3</span><span>4</span>
        </div>`,
      bank_transfer: `<span style="font-size:1.2rem;">🏦</span>`,
      producer_consumer: `<span style="font-size:1.2rem;">📦</span>`,
      reader_writer: `<span style="font-size:1.2rem;">📖</span>`
    };

    state.presets.forEach(p => {
      const isSelected = p.id === state.currentScenario;
      const card = document.createElement('div');
      card.className = `preset-card ${isSelected ? 'active' : ''}`;
      card.innerHTML = `
        <div class="preset-icon-box">${iconTemplates[p.id] || '⚡'}</div>
        <h3>${p.title}</h3>
        <p>${p.subtitle}</p>
      `;

      card.addEventListener('click', async () => {
        stopAutoPlay();
        card.classList.add('preset-card-clicked');
        setTimeout(() => card.classList.remove('preset-card-clicked'), 350);

        await loadScenario(p.id, state.isFixedMode);
        runDetection();
        triggerPresetAnimation();
      });

      elements.presetsContainer.appendChild(card);
    });
  }

  // 2. Variables Bar
  function renderVariablesBar() {
    elements.variablesList.innerHTML = '';
    state.variables.forEach(varName => {
      const chip = document.createElement('div');
      chip.className = 'var-chip';
      chip.innerHTML = `
        <span>${varName}</span>
        <button title="Remove Variable">&times;</button>
      `;
      chip.querySelector('button').addEventListener('click', () => {
        if (state.variables.length > 1) {
          state.variables = state.variables.filter(v => v !== varName);
          renderVariablesBar();
          renderThreads();
        }
      });
      elements.variablesList.appendChild(chip);
    });
  }

  // 3. Thread Designer
  function renderThreads() {
    elements.threadsContainer.innerHTML = '';

    state.threads.forEach((thread, threadIdx) => {
      const dotColor = state.threadColors[threadIdx % state.threadColors.length];
      const card = document.createElement('div');
      card.className = 'thread-card';

      // Header
      const header = document.createElement('div');
      header.className = 'thread-header';
      header.innerHTML = `
        <div class="thread-name">
          <span class="thread-dot" style="background: ${dotColor};"></span>
          <input type="text" class="input-sm" value="${thread.name}" style="font-weight: 700; width: 140px; background: transparent; border: none; color: #fff;">
        </div>
        <button class="btn-del-thread" title="Delete Thread">✕</button>
      `;

      header.querySelector('input').addEventListener('change', (e) => {
        thread.name = e.target.value.trim() || `Thread ${threadIdx + 1}`;
      });

      header.querySelector('.btn-del-thread').addEventListener('click', () => {
        state.threads.splice(threadIdx, 1);
        renderThreads();
      });

      card.appendChild(header);

      // Events List
      const eventsList = document.createElement('div');
      eventsList.className = 'events-list';

      thread.events.forEach((ev, evIdx) => {
        const row = document.createElement('div');
        row.className = 'event-row';

        const varOptions = state.variables.map(v =>
          `<option value="${v}" ${v === ev.variable_name ? 'selected' : ''}>${v}</option>`
        ).join('');

        const locksStr = (ev.locks_held || []).join(', ');

        row.innerHTML = `
          <div style="font-family: var(--font-mono); color: var(--text-dim); font-size: 0.8rem;">
            t<input type="number" class="input-sm" value="${ev.timestamp}" min="1" max="99" style="width: 44px; text-align: center; padding: 0.15rem;">
          </div>

          <select class="op-select">
            <option value="read" ${ev.operation === 'read' ? 'selected' : ''}>READ</option>
            <option value="write" ${ev.operation === 'write' ? 'selected' : ''}>WRITE</option>
            <option value="lock" ${ev.operation === 'lock' ? 'selected' : ''}>LOCK</option>
            <option value="unlock" ${ev.operation === 'unlock' ? 'selected' : ''}>UNLOCK</option>
          </select>

          <select class="var-select">${varOptions}</select>

          <div style="font-size: 0.75rem; color: #a7f3d0; font-family: var(--font-mono);">
            🔒 <input type="text" class="input-sm" value="${locksStr}" placeholder="lock" style="width: 75px; padding: 0.15rem 0.3rem; font-size: 0.72rem;">
          </div>

          <button class="btn-del-event" title="Remove Step">✕</button>
        `;

        row.querySelector('input[type="number"]').addEventListener('change', (e) => {
          ev.timestamp = parseInt(e.target.value) || 1;
        });

        row.querySelector('.op-select').addEventListener('change', (e) => {
          ev.operation = e.target.value;
        });

        row.querySelector('.var-select').addEventListener('change', (e) => {
          ev.variable_name = e.target.value;
        });

        row.querySelector('input[placeholder="lock"]').addEventListener('change', (e) => {
          const raw = e.target.value;
          ev.locks_held = raw.split(',').map(l => l.trim()).filter(l => l);
        });

        row.querySelector('.btn-del-event').addEventListener('click', () => {
          thread.events.splice(evIdx, 1);
          renderThreads();
        });

        eventsList.appendChild(row);
      });

      card.appendChild(eventsList);

      // Add Operation Button
      const btnAddEv = document.createElement('button');
      btnAddEv.className = 'btn-add-op';
      btnAddEv.innerHTML = '+ Add Operation';
      btnAddEv.addEventListener('click', () => {
        const lastStep = thread.events.length ? Math.max(...thread.events.map(e => e.timestamp)) + 1 : 1;
        thread.events.push({
          id: `ev_${Date.now()}_${thread.events.length + 1}`,
          timestamp: lastStep,
          variable_name: state.variables[0] || 'var',
          operation: 'read',
          locks_held: []
        });
        renderThreads();
      });

      card.appendChild(btnAddEv);
      elements.threadsContainer.appendChild(card);
    });
  }

  // 4. Render Results (Metrics, Timeline, Heatmap, Reports)
  function renderResults(data) {
    const summary = data.summary || {};
    const totalRaces = summary.total_races || 0;
    const totalThreads = summary.threads_involved_count || state.threads.length || 0;
    const totalVars = summary.variables_affected_count || state.variables.length || 0;
    const safeCount = summary.safe_count || 0;

    // Summary Banner
    elements.summaryRaceCount.innerText = totalRaces;
    if (elements.summaryRacePlural) elements.summaryRacePlural.innerText = totalRaces === 1 ? '' : 's';
    elements.summaryThreadCount.innerText = totalThreads;
    elements.summaryVarCount.innerText = totalVars;

    // Metrics Grid
    elements.metricThreads.innerText = totalThreads;
    elements.metricVars.innerText = totalVars;
    elements.metricRaces.innerText = totalRaces;
    elements.metricProtected.innerText = safeCount;

    // Bottom Race Alert
    if (elements.bottomRaceText) {
      elements.bottomRaceText.innerText = totalRaces === 0
        ? 'No race conditions detected! Accesses are synchronized.'
        : `${totalRaces} race condition${totalRaces === 1 ? '' : 's'} detected!`;
    }

    // Render Timeline Matrix Grid
    renderTimelineMatrix(data);

    // Render Heatmap Grid
    renderHeatmap(data.heatmap);

    // Render Reports
    renderReports(data.races);

    // Render Live Variable State Tracker
    renderVariableStates(data.variable_states);
  }

  // --- Render Live Variable State Tracker Cards & History Table ---
  function renderVariableStates(variableStates) {
    if (!elements.varStatesCards || !elements.varStatesHistory) return;
    elements.varStatesCards.innerHTML = '';
    elements.varStatesHistory.innerHTML = '';

    if (!variableStates || Object.keys(variableStates).length === 0) {
      elements.varStatesCards.innerHTML = '<div style="color: var(--text-dim); padding: 1rem;">No variable state data available.</div>';
      return;
    }

    // 1. Render Summary Cards for each variable
    Object.keys(variableStates).forEach(varName => {
      const varData = variableStates[varName] || {};
      const finalActual = varData.final_actual ?? 0;
      const finalExpected = varData.final_expected ?? 0;
      const hasDivergence = varData.has_divergence ?? false;
      const steps = varData.steps || [];

      const corruptedSteps = steps.filter(s => s.is_corrupted);
      let badgeClass = 'synchronized';
      let badgeText = '✅ Synchronized';
      let statusText = 'Memory access is synchronized. Actual memory value matches expected value.';

      if (corruptedSteps.length > 0) {
        const firstAnomaly = corruptedSteps[0].anomaly_type;
        if (firstAnomaly === 'LOST_UPDATE') {
          badgeClass = 'lost-update';
          badgeText = '⚠️ Lost Update';
          statusText = corruptedSteps[0].explanation;
        } else {
          badgeClass = 'dirty-read';
          badgeText = '⚠️ Stale Read';
          statusText = corruptedSteps[0].explanation;
        }
      }

      const card = document.createElement('div');
      card.className = `var-state-card ${hasDivergence ? 'corrupted' : 'synchronized'}`;
      card.id = `var_state_card_${varName}`;

      card.innerHTML = `
        <div class="var-card-header">
          <div class="var-card-title">
            <span>📦</span>
            <span>${varName}</span>
          </div>
          <div class="var-card-badge ${badgeClass}">${badgeText}</div>
        </div>

        <div class="var-values-box">
          <div class="value-stat">
            <div class="stat-label">ACTUAL VALUE</div>
            <div class="stat-val actual ${hasDivergence ? 'corrupted' : ''}" id="val_actual_${varName}">
              ${finalActual}
            </div>
          </div>
          <div class="value-stat">
            <div class="stat-label">EXPECTED VALUE</div>
            <div class="stat-val expected" id="val_expected_${varName}">
              ${finalExpected}
            </div>
          </div>
        </div>

        <div class="var-status-banner ${hasDivergence ? 'corrupted' : 'synchronized'}">
          <span>${hasDivergence ? '⚠️' : '✅'}</span>
          <span>${statusText}</span>
        </div>
      `;

      elements.varStatesCards.appendChild(card);
    });

    // 2. Render History Table across execution steps
    const historyCard = document.createElement('div');
    historyCard.className = 'state-history-card';

    const historyHeader = document.createElement('div');
    historyHeader.className = 'state-history-header';
    historyHeader.innerHTML = `<span>📈</span> <span>Step-by-Step Memory Mutation History</span>`;
    historyCard.appendChild(historyHeader);

    const table = document.createElement('table');
    table.className = 'state-history-table';

    let tableHeaderHtml = `
      <thead>
        <tr>
          <th>Step</th>
          <th>Variable</th>
          <th>Thread Operations</th>
          <th>Actual Value</th>
          <th>Expected Value</th>
          <th>Memory Status</th>
        </tr>
      </thead>
      <tbody>
    `;

    let tableBodyHtml = '';

    Object.keys(variableStates).forEach(varName => {
      const varData = variableStates[varName] || {};
      (varData.steps || []).forEach(st => {
        const opsStr = st.operations && st.operations.length
          ? st.operations.map(o => {
              const lockInfo = o.locks_held && o.locks_held.length ? `🔒 [${o.locks_held.join(',')}]` : '⚠️ Unlocked';
              return `<strong>${o.thread_id}</strong> (${o.op} ${lockInfo})`;
            }).join(' | ')
          : '<span style="color: var(--text-dim);">Idle</span>';

        const rowClass = st.is_corrupted ? 'step-row-corrupted' : '';
        const statusBadge = st.is_corrupted
          ? `<span class="badge critical" style="font-size:0.7rem; padding:0.15rem 0.4rem;">${st.anomaly_type}</span>`
          : `<span class="badge safe" style="font-size:0.7rem; padding:0.15rem 0.4rem;">SYNCHRONIZED</span>`;

        tableBodyHtml += `
          <tr class="${rowClass}" data-step="${st.step}">
            <td><strong style="color: #38bdf8;">t${st.step}</strong></td>
            <td><code class="code-cyan">${varName}</code></td>
            <td>${opsStr}</td>
            <td><strong class="${st.is_corrupted ? 'critical' : 'cyan'}" style="font-family: var(--font-mono);">${st.actual_value}</strong></td>
            <td><strong class="safe" style="font-family: var(--font-mono);">${st.expected_value}</strong></td>
            <td>${statusBadge}</td>
          </tr>
        `;
      });
    });

    table.innerHTML = tableHeaderHtml + tableBodyHtml + `</tbody>`;
    historyCard.appendChild(table);
    elements.varStatesHistory.appendChild(historyCard);
  }

  // --- Render Execution Timeline Matrix & SVG Arcs ---
  function renderTimelineMatrix(data) {
    elements.timelineMatrix.innerHTML = '';

    const heatmap = data.heatmap || {};
    const timestamps = heatmap.timestamps || [1, 2];
    const races = data.races || [];

    // Header Row with Step Columns (t1, t2, t3...)
    const headerRow = document.createElement('div');
    headerRow.className = 'timeline-header-row';

    // Blank corner cell for thread label column
    const cornerCell = document.createElement('div');
    cornerCell.className = 'timeline-header-cell';
    cornerCell.style.width = '150px';
    headerRow.appendChild(cornerCell);

    timestamps.forEach(ts => {
      const cell = document.createElement('div');
      cell.className = 'timeline-header-cell';
      cell.innerText = `t${ts}`;
      headerRow.appendChild(cell);
    });

    elements.timelineMatrix.appendChild(headerRow);

    // Build event lookup map: [thread_id][timestamp] -> event
    const eventMap = {};
    state.threads.forEach(t => {
      eventMap[t.name] = {};
      t.events.forEach(ev => {
        eventMap[t.name][ev.timestamp] = ev;
      });
    });

    // Identify which event IDs are involved in races
    const raceEventIds = new Set();
    races.forEach(r => {
      (r.event_ids || []).forEach(eid => raceEventIds.add(eid));
    });

    // Thread Rows
    state.threads.forEach((thread, threadIdx) => {
      const dotColor = state.threadColors[threadIdx % state.threadColors.length];
      const row = document.createElement('div');
      row.className = 'timeline-row';

      // Left Thread Label Card
      const labelCell = document.createElement('div');
      labelCell.className = 'timeline-thread-label';
      labelCell.innerHTML = `
        <div class="thread-label-title">
          <span class="thread-dot" style="background: ${dotColor};"></span>
          <span>${thread.name}</span>
        </div>
        <div class="thread-label-ops">${thread.events.length} ops</div>
      `;
      row.appendChild(labelCell);

      // Step Cells
      timestamps.forEach(ts => {
        const stepCell = document.createElement('div');
        stepCell.className = 'timeline-step-cell';
        stepCell.dataset.step = ts;

        const ev = eventMap[thread.name] ? eventMap[thread.name][ts] : null;

        if (ev) {
          const isRace = raceEventIds.has(ev.id);
          const opCard = document.createElement('div');
          opCard.className = `op-card ${isRace ? 'is-race' : ''}`;
          opCard.id = `opcard_${ev.id}`;
          opCard.dataset.eventId = ev.id;
          opCard.dataset.step = ts;

          const opType = (ev.operation || 'read').toUpperCase();
          const opClass = (ev.operation || 'read').toLowerCase();

          opCard.innerHTML = `
            ${isRace ? '<span class="race-badge-lightning">⚡</span>' : ''}
            <div class="op-card-type ${opClass}">${opType}</div>
            <div class="op-card-var">${ev.variable_name}</div>
          `;

          stepCell.appendChild(opCard);
        }

        row.appendChild(stepCell);
      });

      elements.timelineMatrix.appendChild(row);
    });

    // Draw SVG conflict arcs after DOM updates
    setTimeout(() => {
      drawTimelineArcs();
    }, 60);
  }

  // --- SVG Curved Conflict Arc Drawing Engine ---
  function drawTimelineArcs() {
    if (!elements.timelineSvgOverlay || !elements.timelineMatrixWrapper) return;
    elements.timelineSvgOverlay.innerHTML = '';

    const data = state.lastDetectionResult;
    if (!data || !data.races || data.races.length === 0) return;

    const wrapperRect = elements.timelineMatrixWrapper.getBoundingClientRect();
    elements.timelineSvgOverlay.setAttribute('width', wrapperRect.width);
    elements.timelineSvgOverlay.setAttribute('height', wrapperRect.height);

    data.races.forEach((race) => {
      const e1_id = race.event_ids[0];
      const e2_id = race.event_ids[1];

      const el1 = document.getElementById(`opcard_${e1_id}`);
      const el2 = document.getElementById(`opcard_${e2_id}`);

      if (!el1 || !el2) return;

      // Filter step visibility if step playback is active
      if (state.currentStep !== 'all') {
        const s1 = parseInt(el1.dataset.step);
        const s2 = parseInt(el2.dataset.step);
        if (s1 !== state.currentStep && s2 !== state.currentStep) return;
      }

      const r1 = el1.getBoundingClientRect();
      const r2 = el2.getBoundingClientRect();

      const x1 = r1.left + r1.width / 2 - wrapperRect.left;
      const y1 = r1.top + r1.height / 2 - wrapperRect.top;
      const x2 = r2.left + r2.width / 2 - wrapperRect.left;
      const y2 = r2.top + r2.height / 2 - wrapperRect.top;

      // Calculate smooth quadratic curve
      const dx = x2 - x1;
      const dy = y2 - y1;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2 - Math.max(35, Math.abs(dx) * 0.25);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`);
      path.setAttribute('class', 'race-arc-path');

      elements.timelineSvgOverlay.appendChild(path);
    });
  }

  // --- Step-by-Step Animation Controls ---
  function setTimelineStep(step) {
    state.currentStep = step;

    const allBtns = [elements.btnCtrlPrev, elements.btnCtrlAll, elements.btnCtrlNext];
    allBtns.forEach(b => b.classList.remove('active'));

    if (step === 'all') {
      elements.btnCtrlAll.classList.add('active');
    }

    const stepCells = document.querySelectorAll('.timeline-step-cell');
    stepCells.forEach(cell => {
      const cellStep = parseInt(cell.dataset.step);
      if (step === 'all' || cellStep === step) {
        cell.style.opacity = '1';
        cell.style.transform = 'scale(1)';
      } else {
        cell.style.opacity = '0.35';
        cell.style.transform = 'scale(0.95)';
      }
    });

    // Also sync Live State Tracker table rows
    const historyRows = document.querySelectorAll('.state-history-table tr[data-step]');
    historyRows.forEach(row => {
      const rowStep = parseInt(row.dataset.step);
      if (step === 'all' || rowStep === step) {
        row.classList.add('step-row-active');
        row.style.opacity = '1';
      } else {
        row.classList.remove('step-row-active');
        row.style.opacity = '0.4';
      }
    });

    drawTimelineArcs();
  }

  function stepTimeline(direction) {
    const data = state.lastDetectionResult;
    const timestamps = (data && data.heatmap && data.heatmap.timestamps) ? data.heatmap.timestamps : [1, 2];

    if (state.currentStep === 'all') {
      state.currentStep = direction > 0 ? timestamps[0] : timestamps[timestamps.length - 1];
    } else {
      let currentIdx = timestamps.indexOf(state.currentStep);
      if (currentIdx === -1) currentIdx = 0;
      let nextIdx = currentIdx + direction;
      if (nextIdx >= timestamps.length) nextIdx = 0;
      if (nextIdx < 0) nextIdx = timestamps.length - 1;
      state.currentStep = timestamps[nextIdx];
    }

    setTimelineStep(state.currentStep);
  }

  function toggleAutoPlay() {
    if (state.autoPlayTimer) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
  }

  function startAutoPlay() {
    stopAutoPlay();
    elements.btnCtrlAuto.innerHTML = '❚❚ Pause';
    elements.btnCtrlAuto.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';

    if (state.currentStep === 'all') {
      stepTimeline(1);
    }

    state.autoPlayTimer = setInterval(() => {
      stepTimeline(1);
    }, 1200);
  }

  function stopAutoPlay() {
    if (state.autoPlayTimer) {
      clearInterval(state.autoPlayTimer);
      state.autoPlayTimer = null;
    }
    if (elements.btnCtrlAuto) {
      elements.btnCtrlAuto.innerHTML = '► Auto';
      elements.btnCtrlAuto.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
    }
  }

  // --- Render Heatmap ---
  function renderHeatmap(heatmap) {
    elements.heatmapGrid.innerHTML = '';
    if (!heatmap || !heatmap.variables || !heatmap.variables.length) {
      elements.heatmapGrid.innerHTML = '<div style="color: var(--text-dim); padding: 1rem;">No heatmap data available.</div>';
      return;
    }

    const { variables, timestamps, grid } = heatmap;

    // Header Row with Step Badges
    const headerRow = document.createElement('div');
    headerRow.className = 'heatmap-row heatmap-header-row';
    headerRow.innerHTML = `
      <div class="heatmap-label" style="color: var(--text-muted); font-size: 0.8rem;">Var \\ Step</div>
      <div class="heatmap-cells">
        ${timestamps.map(step => `
          <div class="heatmap-header-cell">
            <span class="heatmap-step-badge">STEP ${step}</span>
          </div>
        `).join('')}
      </div>
    `;
    elements.heatmapGrid.appendChild(headerRow);

    variables.forEach(varName => {
      const row = document.createElement('div');
      row.className = 'heatmap-row';

      const label = document.createElement('div');
      label.className = 'heatmap-label';
      label.innerText = varName;
      row.appendChild(label);

      const cellsContainer = document.createElement('div');
      cellsContainer.className = 'heatmap-cells';

      timestamps.forEach(step => {
        const eventsAtStep = (grid[varName] && grid[varName][step]) ? grid[varName][step] : [];
        const cell = document.createElement('div');

        if (eventsAtStep.length === 0) {
          cell.className = 'heatmap-cell empty';
          cell.innerHTML = `<span class="heatmap-empty-dash">—</span>`;
        } else {
          const hasCrit = eventsAtStep.some(e => e.severity === 'CRITICAL');
          const hasWarn = eventsAtStep.some(e => e.severity === 'WARNING');

          let cellClass = 'heatmap-cell';
          if (hasCrit) cellClass += ' critical';
          else if (hasWarn) cellClass += ' warning';

          cell.className = cellClass;

          const itemsHtml = eventsAtStep.map(ev => {
            const opClass = ev.operation.toLowerCase();
            const locksTag = (ev.locks_held && ev.locks_held.length)
              ? `<span class="lock-status locked">🔒 ${ev.locks_held.join(', ')}</span>`
              : `<span class="lock-status unlocked">⚠️ Unlocked</span>`;

            return `
              <div class="heatmap-op-item">
                <div class="heatmap-op-header">
                  <span class="heatmap-op-type ${opClass}">${ev.operation.toUpperCase()}</span>
                  <span class="heatmap-thread-name">${ev.thread_id}</span>
                </div>
                <div class="heatmap-op-lock">${locksTag}</div>
              </div>
            `;
          }).join('');

          cell.innerHTML = itemsHtml;
        }

        cellsContainer.appendChild(cell);
      });

      row.appendChild(cellsContainer);
      elements.heatmapGrid.appendChild(row);
    });
  }

  // --- Render Reports ---
  function renderReports(races) {
    elements.reportsContainer.innerHTML = '';
    if (!races || races.length === 0) {
      elements.reportsContainer.innerHTML = `
        <div class="report-card" style="border-left-color: var(--safe-green); background: linear-gradient(90deg, var(--safe-bg) 0%, var(--bg-card) 100%); text-align: center; padding: 2rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
          <h3 style="color: var(--safe-green); font-size: 1.2rem; font-weight: 700;">No Race Conditions Detected</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">
            All concurrent accesses to shared variables are properly synchronized using mutual exclusion locks.
          </p>
        </div>
      `;
    } else {
      races.forEach(race => {
        const card = document.createElement('div');
        const isCrit = race.conflict_type === 'CRITICAL';
        card.className = `report-card ${isCrit ? 'critical' : 'warning'}`;
        card.innerHTML = `
          <div class="report-header">
            <div class="report-title">
              <span class="badge ${isCrit ? 'critical' : 'warning'}">${race.conflict_type}</span>
              <span>Variable: <strong style="color: #38bdf8;">${race.variable_name}</strong></span>
              <span style="color: var(--text-dim); font-size: 0.85rem;">[${race.operation_pair}]</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);">
              Steps: ${race.timestamps.join(', ')}
            </div>
          </div>
          <div class="report-desc">${race.explanation}</div>
          <div class="report-meta">
            <span>Threads Involved: ${race.threads.join(' ↔ ')}</span>
            <span>Flagged by: ${race.algorithms.join(', ')}</span>
          </div>
        `;
        elements.reportsContainer.appendChild(card);
      });
    }
  }

  // --- Run Initialization ---
  init();
});
