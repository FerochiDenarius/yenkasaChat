const authToken = localStorage.getItem('authToken') || '';
const userIdInput = document.getElementById('userIdInput');
const queryInput = document.getElementById('queryInput');
const limitInput = document.getElementById('limitInput');
const loadButton = document.getElementById('loadButton');
const systemButton = document.getElementById('systemButton');
const statusLine = document.getElementById('statusLine');
const connectionState = document.getElementById('connectionState');
const scopeState = document.getElementById('scopeState');

const el = (id) => document.getElementById(id);

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function setStatus(message, tone = 'neutral') {
  statusLine.textContent = message;
  statusLine.style.color =
    tone === 'error' ? '#9b1c1c' : tone === 'warn' ? '#a16207' : 'var(--muted)';
}

function fmt(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? `${value}` : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }
  return String(value);
}

function pct(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function duration(value) {
  const ms = Number(value) || 0;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function listToChips(items = [], kind = 'default') {
  if (!items.length) return '<span class="chip">None</span>';
  return items
    .map((item) => {
      const label = typeof item === 'string' ? item : item.label || item.eventType || item.communityId || item.creatorId || item.summary || item.title || 'item';
      return `<span class="chip ${kind}">${escapeHtml(label)}</span>`;
    })
    .join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setMetricCards(cards = []) {
  el('summaryCards').innerHTML = cards
    .map(
      (card) => `
      <article class="metric-card">
        <p class="metric-value">${escapeHtml(card.value)}</p>
        <p class="metric-label">${escapeHtml(card.label)}</p>
        ${card.note ? `<p class="metric-note">${escapeHtml(card.note)}</p>` : ''}
      </article>
    `,
    )
    .join('');
}

function renderKvs(target, entries = []) {
  if (!entries.length) {
    target.innerHTML = '<div class="item"><div class="item-subtitle">No data yet.</div></div>';
    return;
  }
  target.innerHTML = `
    <div class="section-block">
      <div class="kvs">
        ${entries
          .map(
            (entry) => `
            <div class="kv">
              <span>${escapeHtml(entry.label)}</span>
              <strong>${escapeHtml(entry.value)}</strong>
            </div>
          `,
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderList(target, items = [], renderItem) {
  if (!items.length) {
    target.innerHTML = '<div class="item"><div class="item-subtitle">No data yet.</div></div>';
    return;
  }
  target.innerHTML = `<div class="item-list">${items.map(renderItem).join('')}</div>`;
}

function renderJson(target, value) {
  target.innerHTML = `<pre class="json">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

function renderMemoryProfile(data) {
  const profile = data?.profile || {};
  const artifacts = data?.profileArtifacts || {};
  const interestProfile = data?.userInspection?.interestProfile || {};
  const engagementStyle = interestProfile.engagementStyle || {};

  renderKvs(el('memoryProfile'), [
    { label: 'Short-term topics', value: fmt((profile.shortTerm?.activeTopics || []).length) },
    { label: 'Recent context', value: fmt((profile.shortTerm?.recentContext || []).length) },
    { label: 'Stable interests', value: fmt((profile.longTerm?.stableInterests || []).length) },
    { label: 'Creator affinity', value: fmt((profile.longTerm?.creatorAffinity || []).length) },
    { label: 'Memory summaries', value: fmt((profile.memorySummaries || []).length) },
    { label: 'Last consolidated', value: profile.midTerm?.lastConsolidatedAt ? new Date(profile.midTerm.lastConsolidatedAt).toLocaleString() : '—' },
  ]);

  el('memoryProfile').insertAdjacentHTML(
    'beforeend',
    `
      <div class="section-block">
        <p class="section-title">Top interests</p>
        <div class="chip-list">${listToChips(interestProfile.topInterests || [])}</div>
      </div>
      <div class="section-block">
        <p class="section-title">Strongest communities</p>
        <div class="chip-list">${listToChips(interestProfile.strongestCommunities || [])}</div>
      </div>
      <div class="section-block">
        <p class="section-title">Active hours</p>
        <div class="chip-list">${listToChips((interestProfile.activeHours || []).map((entry) => `h${entry.hour}: ${entry.score}`))}</div>
      </div>
      <div class="section-block">
        <p class="section-title">Engagement style</p>
        <pre class="json">${escapeHtml(JSON.stringify(engagementStyle, null, 2))}</pre>
      </div>
      <div class="section-block">
        <p class="section-title">AI profile</p>
        <pre class="json">${escapeHtml(JSON.stringify(artifacts.aiProfile || {}, null, 2))}</pre>
      </div>
    `,
  );
}

function renderSignalCalibration(data) {
  const signal = data?.userInspection?.signalCalibration || data?.system?.eventQuality?.signalCalibration || data?.signalCalibration || {};
  const typeRows = (signal.eventTypes || signal.strongestSignals || []).slice(0, 8);
  el('signalBadge').textContent = `Strength ${fmt(signal.strongestSignals?.[0]?.signalStrengthScore ?? signal.eventTypes?.[0]?.signalStrengthScore ?? 0, '0')}`;
  renderKvs(el('signalCalibration'), [
    { label: 'Total events', value: fmt(signal.totalEvents) },
    { label: 'Duplicate frequency', value: pct(signal.duplicateFrequency || 0) },
    { label: 'Skipped frequency', value: pct(signal.skippedFrequency || 0) },
    { label: 'Failed frequency', value: pct(signal.failedFrequency || 0) },
    { label: 'Spam frequency', value: pct(signal.spamFrequency || 0) },
  ]);
  el('signalCalibration').insertAdjacentHTML(
    'beforeend',
    `
      <div class="section-block">
        <p class="section-title">Strongest signals</p>
        <div class="chip-list">${listToChips(signal.strongestSignals || [])}</div>
      </div>
      <div class="section-block">
        <p class="section-title">Weak signals</p>
        <div class="chip-list">${listToChips(signal.weakSignals || [])}</div>
      </div>
      <div class="section-block">
        <p class="section-title">Noisy signals</p>
        <div class="chip-list">${listToChips(signal.noisySignals || [])}</div>
      </div>
      <div class="section-block">
        <p class="section-title">Event type scores</p>
        <div class="item-list">
          ${(typeRows || [])
            .map(
              (item) => `
                <div class="item">
                  <div class="item-head">
                    <div class="item-title">${escapeHtml(item.eventType || item.label || 'event')}</div>
                    <span class="pill secondary">${pct(item.signalStrengthScore || item.score || 0)}</span>
                  </div>
                  <div class="item-subtitle">Usefulness ${pct(item.eventUsefulnessScore || 0)} • duplicate ${pct(item.duplicateRate || 0)} • spam ${pct(item.spamRate || 0)}</div>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    `,
  );
}

function renderRetrievalQuality(data) {
  const retrieval = data?.userInspection?.retrievalQuality || data?.retrievalQuality || {};
  const matches = retrieval.matches || data?.userInspection?.retrieval?.matches || [];
  el('retrievalBadge').textContent = retrieval.queryLength
    ? `Score ${pct(retrieval.retrievalQualityScore || 0)}`
    : 'No query yet';
  renderKvs(el('retrievalQuality'), [
    { label: 'Quality score', value: pct(retrieval.retrievalQualityScore || 0) },
    { label: 'Relevance', value: pct(retrieval.retrievedMemoryRelevance || 0) },
    { label: 'Latency', value: duration(retrieval.retrievalLatencyMs || 0) },
    { label: 'Duplicate retrievals', value: fmt(retrieval.duplicateRetrievalCount || 0) },
    { label: 'Stale retrievals', value: fmt(retrieval.staleRetrievalCount || 0) },
    { label: 'Low-quality retrievals', value: fmt(retrieval.lowQualityRetrievalCount || 0) },
  ]);
  renderList(el('retrievalMatches'), matches, (item) => `
    <div class="item">
      <div class="item-head">
        <div class="item-title">${escapeHtml(item.title || item.sourceType || 'memory')}</div>
        <span class="pill secondary">${pct(item.retrievalScore || item.blendedScore || item.score || 0)}</span>
      </div>
      <div class="item-subtitle">${escapeHtml(item.text || item.summary || '')}</div>
    </div>
  `);
}

function renderEventQuality(data) {
  const eventQuality = data?.system?.eventQuality || {};
  const duplicate = eventQuality.duplicateSuppression || {};
  const latency = eventQuality.latency || {};
  el('eventBadge').textContent = `${fmt(eventQuality.eventThroughput?.totalEvents || 0)} events`;
  renderKvs(el('eventQuality'), [
    { label: 'Throughput/day', value: fmt(eventQuality.eventThroughput?.throughputPerDay || 0) },
    { label: 'Processed', value: fmt(eventQuality.eventThroughput?.processedCount || 0) },
    { label: 'Failed', value: fmt(eventQuality.eventThroughput?.failedCount || 0) },
    { label: 'Skipped', value: fmt(eventQuality.eventThroughput?.skippedCount || 0) },
    { label: 'Duplicate suppression', value: pct(duplicate.duplicateSuppressionRate || 0) },
    { label: 'Should-embed rate', value: pct(duplicate.shouldEmbedRate || 0) },
    { label: 'Ingestion p95', value: duration(latency.ingestionLatencyMs || 0) },
    { label: 'Processing p95', value: duration(latency.processingLatencyMs || 0) },
    { label: 'Embedding p95', value: duration(latency.embeddingLatencyMs || 0) },
    { label: 'Retrieval p95', value: duration(latency.retrievalLatencyMs || 0) },
  ]);
}

function renderProductionReadiness(data) {
  const report = data?.system?.productionReadiness || {};
  const maturity = report.maturityAssessment || {};
  el('productionBadge').textContent = maturity.readyForLimitedRollout ? 'Limited rollout ready' : 'Tuning required';
  renderList(el('productionReadiness'), [
    ...((report.scalingBottlenecks || []).map((item) => ({
      title: 'Bottleneck',
      subtitle: item,
      tone: 'warn',
    }))),
    ...((report.rolloutStrategy || []).map((item) => ({
      title: 'Rollout',
      subtitle: item,
      tone: 'default',
    }))),
    ...((report.safeProductionChecklist || []).map((item) => ({
      title: 'Checklist',
      subtitle: item,
      tone: 'default',
    }))),
  ], (item) => `
    <div class="item">
      <div class="item-head">
        <div class="item-title">${escapeHtml(item.title)}</div>
        <span class="chip ${item.tone === 'warn' ? 'warn' : ''}">${escapeHtml(item.tone || 'note')}</span>
      </div>
      <div class="item-subtitle">${escapeHtml(item.subtitle)}</div>
    </div>
  `);
}

function renderCostProtection(data) {
  const cost = data?.system?.costProtection || {};
  el('costBadge').textContent = cost.pressureIndicators?.shouldEmbedRate > 0.2 ? 'High pressure' : 'Guarded';
  renderKvs(el('costProtection'), [
    { label: 'Embedding p95', value: duration(cost.pressureIndicators?.embeddingGenerationP95Ms || 0) },
    { label: 'Retrieval p95', value: duration(cost.pressureIndicators?.memoryRetrievalP95Ms || 0) },
    { label: 'Should-embed rate', value: pct(cost.pressureIndicators?.shouldEmbedRate || 0) },
  ]);
  el('costProtection').insertAdjacentHTML(
    'beforeend',
    `
      <div class="section-block">
        <p class="section-title">Embedding throttling</p>
        <div class="item-list">${(cost.embeddingThrottling || []).map((entry) => `<div class="item"><div class="item-subtitle">${escapeHtml(entry)}</div></div>`).join('')}</div>
      </div>
      <div class="section-block">
        <p class="section-title">Memory batching</p>
        <div class="item-list">${(cost.memoryBatching || []).map((entry) => `<div class="item"><div class="item-subtitle">${escapeHtml(entry)}</div></div>`).join('')}</div>
      </div>
      <div class="section-block">
        <p class="section-title">Retrieval caching</p>
        <div class="item-list">${(cost.retrievalCaching || []).map((entry) => `<div class="item"><div class="item-subtitle">${escapeHtml(entry)}</div></div>`).join('')}</div>
      </div>
      <div class="section-block">
        <p class="section-title">Event rate controls</p>
        <div class="item-list">${(cost.eventRateControls || []).map((entry) => `<div class="item"><div class="item-subtitle">${escapeHtml(entry)}</div></div>`).join('')}</div>
      </div>
    `,
  );
}

function renderMemoryOptimization(data) {
  const strategy = data?.system?.memoryOptimization || {};
  el('memoryBadge').textContent = `Cache hits ${fmt(strategy.sampleEmbeddingCacheHits || 0)}`;
  renderList(el('memoryOptimization'), [
    ...((strategy.staleMemoryCleanup || []).map((item) => ({ title: 'Cleanup', subtitle: item }))),
    ...((strategy.rollingSummaries || []).map((item) => ({ title: 'Rolling', subtitle: item }))),
    ...((strategy.duplicateMemoryMerging || []).map((item) => ({ title: 'Merge', subtitle: item }))),
    ...((strategy.lowQualityPruning || []).map((item) => ({ title: 'Prune', subtitle: item }))),
    ...((strategy.retentionPolicies || []).map((item) => ({ title: 'Retention', subtitle: item }))),
    ...((strategy.archivalLogic || []).map((item) => ({ title: 'Archive', subtitle: item }))),
  ], (item) => `
    <div class="item">
      <div class="item-head">
        <div class="item-title">${escapeHtml(item.title)}</div>
        <span class="chip">policy</span>
      </div>
      <div class="item-subtitle">${escapeHtml(item.subtitle)}</div>
    </div>
  `);
}

function renderRawData(data) {
  const recentEvents = data?.recentEvents || [];
  const recentLogs = data?.recentLogs || [];
  const recentEmbeddings = data?.recentEmbeddings || [];
  const failedEmbeddings = data?.failedEmbeddings || [];
  const chatSummaries = data?.recentChatSummaries || [];

  renderList(el('recentEvents'), recentEvents.slice(0, 18), (item) => `
    <div class="item">
      <div class="item-head">
        <div class="item-title">${escapeHtml(item.eventType || 'event')}</div>
        <span class="pill secondary">${pct(item.signalStrengthScore || item.importanceScore || 0)}</span>
      </div>
      <div class="item-subtitle">${escapeHtml(item.normalizedText || item.importanceReason || '')}</div>
    </div>
  `);

  renderList(el('recentLogs'), recentLogs.slice(0, 12), (item) => `
    <div class="item">
      <div class="item-head">
        <div class="item-title">${escapeHtml(item.stage || 'log')}</div>
        <span class="chip ${item.level === 'error' ? 'danger' : item.level === 'warn' ? 'warn' : ''}">${escapeHtml(item.level || 'info')}</span>
      </div>
      <div class="item-subtitle">${escapeHtml(item.message || '')}</div>
    </div>
  `);

  renderList(el('recentEmbeddings'), recentEmbeddings.slice(0, 12), (item) => `
    <div class="item">
      <div class="item-head">
        <div class="item-title">${escapeHtml(item.title || item.sourceType || 'embedding')}</div>
        <span class="pill secondary">${escapeHtml(item.status || 'ready')}</span>
      </div>
      <div class="item-subtitle">${escapeHtml(item.text || '')}</div>
    </div>
  `);

  renderList(el('failedEmbeddings'), failedEmbeddings.slice(0, 12), (item) => `
    <div class="item">
      <div class="item-head">
        <div class="item-title">${escapeHtml(item.title || item.sourceType || 'failed embedding')}</div>
        <span class="chip danger">failed</span>
      </div>
      <div class="item-subtitle">${escapeHtml(item.metadata?.error || item.status || '')}</div>
    </div>
  `);

  renderList(el('recentChatSummaries'), chatSummaries.slice(0, 8), (item) => `
    <div class="item">
      <div class="item-head">
        <div class="item-title">${escapeHtml(item.conversationId || 'summary')}</div>
        <span class="pill secondary">${escapeHtml(item.embeddingStatus || 'pending')}</span>
      </div>
      <div class="item-subtitle">${escapeHtml(item.summary || '')}</div>
    </div>
  `);
}

function updateMeta(data) {
  connectionState.textContent = authToken ? 'Authenticated' : 'Missing auth token';
  scopeState.textContent = data?.scope === 'user' ? 'User scope' : 'System scope';
  el('userLabel').textContent = data?.user ? `${data.user.displayName || data.user.username || data.user.id}` : 'No user selected';
}

async function loadInspector({ userId = '', query = '', limit = 30 } = {}) {
  const params = new URLSearchParams();
  if (userId.trim()) params.set('userId', userId.trim());
  if (query.trim()) params.set('query', query.trim());
  if (limit) params.set('limit', String(limit));

  const url = `/api/yme/admin/inspector${params.toString() ? `?${params.toString()}` : ''}`;
  setStatus('Loading inspector data...');
  loadButton.disabled = true;
  systemButton.disabled = true;

  try {
    if (!authToken) {
      throw new Error('No auth token found in localStorage.');
    }

    const response = await fetch(url, {
      headers: {
        ...authHeaders(),
      },
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || `Request failed with status ${response.status}`);
    }

    updateMeta(payload);
    setStatus(`Loaded ${payload.scope === 'user' ? 'user' : 'system'} view successfully.`, 'neutral');

    const readiness = payload.system?.productionReadiness || {};
    const quality = payload.system?.eventQuality || {};
    const retrieval = payload.userInspection?.retrievalQuality || {};
    const signal = payload.userInspection?.signalCalibration || payload.system?.eventQuality?.signalCalibration || {};

    setMetricCards([
      { label: 'Maturity', value: readiness.maturityAssessment?.stage || 'Unknown', note: readiness.maturityAssessment?.readyForLimitedRollout ? 'Limited rollout ready' : 'Needs tuning' },
      { label: 'Queue backlog', value: fmt(Object.values(payload.system?.queueHealth?.queues || {}).reduce((sum, counts) => sum + (Number(counts.waiting || 0) || 0), 0)), note: 'Waiting jobs' },
      { label: 'Retrieval quality', value: query.trim() ? pct(retrieval.retrievalQualityScore || 0) : 'No query', note: 'Memory quality over volume' },
      { label: 'Signal strength', value: pct(signal.strongestSignals?.[0]?.signalStrengthScore || signal.eventTypes?.[0]?.signalStrengthScore || 0), note: 'Best current event type' },
    ]);

    renderMemoryProfile(payload);
    renderSignalCalibration(payload);
    renderRetrievalQuality(payload);
    renderEventQuality(payload);
    renderProductionReadiness(payload);
    renderCostProtection(payload);
    renderMemoryOptimization(payload);
    renderRawData(payload);

    if (payload.userInspection?.retrieval) {
      el('retrievalBadge').textContent = `Score ${pct(payload.userInspection.retrievalQuality?.retrievalQualityScore || 0)}`;
    }
  } catch (error) {
    setStatus(error.message, 'error');
    el('summaryCards').innerHTML = '';
    renderKvs(el('memoryProfile'), [{ label: 'Error', value: error.message }]);
    renderKvs(el('signalCalibration'), [{ label: 'Error', value: error.message }]);
    renderKvs(el('retrievalQuality'), [{ label: 'Error', value: error.message }]);
    renderKvs(el('eventQuality'), [{ label: 'Error', value: error.message }]);
    renderKvs(el('productionReadiness'), [{ label: 'Error', value: error.message }]);
    renderKvs(el('costProtection'), [{ label: 'Error', value: error.message }]);
    renderKvs(el('memoryOptimization'), [{ label: 'Error', value: error.message }]);
    renderList(el('recentEvents'), [], () => '');
    renderList(el('retrievalMatches'), [], () => '');
    renderList(el('recentLogs'), [], () => '');
    renderList(el('recentEmbeddings'), [], () => '');
    renderList(el('failedEmbeddings'), [], () => '');
    renderList(el('recentChatSummaries'), [], () => '');
  } finally {
    loadButton.disabled = false;
    systemButton.disabled = false;
  }
}

loadButton.addEventListener('click', () => {
  loadInspector({
    userId: userIdInput.value,
    query: queryInput.value,
    limit: Number(limitInput.value || 30),
  });
});

systemButton.addEventListener('click', () => {
  userIdInput.value = '';
  loadInspector({
    userId: '',
    query: '',
    limit: Number(limitInput.value || 30),
  });
});

if (authToken) {
  loadInspector({ limit: Number(limitInput.value || 30) });
} else {
  setStatus('Set `authToken` in localStorage, then load the inspector.', 'warn');
}
