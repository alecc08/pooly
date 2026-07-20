/**
 * homepool Lovelace card.
 *
 * Hand-written vanilla ES module — no build step, no lit, no dependencies.
 * Mirrors the "Deep Ocean" param-tile look of the homepool web app: a mono
 * value, unit, status rail/dot, ideal range, and a "measured N days ago"
 * readout, sourced from the homepool sensor entities' `status` /
 * `ideal_min` / `ideal_max` / `date` attributes (apps/api/main.py's
 * ParamValueOut). Those attributes are optional — a server predating them
 * simply omits the keys, and every tile below degrades to a neutral (no
 * status dot) display when they're missing.
 */

const FIELD_SUFFIXES = {
  ph: 'ph',
  chlorine: 'chlorine',
  bromine: 'bromine',
  tac: 'tac',
  hardness: 'hardness',
  salt: 'salt',
  stabilizer: 'stabilizer_cya',
  cc: 'combined_chlorine',
  temp: 'temperature',
};

const BUTTON_SUFFIXES = {
  'Cartridge cleaning': 'log_cartridge_cleaning',
  'Skimmer filter cleaning': 'log_skimmer_filter_cleaning',
  Backwash: 'log_backwash',
  'pH calibration': 'log_ph_calibration',
  Purge: 'log_purge',
  'Water change': 'log_water_change',
};

const DUE_SUFFIXES = {
  ph_measurement: 'days_until_ph_measurement_due',
  filter_maintenance: 'days_until_filter_maintenance_due',
};

const STRINGS = {
  en: {
    title: 'homepool',
    ideal: 'ideal',
    measured_today: 'measured today',
    measured_yesterday: 'measured yesterday',
    measured_days_ago: (n) => `measured ${n} days ago`,
    never_measured: 'never measured',
    no_data: 'No homepool entities found for this card configuration.',
    due_ph: 'pH measurement',
    due_filter: 'Filter maintenance',
    due_today: 'due today',
    due_overdue: (n) => `overdue by ${n}d`,
    due_in: (n) => `due in ${n}d`,
    quick_add: 'Quick add',
    log_measurement: 'Log measurement',
    save: 'Save',
    cancel: 'Cancel',
  },
  fr: {
    title: 'homepool',
    ideal: 'idéal',
    measured_today: "mesuré aujourd'hui",
    measured_yesterday: 'mesuré hier',
    measured_days_ago: (n) => `mesuré il y a ${n} jours`,
    never_measured: 'jamais mesuré',
    no_data: 'Aucune entité homepool trouvée pour cette configuration.',
    due_ph: 'Mesure du pH',
    due_filter: 'Entretien du filtre',
    due_today: "aujourd'hui",
    due_overdue: (n) => `en retard de ${n}j`,
    due_in: (n) => `dans ${n}j`,
    quick_add: 'Ajout rapide',
    log_measurement: 'Enregistrer une mesure',
    save: 'Enregistrer',
    cancel: 'Annuler',
  },
};

function t(hass, key, ...args) {
  const lang = (hass && hass.language && hass.language.startsWith('fr')) ? 'fr' : 'en';
  const entry = STRINGS[lang][key] ?? STRINGS.en[key];
  return typeof entry === 'function' ? entry(...args) : entry;
}

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr + 'T00:00:00Z').getTime();
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((todayUtc - then) / 86400000);
}

function statusColor(status) {
  if (status === 'ok') return 'var(--homepool-ok, #3FB68B)';
  if (status === 'warn') return 'var(--homepool-warn, #D9A13B)';
  if (status === 'danger') return 'var(--homepool-danger, #E5645F)';
  return 'var(--homepool-border, #1E2630)';
}

function fmtValue(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

class HomepoolCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: 'custom:homepool-card',
      title: 'homepool',
      entity_prefix: 'sensor.my_pool',
      installation_id: 1,
      show_buttons: true,
      show_due: true,
    };
  }

  setConfig(config) {
    if (!config || !config.entity_prefix) {
      throw new Error('homepool-card: `entity_prefix` is required (e.g. sensor.my_pool)');
    }
    this._config = {
      title: config.title ?? 'homepool',
      entity_prefix: config.entity_prefix,
      installation_id: config.installation_id ?? null,
      show_buttons: config.show_buttons !== false,
      show_due: config.show_due !== false,
      parameters: config.parameters ?? null,
    };
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._formOpen = false;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 4;
  }

  _entityId(base) {
    return `${this._config.entity_prefix}_${base}`;
  }

  _paramEntities() {
    const hass = this._hass;
    if (!hass) return [];
    const fields = this._config.parameters && this._config.parameters.length
      ? this._config.parameters
      : Object.keys(FIELD_SUFFIXES);
    return fields
      .filter((f) => FIELD_SUFFIXES[f])
      .map((f) => ({ field: f, entityId: this._entityId(FIELD_SUFFIXES[f]) }))
      .filter((e) => hass.states[e.entityId] !== undefined);
  }

  _buttonEntities() {
    const hass = this._hass;
    if (!hass) return [];
    return Object.entries(BUTTON_SUFFIXES)
      .map(([label, suffix]) => ({
        label,
        entityId: `button.${this._config.entity_prefix.replace(/^sensor\./, '')}_${suffix}`,
      }))
      .filter((e) => hass.states[e.entityId] !== undefined);
  }

  _dueEntities() {
    const hass = this._hass;
    if (!hass) return [];
    return Object.entries(DUE_SUFFIXES)
      .map(([key, suffix]) => ({ key, entityId: this._entityId(suffix) }))
      .filter((e) => hass.states[e.entityId] !== undefined);
  }

  _pressButton(entityId) {
    this._hass.callService('button', 'press', { entity_id: entityId });
  }

  _submitForm(values) {
    if (!this._config.installation_id) return;
    const data = { installation_id: this._config.installation_id };
    for (const [k, v] of Object.entries(values)) {
      if (v !== '' && v !== null && v !== undefined) data[k] = parseFloat(v);
    }
    this._hass.callService('homepool', 'log_measurement', data);
    this._formOpen = false;
    this._render();
  }

  _render() {
    const hass = this._hass;
    const config = this._config;
    if (!hass || !config || !this.shadowRoot) return;

    const params = this._paramEntities();
    const buttons = config.show_buttons ? this._buttonEntities() : [];
    const dues = config.show_due ? this._dueEntities() : [];

    if (params.length === 0 && buttons.length === 0) {
      this.shadowRoot.innerHTML = `
        ${this._styles()}
        <ha-card>
          <div class="hp-header">${config.title}</div>
          <div class="hp-empty">${t(hass, 'no_data')}</div>
        </ha-card>
      `;
      return;
    }

    const tilesHtml = params.map(({ field, entityId }) => {
      const st = hass.states[entityId];
      const attrs = st.attributes || {};
      const value = parseFloat(st.state);
      const unit = attrs.unit_of_measurement || '';
      const status = attrs.status || null;
      const rail = statusColor(status);
      const idealLine = (attrs.ideal_min !== undefined && attrs.ideal_max !== undefined)
        ? `<div class="hp-ideal">${t(hass, 'ideal')} ${fmtValue(attrs.ideal_min)}–${fmtValue(attrs.ideal_max)}</div>`
        : '';
      const da = daysAgo(attrs.date);
      const measuredLine = da === null ? ''
        : `<div class="hp-measured">${
            da === 0 ? t(hass, 'measured_today')
            : da === 1 ? t(hass, 'measured_yesterday')
            : t(hass, 'measured_days_ago', da)
          }</div>`;
      return `
        <div class="hp-tile" style="--hp-rail:${rail}">
          <div class="hp-tile-top">
            <span class="hp-label">${attrs.friendly_name ? attrs.friendly_name.replace(/^.*?\s/, '') : field}</span>
            ${status ? `<span class="hp-dot" style="background:${rail}"></span>` : ''}
          </div>
          <div class="hp-value-row">
            <span class="hp-value">${fmtValue(value)}</span>
            ${unit ? `<span class="hp-unit">${unit}</span>` : ''}
          </div>
          ${idealLine}
          ${measuredLine}
        </div>
      `;
    }).join('');

    const dueHtml = dues.map(({ key, entityId }) => {
      const st = hass.states[entityId];
      const days = st.state === 'unavailable' || st.state === 'unknown' ? null : parseFloat(st.state);
      if (days === null) return '';
      const label = key === 'ph_measurement' ? t(hass, 'due_ph') : t(hass, 'due_filter');
      const overdue = days < 0;
      const dueSoon = days >= 0 && days <= 3;
      const chipClass = overdue ? 'hp-chip-danger' : dueSoon ? 'hp-chip-warn' : 'hp-chip-neutral';
      const text = overdue ? t(hass, 'due_overdue', Math.abs(Math.round(days)))
        : days === 0 ? t(hass, 'due_today')
        : t(hass, 'due_in', Math.round(days));
      return `<span class="hp-chip ${chipClass}">${label}: ${text}</span>`;
    }).join('');

    const buttonsHtml = buttons.map(({ label, entityId }) => `
      <button class="hp-btn" data-entity="${entityId}">${
        (hass.states[entityId] && hass.states[entityId].attributes.friendly_name || label).replace(/^.*?\s/, '')
      }</button>
    `).join('');

    const formHtml = this._formOpen ? this._formHtml(hass) : '';

    this.shadowRoot.innerHTML = `
      ${this._styles()}
      <ha-card>
        <div class="hp-header">
          <span>${config.title}</span>
        </div>
        ${dueHtml ? `<div class="hp-due-row">${dueHtml}</div>` : ''}
        ${params.length ? `<div class="hp-grid">${tilesHtml}</div>` : ''}
        ${buttons.length ? `
          <div class="hp-section-label">${t(hass, 'quick_add')}</div>
          <div class="hp-buttons">
            ${buttonsHtml}
            ${config.installation_id ? `<button class="hp-btn hp-btn-accent" id="hp-form-toggle">${t(hass, 'log_measurement')}</button>` : ''}
          </div>
        ` : ''}
        ${formHtml}
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll('.hp-btn[data-entity]').forEach((btn) => {
      btn.addEventListener('click', () => this._pressButton(btn.dataset.entity));
    });
    const toggle = this.shadowRoot.getElementById('hp-form-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        this._formOpen = !this._formOpen;
        this._render();
      });
    }
    const formEl = this.shadowRoot.getElementById('hp-form');
    if (formEl) {
      formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = new FormData(formEl);
        this._submitForm(Object.fromEntries(data.entries()));
      });
      const cancelBtn = this.shadowRoot.getElementById('hp-form-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', () => { this._formOpen = false; this._render(); });
    }
  }

  _formHtml(hass) {
    const fields = [
      ['ph', 'pH'],
      ['chlorine', 'Cl'],
      ['bromine', 'Br'],
      ['tac', 'TAC'],
      ['temp', 'T°'],
    ];
    return `
      <form id="hp-form" class="hp-form">
        <div class="hp-form-grid">
          ${fields.map(([name, label]) => `
            <label class="hp-form-field">
              <span>${label}</span>
              <input name="${name}" type="number" step="0.1" inputmode="decimal" />
            </label>
          `).join('')}
        </div>
        <div class="hp-form-actions">
          <button type="button" id="hp-form-cancel" class="hp-btn">${t(hass, 'cancel')}</button>
          <button type="submit" class="hp-btn hp-btn-accent">${t(hass, 'save')}</button>
        </div>
      </form>
    `;
  }

  _styles() {
    return `
      <style>
        :host {
          --hp-bg: var(--card-background-color, #11161D);
          --hp-bg-2: var(--secondary-background-color, #0D1218);
          --hp-border: var(--divider-color, #1E2630);
          --hp-text: var(--primary-text-color, #E6EDF3);
          --hp-text-muted: var(--secondary-text-color, #8B98A9);
          --hp-accent: var(--accent-color, #22D3EE);
        }
        ha-card {
          background: var(--hp-bg);
          color: var(--hp-text);
          padding: 12px 14px 14px;
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
        }
        .hp-header {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .hp-empty {
          color: var(--hp-text-muted);
          font-size: 13px;
          padding: 8px 0;
        }
        .hp-due-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .hp-chip {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 999px;
          font-family: monospace;
        }
        .hp-chip-neutral { background: var(--hp-bg-2); color: var(--hp-text-muted); }
        .hp-chip-warn { background: rgba(217,161,59,0.15); color: #D9A13B; }
        .hp-chip-danger { background: rgba(229,100,95,0.15); color: #E5645F; }
        .hp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 8px;
          margin-bottom: 8px;
        }
        .hp-tile {
          position: relative;
          background: var(--hp-bg-2);
          border: 1px solid var(--hp-border);
          border-radius: 10px;
          padding: 8px 10px 8px 12px;
          overflow: hidden;
        }
        .hp-tile::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: var(--hp-rail, transparent);
        }
        .hp-tile-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .hp-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--hp-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .hp-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .hp-value-row {
          display: flex;
          align-items: baseline;
          gap: 3px;
          margin: 4px 0 2px;
        }
        .hp-value {
          font-family: monospace;
          font-size: 19px;
          font-weight: 600;
        }
        .hp-unit {
          font-family: monospace;
          font-size: 10px;
          color: var(--hp-text-muted);
        }
        .hp-ideal, .hp-measured {
          font-family: monospace;
          font-size: 9px;
          color: var(--hp-text-muted);
        }
        .hp-section-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--hp-text-muted);
          margin: 10px 0 6px;
        }
        .hp-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .hp-btn {
          font-size: 12px;
          font-weight: 500;
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid var(--hp-border);
          background: var(--hp-bg-2);
          color: var(--hp-text);
          cursor: pointer;
        }
        .hp-btn-accent {
          background: var(--hp-accent);
          color: #06181D;
          border: none;
          font-weight: 700;
        }
        .hp-form {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--hp-border);
        }
        .hp-form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
          gap: 6px;
          margin-bottom: 10px;
        }
        .hp-form-field {
          display: flex;
          flex-direction: column;
          gap: 3px;
          font-size: 10px;
          color: var(--hp-text-muted);
        }
        .hp-form-field input {
          font-family: monospace;
          font-size: 13px;
          padding: 5px 6px;
          border-radius: 6px;
          border: 1px solid var(--hp-border);
          background: var(--hp-bg-2);
          color: var(--hp-text);
        }
        .hp-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
      </style>
    `;
  }
}

class HomepoolCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const c = this._config || {};
    this.shadowRoot.innerHTML = `
      <style>
        .row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
        label { font-size: 12px; font-weight: 600; }
        input { padding: 6px 8px; font-size: 13px; }
      </style>
      <div class="row">
        <label>Title</label>
        <input id="title" value="${c.title ?? ''}" />
      </div>
      <div class="row">
        <label>Entity prefix (e.g. sensor.my_pool)</label>
        <input id="entity_prefix" value="${c.entity_prefix ?? ''}" />
      </div>
      <div class="row">
        <label>Installation ID (for the log-measurement form)</label>
        <input id="installation_id" type="number" value="${c.installation_id ?? ''}" />
      </div>
      <div class="row">
        <label><input id="show_buttons" type="checkbox" ${c.show_buttons !== false ? 'checked' : ''} /> Show quick-add buttons</label>
      </div>
      <div class="row">
        <label><input id="show_due" type="checkbox" ${c.show_due !== false ? 'checked' : ''} /> Show due chips</label>
      </div>
    `;
    ['title', 'entity_prefix'].forEach((id) => {
      this.shadowRoot.getElementById(id).addEventListener('input', (e) => this._update(id, e.target.value));
    });
    this.shadowRoot.getElementById('installation_id').addEventListener('input', (e) => {
      this._update('installation_id', e.target.value ? parseInt(e.target.value, 10) : null);
    });
    ['show_buttons', 'show_due'].forEach((id) => {
      this.shadowRoot.getElementById(id).addEventListener('change', (e) => this._update(id, e.target.checked));
    });
  }

  _update(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
  }
}

HomepoolCard.getConfigElement = () => document.createElement('homepool-card-editor');

customElements.define('homepool-card', HomepoolCard);
customElements.define('homepool-card-editor', HomepoolCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'homepool-card',
  name: 'homepool',
  description: 'Water chemistry status board for a homepool installation.',
  preview: false,
});
