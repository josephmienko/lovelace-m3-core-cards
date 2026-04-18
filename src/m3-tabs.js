class M3Tabs extends HTMLElement {
  static _nextId = 0;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._instanceId = ++M3Tabs._nextId;
    this._boundInputChange = this._handleInputChange.bind(this);
    this._boundLabelKeydown = this._handleLabelKeydown.bind(this);
    this._materialRetryTimer = null;
  }

  setConfig(config) {
    if (!config?.entity) {
      throw new Error("m3-tabs requires an entity");
    }
    if (!Array.isArray(config.tabs) || config.tabs.length === 0) {
      throw new Error("m3-tabs requires a non-empty tabs array");
    }

    this._config = {
      entity: String(config.entity),
      variant: config.variant === "secondary" ? "secondary" : "primary",
      indicatorWidth: String(config.indicator_width || "48px"),
      tabs: config.tabs.map((tab) => {
        if (!tab?.value || !tab?.label) {
          throw new Error("Each tab requires value and label");
        }
        return {
          value: String(tab.value),
          label: String(tab.label),
          option: tab.option == null || tab.option === "" ? "" : String(tab.option),
          icon: tab.icon ? String(tab.icon) : "",
          badge: tab.badge == null || tab.badge === "" ? "" : String(tab.badge),
        };
      }),
    };

    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 1;
  }

  static getStubConfig() {
    return {
      type: "custom:m3-tabs",
      entity: "input_select.camera_tab",
      tabs: [
        { value: "Summary", label: "Summary", icon: "mdi:view-quilt" },
        { value: "Front", label: "Front", icon: "mdi:door" },
        { value: "Back", label: "Back", icon: "mdi:forest" },
      ],
    };
  }

  _activeValue() {
    if (!this._config) {
      return "";
    }
    if (!this._hass) {
      return this._config.tabs[0]?.value || "";
    }
    const currentState = this._hass.states[this._config.entity]?.state || "";
    const activeTab = this._resolvedTabs().find(
      (tab) => tab.optionValue === currentState
        || tab.value === currentState
        || tab.label === currentState
    );
    return activeTab?.value || this._config.tabs[0]?.value || "";
  }

  async _selectValue(value) {
    if (!value || !this._hass || !this._config) {
      return;
    }

    const tab = this._resolvedTabs().find((item) => item.value === value);
    const option = tab?.optionValue || value;

    await this._hass.callService(
      "input_select",
      "select_option",
      { option },
      { entity_id: this._config.entity }
    );
  }

  async _handleInputChange(event) {
    const input = event.currentTarget;
    if (!input?.checked) {
      return;
    }
    await this._selectValue(input.dataset.value);
  }

  async _handleLabelKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    const label = event.currentTarget;
    const inputId = label?.getAttribute("for");
    const input = inputId ? this.shadowRoot.getElementById(inputId) : null;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    input.checked = true;
    this._syncAriaFromInputs();
    await this._selectValue(input.dataset.value);
  }

  _escape(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  _tabId(index) {
    return `m3-tab-${this._instanceId}-${index}`;
  }

  _entityOptions() {
    const stateObj = this._hass?.states?.[this._config?.entity];
    const options = stateObj?.attributes?.options;
    return Array.isArray(options) ? options.map((option) => String(option)) : [];
  }

  _resolveTabOption(tab, index) {
    const options = this._entityOptions();
    if (tab.option) {
      return tab.option;
    }
    if (options.includes(tab.value)) {
      return tab.value;
    }
    if (options.includes(tab.label)) {
      return tab.label;
    }
    if (options.length === this._config.tabs.length && options[index]) {
      return options[index];
    }
    return tab.value;
  }

  _resolvedTabs() {
    return (this._config?.tabs || []).map((tab, index) => ({
      ...tab,
      optionValue: this._resolveTabOption(tab, index),
    }));
  }

  _materialIconSet(iconRef) {
    return String(iconRef || "").split(":", 1)[0] || "";
  }

  _materialIconsReady() {
    const tabs = this._config?.tabs || [];
    for (const tab of tabs) {
      const parsed = this._parseIcon(tab.icon);
      if (parsed.kind !== "material") {
        continue;
      }
      const inactiveSet = this._materialIconSet(parsed.inactiveIcon);
      const activeSet = this._materialIconSet(parsed.activeIcon);
      if (!window.customIcons?.[inactiveSet] || !window.customIcons?.[activeSet]) {
        return false;
      }
    }
    return true;
  }

  _scheduleMaterialRetry() {
    if (this._materialRetryTimer || this._materialIconsReady()) {
      return;
    }
    this._materialRetryTimer = window.setTimeout(() => {
      this._materialRetryTimer = null;
      this._render();
    }, 400);
  }

  _parseIcon(icon) {
    if (!icon) {
      return { kind: "none", name: "" };
    }

    const raw = String(icon);
    const directSetMap = {
      m3r: { inactiveSet: "m3r", activeSet: "m3rf" },
      m3rf: { inactiveSet: "m3r", activeSet: "m3rf" },
      m3o: { inactiveSet: "m3o", activeSet: "m3of" },
      m3of: { inactiveSet: "m3o", activeSet: "m3of" },
      m3s: { inactiveSet: "m3s", activeSet: "m3sf" },
      m3sf: { inactiveSet: "m3s", activeSet: "m3sf" },
    };

    const prefixedMatch = raw.match(/^(m3r|m3rf|m3o|m3of|m3s|m3sf):(.*)$/);
    if (prefixedMatch) {
      const [, setName, name] = prefixedMatch;
      return {
        kind: "material",
        inactiveIcon: `${directSetMap[setName].inactiveSet}:${name}`,
        activeIcon: `${directSetMap[setName].activeSet}:${name}`,
      };
    }

    const roundedPrefixes = ["material:", "msr:", "symbol:"];
    for (const prefix of roundedPrefixes) {
      if (raw.startsWith(prefix)) {
        const name = raw.slice(prefix.length);
        return {
          kind: "material",
          inactiveIcon: `m3r:${name}`,
          activeIcon: `m3rf:${name}`,
        };
      }
    }

    if (raw.startsWith("material-outlined:")) {
      const name = raw.slice("material-outlined:".length);
      return {
        kind: "material",
        inactiveIcon: `m3o:${name}`,
        activeIcon: `m3of:${name}`,
      };
    }

    if (raw.startsWith("material-sharp:")) {
      const name = raw.slice("material-sharp:".length);
      return {
        kind: "material",
        inactiveIcon: `m3s:${name}`,
        activeIcon: `m3sf:${name}`,
      };
    }

    return { kind: "ha", name: raw };
  }

  _tabMarkup(tab, index, active, variant) {
    const tabId = this._tabId(index);
    const parsedIcon = this._parseIcon(tab.icon);
    const hasIcon = parsedIcon.kind !== "none";
    const materialReady = parsedIcon.kind !== "material" || this._materialIconsReady();
    const materialIcon = parsedIcon.kind === "material"
      ? (active ? parsedIcon.activeIcon : parsedIcon.inactiveIcon)
      : "";
    const iconMarkup =
      parsedIcon.kind === "ha"
        ? `<ha-icon class="tab-icon" icon="${this._escape(parsedIcon.name)}"></ha-icon>`
        : parsedIcon.kind === "material"
          ? materialReady
            ? `<ha-icon class="tab-icon tab-material-icon" icon="${this._escape(materialIcon)}"></ha-icon>`
            : `<span class="tab-icon tab-material-icon tab-icon-placeholder" aria-hidden="true"></span>`
          : "";
    const badgeMarkup = tab.badge
      ? `<span class="tab-badge">${this._escape(tab.badge)}</span>`
      : "";

    return `
      <input
        type="radio"
        class="tab-logic"
        id="${this._escape(tabId)}"
        name="m3-tab-group-${this._instanceId}"
        data-value="${this._escape(tab.value)}"
        ${active ? "checked" : ""}
      />
      <label
        for="${this._escape(tabId)}"
        class="m3-tab-item ${this._escape(variant)} ${hasIcon ? "has-icon" : "text-only"}"
        role="tab"
        tabindex="0"
        aria-selected="${active ? "true" : "false"}"
        style="--tab-indicator-width:${this._escape(this._config.indicatorWidth)};"
      >
        <span class="tab-content">
          ${iconMarkup}
          <span class="tab-label">${this._escape(tab.label)}</span>
          ${badgeMarkup}
        </span>
        <span class="tab-indicator" aria-hidden="true"></span>
      </label>
    `;
  }

  _syncAriaFromInputs() {
    const inputs = [...this.shadowRoot.querySelectorAll(".tab-logic")];
    for (const input of inputs) {
      const label = this.shadowRoot.querySelector(`label[for="${input.id}"]`);
      if (label) {
        label.setAttribute("aria-selected", input.checked ? "true" : "false");
      }
    }
  }

  _render() {
    if (!this.shadowRoot || !this._config) {
      return;
    }

    if (!this._materialIconsReady()) {
      this._scheduleMaterialRetry();
    }

    const activeValue = this._activeValue();
    const markup = this._resolvedTabs()
      .map((tab, index) => this._tabMarkup(tab, index, tab.value === activeValue, this._config.variant))
      .join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          min-width: 0;
          max-width: none;
          align-self: stretch;
          justify-self: stretch;
          --m3-tab-label-size: 0.875rem;
          --m3-tab-label-line-height: 1.25rem;
          --m3-tab-label-weight: 500;
          --m3-tab-label-weight-emphasized: 600;
          --m3-tab-label-tracking: 0.00625rem;
        }

        ha-card {
          display: block;
          width: 100%;
          min-width: 0;
          max-width: none;
          background: transparent;
          box-shadow: none;
          border: 0;
          border-radius: 0;
          overflow: visible;
        }

        .m3-tabs-header {
          display: flex;
          width: 100%;
          box-sizing: border-box;
          background-color: var(--md-sys-color-surface, var(--card-background-color));
          border-bottom: 1px solid var(--md-sys-color-outline-variant, var(--divider-color));
          overflow: hidden;
          position: relative;
        }

        .m3-tabs-header.primary {
          height: 64px;
        }

        .m3-tabs-header.secondary {
          height: 48px;
        }

        .tab-logic {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .m3-tab-item {
          flex: 1 1 0;
          min-width: 0;
          display: flex;
          align-items: stretch;
          justify-content: center;
          cursor: pointer;
          position: relative;
          color: var(--md-sys-color-on-surface-variant, var(--secondary-text-color));
          background: transparent;
          outline: none;
          user-select: none;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
          box-sizing: border-box;
          transition: color 0.2s cubic-bezier(0.2, 0, 0, 1);
        }

        .m3-tab-item::before {
          content: "";
          position: absolute;
          inset: 4px;
          border-radius: 8px;
          background-color: currentColor;
          opacity: 0;
          transition: opacity 0.1s linear;
          pointer-events: none;
        }

        .m3-tab-item:hover::before,
        .m3-tab-item:focus-visible::before {
          opacity: 0.08;
        }

        .m3-tab-item:active::before {
          opacity: 0.12;
        }

        .tab-content {
          width: 100%;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          color: inherit;
          z-index: 1;
          box-sizing: border-box;
        }

        .m3-tab-item.primary.has-icon .tab-content {
          min-height: 64px;
          padding: 8px 0 5px;
          flex-direction: column;
          gap: 4px;
        }

        .m3-tab-item.primary.text-only .tab-content {
          min-height: 48px;
          padding: 0 0 5px;
          flex-direction: row;
          gap: 0;
        }

        .m3-tab-item.secondary .tab-content {
          min-height: 48px;
          padding: 0;
          flex-direction: row;
          gap: 8px;
        }

        .tab-icon {
          width: 24px;
          height: 24px;
          color: currentColor;
          --mdc-icon-size: 24px;
          flex: 0 0 auto;
        }

        .tab-material-icon {
          transition: color 0.2s cubic-bezier(0.2, 0, 0, 1);
        }

        .tab-icon-placeholder {
          display: inline-block;
        }

        .tab-label {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
          font-family: var(--ha-font-family-body, Roboto, "Noto Sans", sans-serif);
          font-size: var(--m3-tab-label-size);
          line-height: var(--m3-tab-label-line-height);
          font-weight: var(--m3-tab-label-weight);
          letter-spacing: var(--m3-tab-label-tracking);
        }

        .tab-indicator {
          position: absolute;
          left: 50%;
          bottom: -1px;
          transform: translateX(-50%);
          min-width: 24px;
          width: var(--tab-indicator-width);
          background-color: transparent;
          pointer-events: none;
          z-index: 2;
        }

        .m3-tab-item.primary .tab-indicator {
          height: 3px;
          border-radius: 3px 3px 0 0;
        }

        .m3-tab-item.secondary .tab-indicator {
          height: 2px;
          border-radius: 2px 2px 0 0;
        }

        .m3-tab-item.secondary.text-only .tab-indicator {
          width: calc(100% - 32px);
        }

        .tab-badge {
          position: absolute;
          background-color: var(--md-sys-color-error, var(--error-color));
          color: var(--md-sys-color-on-error, #fff);
          font: 500 0.6875rem/1 var(--ha-font-family-body, Roboto, Noto, sans-serif);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          pointer-events: none;
          z-index: 3;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          box-sizing: border-box;
          border: 2px solid var(--md-sys-color-surface, var(--card-background-color, transparent));
        }

        .m3-tab-item.primary .tab-badge {
          top: 4px;
          left: calc(50% + 6px);
        }

        .m3-tab-item.secondary .tab-badge {
          margin-left: 4px;
        }

        .tab-logic:checked + .m3-tab-item {
          color: var(--md-sys-color-primary, var(--primary-color));
        }

        .tab-logic:checked + .m3-tab-item .tab-label {
          font-weight: var(--m3-tab-label-weight-emphasized);
        }

        .tab-logic:checked + .m3-tab-item .tab-indicator {
          background-color: var(--md-sys-color-primary, var(--primary-color));
        }
      </style>
      <ha-card>
        <div class="m3-tabs-header ${this._config.variant}" role="tablist">
          ${markup}
        </div>
      </ha-card>
    `;

    for (const input of this.shadowRoot.querySelectorAll(".tab-logic")) {
      input.removeEventListener("change", this._boundInputChange);
      input.addEventListener("change", this._boundInputChange);
    }

    for (const label of this.shadowRoot.querySelectorAll(".m3-tab-item")) {
      label.removeEventListener("keydown", this._boundLabelKeydown);
      label.addEventListener("keydown", this._boundLabelKeydown);
    }

    this._syncAriaFromInputs();
  }
}

const ExistingM3Tabs = customElements.get("m3-tabs");
if (ExistingM3Tabs) {
  const sourceProto = M3Tabs.prototype;
  const targetProto = ExistingM3Tabs.prototype;
  for (const name of Object.getOwnPropertyNames(sourceProto)) {
    if (name === "constructor") {
      continue;
    }
    Object.defineProperty(
      targetProto,
      name,
      Object.getOwnPropertyDescriptor(sourceProto, name)
    );
  }
  ExistingM3Tabs.getStubConfig = M3Tabs.getStubConfig;
} else {
  customElements.define("m3-tabs", M3Tabs);
}

window.customCards = window.customCards || [];
if (!window.customCards.find((card) => card.type === "m3-tabs")) {
  window.customCards.push({
    type: "m3-tabs",
    name: "M3 Tabs",
    description: "Material 3 distributed tab header for Lovelace dashboards",
  });
}
