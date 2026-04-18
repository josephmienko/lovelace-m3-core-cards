class M3Slider extends HTMLElement {
  static get observedAttributes() {
    return [
      "entity",
      "icon",
      "size",
      "min",
      "max",
      "step",
      "disabled",
      "show-inset-icon",
      "show-value-indicator",
      "aria-label",
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._configFromAttributes = false;
    this._hovered = false;
    this._focused = false;
    this._dragging = false;
    this._optimisticValue = null;
    this._optimisticValueUntil = 0;
    this._serviceTimer = null;
    this._pendingServiceValue = null;
    this._lastCommittedValue = null;
    this._styleEl = null;
    this._rootEl = null;
    this._rangeEl = null;
    this._trackEl = null;
    this._activeTrackEl = null;
    this._inactiveTrackEl = null;
    this._handleEl = null;
    this._indicatorEl = null;
    this._indicatorTextEl = null;
    this._insetIconShellEl = null;
    this._insetIconEl = null;
    this._boundPointerEnter = this._handlePointerEnter.bind(this);
    this._boundPointerLeave = this._handlePointerLeave.bind(this);
    this._boundPointerDown = this._handlePointerDown.bind(this);
    this._boundPointerUp = this._handlePointerUp.bind(this);
    this._boundPointerCancel = this._handlePointerCancel.bind(this);
    this._boundFocus = this._handleFocus.bind(this);
    this._boundBlur = this._handleBlur.bind(this);
    this._boundInput = this._handleInput.bind(this);
    this._boundChange = this._handleChange.bind(this);
  }

  connectedCallback() {
    if (!this._config) {
      this._hydrateConfigFromAttributes();
    }
    this._ensureDom();
    this._attachListeners();
    this._syncVisualState({ force: true });
  }

  disconnectedCallback() {
    this._detachListeners();
    this._clearServiceTimer();
  }

  attributeChangedCallback() {
    if (!this._configFromAttributes) {
      return;
    }
    this._hydrateConfigFromAttributes();
    this._syncVisualState({ force: true });
  }

  setConfig(config) {
    const input = config || {};
    if (!input.entity) {
      throw new Error("m3-slider requires an entity");
    }

    this._configFromAttributes = false;
    this._config = this._normalizeConfig(input);
    this._ensureDom();
    this._syncVisualState({ force: true });
  }

  set hass(hass) {
    this._hass = hass;
    this._reconcileOptimisticValue();
    this._syncVisualState();
  }

  getCardSize() {
    return 1;
  }

  static getStubConfig() {
    return {
      type: "custom:m3-slider",
      entity: "light.kitchen",
      size: "m",
      show_value_indicator: true,
      show_inset_icon: true,
      icon: "mdi:lightbulb",
    };
  }

  _normalizeConfig(input) {
    return {
      entity: String(input.entity),
      icon: input.icon ? String(input.icon) : "",
      size: this._normalizeSize(input.size),
      min: this._normalizeNumber(input.min, 0),
      max: this._normalizeNumber(input.max, 100),
      step: this._normalizeNumber(input.step, 1),
      disabled: Boolean(input.disabled),
      showInsetIcon: Boolean(input.show_inset_icon),
      showValueIndicator: input.show_value_indicator !== false,
      ariaLabel: input.aria_label ? String(input.aria_label) : "",
    };
  }

  _hydrateConfigFromAttributes() {
    this._configFromAttributes = true;
    const entity = this.getAttribute("entity") || "";
    if (!entity) {
      return;
    }

    this._config = this._normalizeConfig({
      entity,
      icon: this.getAttribute("icon") || "",
      size: this.getAttribute("size") || "m",
      min: this.getAttribute("min") || 0,
      max: this.getAttribute("max") || 100,
      step: this.getAttribute("step") || 1,
      disabled: this.hasAttribute("disabled"),
      show_inset_icon: this.hasAttribute("show-inset-icon"),
      show_value_indicator: this.hasAttribute("show-value-indicator"),
      aria_label: this.getAttribute("aria-label") || "",
    });
  }

  _normalizeSize(size) {
    const raw = String(size || "m").toLowerCase();
    return ["xs", "s", "m", "l", "xl"].includes(raw) ? raw : "m";
  }

  _normalizeNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  _sizeMetrics() {
    return {
      xs: {
        trackHeight: "16px",
        trackRadius: "8px",
        handleHeight: "44px",
        handleWidth: "4px",
        indicatorOffset: "16px",
        insetIconSize: "0px",
        insetIconPadding: "0px",
      },
      s: {
        trackHeight: "24px",
        trackRadius: "8px",
        handleHeight: "44px",
        handleWidth: "4px",
        indicatorOffset: "16px",
        insetIconSize: "0px",
        insetIconPadding: "0px",
      },
      m: {
        trackHeight: "40px",
        trackRadius: "12px",
        handleHeight: "52px",
        handleWidth: "4px",
        indicatorOffset: "18px",
        insetIconSize: "24px",
        insetIconPadding: "12px",
      },
      l: {
        trackHeight: "56px",
        trackRadius: "16px",
        handleHeight: "68px",
        handleWidth: "4px",
        indicatorOffset: "20px",
        insetIconSize: "24px",
        insetIconPadding: "16px",
      },
      xl: {
        trackHeight: "96px",
        trackRadius: "28px",
        handleHeight: "108px",
        handleWidth: "4px",
        indicatorOffset: "24px",
        insetIconSize: "32px",
        insetIconPadding: "20px",
      },
    }[this._config?.size || "m"];
  }

  _ensureDom() {
    if (this._rootEl) {
      return;
    }

    this._styleEl = document.createElement("style");
    this._styleEl.textContent = `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
        touch-action: pan-y;
      }

      * {
        box-sizing: border-box;
      }

      .slider-root {
        position: relative;
        width: 100%;
        min-width: 0;
        display: grid;
        align-items: center;
        --slider-track-height: 40px;
        --slider-track-radius: 12px;
        --slider-handle-height: 52px;
        --slider-handle-width: 4px;
        --slider-handle-color: var(--slider-active-on-color);
        --slider-indicator-offset: 18px;
        --slider-inset-icon-size: 0px;
        --slider-inset-icon-padding: 0px;
        --slider-active-color: var(--md-sys-color-primary, var(--primary-color, #6750a4));
        --slider-active-on-color: var(--md-sys-color-on-primary, #ffffff);
        --slider-inactive-color: var(--md-sys-color-secondary-container, rgba(103, 80, 164, 0.22));
        --slider-inactive-on-color: var(--md-sys-color-on-secondary-container, var(--primary-text-color, #1d1b20));
        --slider-indicator-color: var(--md-sys-color-inverse-surface, #313033);
        --slider-indicator-on-color: var(--md-sys-color-inverse-on-surface, #f4eff4);
        --slider-disabled-color: color-mix(in srgb, var(--md-sys-color-on-surface, #1d1b20) 24%, transparent);
        --slider-disabled-track: color-mix(in srgb, var(--md-sys-color-on-surface, #1d1b20) 12%, transparent);
      }

      .slider-shell {
        position: relative;
        min-width: 0;
        padding-block: calc((var(--slider-handle-height) - var(--slider-track-height)) / 2);
      }

      .track {
        position: relative;
        width: 100%;
        height: var(--slider-track-height);
      }

      .track-segment {
        position: absolute;
        top: 0;
        bottom: 0;
      }

      .track-segment-active {
        left: 0;
        background: var(--slider-active-color);
        border-radius: var(--slider-track-radius) 0 0 var(--slider-track-radius);
      }

      .track-segment-inactive {
        right: 0;
        background: var(--slider-inactive-color);
        border-radius: 0 var(--slider-track-radius) var(--slider-track-radius) 0;
      }

      .track-segment-active.is-zero {
        border-radius: var(--slider-track-radius);
      }

      .track-segment-inactive.is-full {
        border-radius: var(--slider-track-radius);
      }

      .inset-icon-shell {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: var(--slider-inset-icon-size);
        height: var(--slider-inset-icon-size);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--slider-active-on-color);
        opacity: 0;
        transition:
          opacity 140ms ease,
          left 160ms cubic-bezier(0.2, 0, 0, 1),
          right 160ms cubic-bezier(0.2, 0, 0, 1),
          color 120ms linear;
        pointer-events: none;
      }

      .inset-icon-shell.is-visible {
        opacity: 1;
      }

      .inset-icon-shell.is-start {
        left: var(--slider-inset-icon-padding);
        right: auto;
        justify-content: flex-start;
      }

      .inset-icon-shell.is-end {
        right: var(--slider-inset-icon-padding);
        left: auto;
        justify-content: flex-end;
      }

      .inset-icon-shell ha-icon {
        --mdc-icon-size: var(--slider-inset-icon-size);
      }

      .handle {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        width: var(--slider-handle-width);
        height: var(--slider-handle-height);
        border-radius: 999px;
        background: var(--slider-handle-color);
        transition:
          width 160ms cubic-bezier(0.2, 0, 0, 1),
          background-color 160ms ease,
          box-shadow 160ms ease,
          transform 180ms cubic-bezier(0.2, 0.9, 0.25, 1);
        pointer-events: none;
      }

      .slider-root.is-focused .handle,
      .slider-root.is-dragging .handle {
        width: calc(var(--slider-handle-width) / 2);
      }

      .slider-root.is-focused .handle {
        box-shadow:
          0 0 0 2px var(--slider-active-on-color),
          0 0 0 4px color-mix(in srgb, var(--slider-active-color) 30%, transparent);
      }

      .slider-root.is-dragging .handle {
        transform: translate(-50%, -50%);
      }

      .value-indicator {
        position: absolute;
        left: 50%;
        top: 0;
        transform: translate(-50%, calc(-100% - var(--slider-indicator-offset)));
        min-width: 48px;
        height: 44px;
        padding-inline: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: var(--slider-indicator-color);
        color: var(--slider-indicator-on-color);
        font-size: 16px;
        line-height: 24px;
        font-weight: 500;
        letter-spacing: 0.009375rem;
        opacity: 0;
        transition: opacity 120ms linear, transform 160ms cubic-bezier(0.2, 0, 0, 1);
        pointer-events: none;
      }

      .slider-root.show-indicator .value-indicator {
        opacity: 1;
        transform: translate(-50%, calc(-100% - var(--slider-indicator-offset) - 4px));
      }

      .native-range {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        appearance: none;
        background: transparent;
        cursor: pointer;
      }

      .native-range:disabled {
        cursor: default;
      }

      .slider-root.is-disabled {
        opacity: 0.56;
      }

      .slider-root.is-disabled .track-segment-active,
      .slider-root.is-disabled .handle {
        background: var(--slider-disabled-color);
      }

      .slider-root.is-disabled .track-segment-inactive {
        background: var(--slider-disabled-track);
      }
    `;

    this._rootEl = document.createElement("div");
    this._rootEl.className = "slider-root";

    const shell = document.createElement("div");
    shell.className = "slider-shell";

    this._indicatorEl = document.createElement("div");
    this._indicatorEl.className = "value-indicator";
    this._indicatorTextEl = document.createElement("span");
    this._indicatorEl.appendChild(this._indicatorTextEl);

    this._trackEl = document.createElement("div");
    this._trackEl.className = "track";

    this._activeTrackEl = document.createElement("div");
    this._activeTrackEl.className = "track-segment track-segment-active";
    this._inactiveTrackEl = document.createElement("div");
    this._inactiveTrackEl.className = "track-segment track-segment-inactive";

    this._insetIconShellEl = document.createElement("div");
    this._insetIconShellEl.className = "inset-icon-shell";
    this._insetIconEl = document.createElement("ha-icon");
    this._insetIconShellEl.appendChild(this._insetIconEl);

    this._handleEl = document.createElement("div");
    this._handleEl.className = "handle";

    this._rangeEl = document.createElement("input");
    this._rangeEl.className = "native-range";
    this._rangeEl.type = "range";

    this._trackEl.append(this._activeTrackEl, this._inactiveTrackEl, this._insetIconShellEl, this._handleEl);
    shell.append(this._indicatorEl, this._trackEl, this._rangeEl);
    this._rootEl.appendChild(shell);
    this.shadowRoot.append(this._styleEl, this._rootEl);
  }

  _attachListeners() {
    if (!this._rangeEl) {
      return;
    }
    this._rangeEl.addEventListener("pointerenter", this._boundPointerEnter);
    this._rangeEl.addEventListener("pointerleave", this._boundPointerLeave);
    this._rangeEl.addEventListener("pointerdown", this._boundPointerDown);
    this._rangeEl.addEventListener("pointerup", this._boundPointerUp);
    this._rangeEl.addEventListener("pointercancel", this._boundPointerCancel);
    this._rangeEl.addEventListener("focus", this._boundFocus);
    this._rangeEl.addEventListener("blur", this._boundBlur);
    this._rangeEl.addEventListener("input", this._boundInput);
    this._rangeEl.addEventListener("change", this._boundChange);
  }

  _detachListeners() {
    if (!this._rangeEl) {
      return;
    }
    this._rangeEl.removeEventListener("pointerenter", this._boundPointerEnter);
    this._rangeEl.removeEventListener("pointerleave", this._boundPointerLeave);
    this._rangeEl.removeEventListener("pointerdown", this._boundPointerDown);
    this._rangeEl.removeEventListener("pointerup", this._boundPointerUp);
    this._rangeEl.removeEventListener("pointercancel", this._boundPointerCancel);
    this._rangeEl.removeEventListener("focus", this._boundFocus);
    this._rangeEl.removeEventListener("blur", this._boundBlur);
    this._rangeEl.removeEventListener("input", this._boundInput);
    this._rangeEl.removeEventListener("change", this._boundChange);
  }

  _entityState() {
    return this._config?.entity ? this._hass?.states?.[this._config.entity] || null : null;
  }

  _supportsBrightness(stateObj) {
    if (!stateObj) {
      return false;
    }
    if (!stateObj.entity_id?.startsWith("light.")) {
      return typeof stateObj.attributes?.brightness === "number";
    }
    if (["unknown", "unavailable"].includes(stateObj.state)) {
      return false;
    }
    if (typeof stateObj.attributes?.brightness === "number") {
      return true;
    }
    const supportedModes = stateObj.attributes?.supported_color_modes;
    if (!Array.isArray(supportedModes)) {
      return false;
    }
    return supportedModes.some((mode) =>
      [
        "brightness",
        "color_temp",
        "hs",
        "xy",
        "rgb",
        "rgbw",
        "rgbww",
        "white",
      ].includes(mode)
    );
  }

  _stateValuePct(stateObj) {
    if (!stateObj || stateObj.state !== "on") {
      return 0;
    }
    const brightness = Number(stateObj.attributes?.brightness);
    if (Number.isFinite(brightness) && brightness > 0) {
      return Math.max(0, Math.min(100, Math.round((brightness / 255) * 100)));
    }
    return 100;
  }

  _resolveInsetIconPath(value, stateObj) {
    const configuredIcon =
      this._config?.icon ||
      stateObj?.attributes?.icon ||
      (this._config?.entity?.startsWith("light.") ? "mdi:lightbulb-on" : "");

    if (!configuredIcon) {
      return "";
    }

    const [setName, iconName] = String(configuredIcon).split(":");
    if (!setName || !iconName) {
      return String(configuredIcon);
    }

    if (value <= 0 && setName === "m3rf") {
      return `m3r:${iconName}`;
    }

    if (value <= 0 && String(configuredIcon) === "mdi:lightbulb-on") {
      return "mdi:lightbulb";
    }

    if (value > 0 && setName === "m3r" && this._config?.entity?.startsWith("light.")) {
      return `m3rf:${iconName}`;
    }

    if (value > 0 && String(configuredIcon) === "mdi:lightbulb" && this._config?.entity?.startsWith("light.")) {
      return "mdi:lightbulb-on";
    }

    return String(configuredIcon);
  }

  _reconcileOptimisticValue() {
    if (this._optimisticValue == null) {
      return;
    }
    if (this._dragging) {
      return;
    }
    const stateObj = this._entityState();
    const stateValue = this._stateValuePct(stateObj);
    if (
      stateObj &&
      stateObj.state !== "unknown" &&
      Math.abs(stateValue - this._optimisticValue) <= 1
    ) {
      this._optimisticValue = null;
      this._optimisticValueUntil = 0;
      this._lastCommittedValue = stateValue;
      return;
    }
    if (Date.now() > this._optimisticValueUntil) {
      this._optimisticValue = null;
      this._optimisticValueUntil = 0;
    }
  }

  _currentPct() {
    if (this._optimisticValue != null) {
      return this._optimisticValue;
    }
    return this._stateValuePct(this._entityState());
  }

  _setOptimisticValue(value) {
    this._optimisticValue = value;
    // Keep the optimistic value visible long enough for HA and the device
    // integration to publish the updated state back to the frontend.
    this._optimisticValueUntil = Date.now() + 30000;
  }

  _isDisabled() {
    const stateObj = this._entityState();
    if (this._config?.disabled) {
      return true;
    }
    if (!stateObj || ["unavailable", "unknown"].includes(stateObj.state)) {
      return true;
    }
    return !this._supportsBrightness(stateObj);
  }

  _handlePointerEnter() {
    this._hovered = true;
    this._syncVisualState();
  }

  _handlePointerLeave() {
    this._hovered = false;
    if (!this._dragging) {
      this._syncVisualState();
    }
  }

  _handlePointerDown() {
    if (this._isDisabled()) {
      return;
    }
    this._dragging = true;
    this._fire("m3-slider-interaction-start", {
      entityId: this._config?.entity || "",
    });
    this._syncVisualState();
  }

  _handlePointerUp() {
    this._finishInteraction();
  }

  _handlePointerCancel() {
    this._finishInteraction();
  }

  _handleFocus() {
    this._focused = true;
    this._syncVisualState();
  }

  _handleBlur() {
    this._focused = false;
    this._finishInteraction();
  }

  _handleInput(event) {
    const nextValue = this._coercePct(Number(event.target.value));
    this._setOptimisticValue(nextValue);
    this._pendingServiceValue = nextValue;
    this._scheduleServiceUpdate();
    this._syncVisualState();
  }

  _handleChange(event) {
    const nextValue = this._coercePct(Number(event.target.value));
    this._setOptimisticValue(nextValue);
    this._pendingServiceValue = nextValue;
    this._flushServiceUpdate();
    this._finishInteraction();
  }

  _coercePct(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  _clearServiceTimer() {
    if (this._serviceTimer) {
      clearTimeout(this._serviceTimer);
      this._serviceTimer = null;
    }
  }

  _scheduleServiceUpdate() {
    if (this._serviceTimer || this._pendingServiceValue == null) {
      return;
    }
    this._serviceTimer = window.setTimeout(() => {
      this._serviceTimer = null;
      void this._applyPendingServiceValue();
    }, 75);
  }

  async _flushServiceUpdate() {
    this._clearServiceTimer();
    await this._applyPendingServiceValue();
  }

  async _applyPendingServiceValue() {
    if (!this._hass || !this._config?.entity || this._pendingServiceValue == null) {
      return;
    }

    const nextValue = this._pendingServiceValue;
    this._pendingServiceValue = null;
    if (nextValue === this._lastCommittedValue) {
      return;
    }

    try {
      if (nextValue <= 0) {
        await this._hass.callService("homeassistant", "turn_off", {
          entity_id: this._config.entity,
        });
      } else {
        await this._hass.callService("light", "turn_on", {
          entity_id: this._config.entity,
          brightness_pct: nextValue,
        });
      }
      this._lastCommittedValue = nextValue;
    } catch (error) {
      this._lastCommittedValue = null;
      // Keep optimistic state visible for a short period and allow retries.
      console.warn("[m3-slider] brightness update failed", this._config.entity, error);
    }
  }

  _finishInteraction() {
    const wasDragging = this._dragging;
    this._dragging = false;
    this._syncVisualState();
    if (wasDragging) {
      this._fire("m3-slider-interaction-end", {
        entityId: this._config?.entity || "",
        targetValue: this._currentPct(),
      });
    }
  }

  _fire(eventType, detail) {
    this.dispatchEvent(
      new CustomEvent(eventType, {
        detail,
        bubbles: true,
        composed: true,
      })
    );
  }

  _applyMetrics() {
    const metrics = this._sizeMetrics();
    if (!metrics || !this._rootEl) {
      return;
    }
    this._rootEl.style.setProperty("--slider-track-height", metrics.trackHeight);
    this._rootEl.style.setProperty("--slider-track-radius", metrics.trackRadius);
    this._rootEl.style.setProperty("--slider-handle-height", metrics.handleHeight);
    this._rootEl.style.setProperty("--slider-handle-width", metrics.handleWidth);
    this._rootEl.style.setProperty("--slider-indicator-offset", metrics.indicatorOffset);
    this._rootEl.style.setProperty("--slider-inset-icon-size", metrics.insetIconSize);
    this._rootEl.style.setProperty("--slider-inset-icon-padding", metrics.insetIconPadding);
  }

  _syncVisualState({ force = false } = {}) {
    if (!this._config) {
      return;
    }
    this._ensureDom();
    this._applyMetrics();

    const disabled = this._isDisabled();
    const value = this._currentPct();
    const activePct = `${value}%`;
    const inactivePct = `${100 - value}%`;
    const stateObj = this._entityState();
    const metrics = this._sizeMetrics();
    const icon = this._resolveInsetIconPath(value, stateObj);
    const iconSize = Number.parseInt(metrics?.insetIconSize || "0", 10) || 0;
    const iconPadding = Number.parseInt(metrics?.insetIconPadding || "0", 10) || 0;
    const trackWidth = this._trackEl?.clientWidth || 0;
    const activeWidth = trackWidth > 0 ? trackWidth * (value / 100) : 0;
    const showInsetIcon = Boolean(this._config.showInsetIcon && icon && iconSize > 0);
    const iconAtEnd =
      showInsetIcon &&
      (value <= 0 || (trackWidth > 0 && activeWidth < iconSize + iconPadding * 2 + 4));
    const showIndicator =
      Boolean(this._config.showValueIndicator) && (this._dragging || this._focused);

    this._rootEl.classList.toggle("is-hovered", this._hovered);
    this._rootEl.classList.toggle("is-focused", this._focused);
    this._rootEl.classList.toggle("is-dragging", this._dragging);
    this._rootEl.classList.toggle("is-disabled", disabled);
    this._rootEl.classList.toggle("show-indicator", showIndicator);

    this._rangeEl.min = String(this._config.min);
    this._rangeEl.max = String(this._config.max);
    this._rangeEl.step = String(this._config.step);
    this._rangeEl.disabled = disabled;
    this._rangeEl.value = String(value);
    this._rangeEl.setAttribute(
      "aria-label",
      this._config.ariaLabel || `${this._config.entity} brightness`
    );
    this._rangeEl.setAttribute("aria-valuetext", `${value}%`);

    this._activeTrackEl.style.width = activePct;
    this._inactiveTrackEl.style.width = inactivePct;
    this._activeTrackEl.classList.toggle("is-zero", value <= 0);
    this._inactiveTrackEl.classList.toggle("is-full", value >= 100);
    this._handleEl.style.left = activePct;
    this._indicatorEl.style.left = activePct;
    this._indicatorTextEl.textContent = String(value);

    this._insetIconShellEl.classList.toggle("is-visible", showInsetIcon);
    this._insetIconShellEl.classList.toggle("is-start", showInsetIcon && !iconAtEnd);
    this._insetIconShellEl.classList.toggle("is-end", showInsetIcon && iconAtEnd);
    this._insetIconShellEl.style.left = showInsetIcon && !iconAtEnd ? metrics.insetIconPadding : "auto";
    this._insetIconShellEl.style.right = showInsetIcon && iconAtEnd ? metrics.insetIconPadding : "auto";
    this._insetIconShellEl.style.color = iconAtEnd
      ? "var(--slider-inactive-on-color)"
      : "var(--slider-active-on-color)";
    this._insetIconEl.setAttribute("icon", icon);

    if (force) {
      this._activeTrackEl.getBoundingClientRect();
    }
  }
}

if (!customElements.get("m3-slider")) {
  customElements.define("m3-slider", M3Slider);
}

window.customCards = window.customCards || [];
if (!window.customCards.find((card) => card.type === "m3-slider")) {
  window.customCards.push({
    type: "m3-slider",
    name: "M3 Slider",
    description: "Material 3 standard slider for dimmable Home Assistant entities",
  });
}
