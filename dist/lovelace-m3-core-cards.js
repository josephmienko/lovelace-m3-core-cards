/**
 * Built file for the M3 Core Cards HACS artifact.
 * Edit the modules in src/ and rerun npm run build.
 */

// src/m3-slider.js
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

// src/m3-button.js
class M3Button extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._styleEl = null;
    this._buttonEl = null;
    this._anchorEl = null;
    this._iconEl = null;
    this._labelEl = null;
    this._holdTimer = null;
    this._tapTimer = null;
    this._holdTriggered = false;
    this._hovered = false;
    this._focusVisible = false;
    this._pressed = false;
    this._currentAnimation = null;
    this._optimisticSelected = null;
    this._optimisticSelectedUntil = 0;
    this._lastSelected = null;
    this._boundPointerEnter = this._handlePointerEnter.bind(this);
    this._boundPointerDown = this._handlePointerDown.bind(this);
    this._boundPointerUp = this._handlePointerUp.bind(this);
    this._boundPointerLeave = this._handlePointerLeave.bind(this);
    this._boundPointerCancel = this._handlePointerCancel.bind(this);
    this._boundClick = this._handleClick.bind(this);
    this._boundKeyDown = this._handleKeyDown.bind(this);
    this._boundKeyUp = this._handleKeyUp.bind(this);
    this._boundFocus = this._handleFocus.bind(this);
    this._boundBlur = this._handleBlur.bind(this);
  }

  setConfig(config) {
    const input = config || {};
    const label = input.label ?? input.name ?? "";
    const toggle = Boolean(input.toggle);
    const variant = this._normalizeVariant(input.variant);

    if (!label && !input.icon) {
      throw new Error("m3-button requires a label/name or icon");
    }
    if (toggle && variant === "text") {
      throw new Error("m3-button does not support toggle text buttons");
    }

    this._config = {
      label: label ? String(label) : "",
      icon: input.icon ? String(input.icon) : "",
      variant,
      size: this._normalizeSize(input.size),
      iconPosition: input.icon_position === "trailing" ? "trailing" : "leading",
      shape: this._normalizeShape(input.shape),
      toggle,
      selected: Boolean(input.selected),
      selectedState:
        input.selected_state == null || input.selected_state === ""
          ? "on"
          : String(input.selected_state),
      disabled: Boolean(input.disabled),
      fullWidth: Boolean(input.full_width),
      floating: Boolean(input.floating),
      bottom: String(input.bottom || "20px"),
      top: input.top == null ? "" : String(input.top),
      left: String(input.left || "50%"),
      right: input.right == null ? "" : String(input.right),
      width: String(input.width || (input.full_width ? "100%" : "auto")),
      maxWidth: String(input.max_width || "600px"),
      zIndex: String(input.z_index || "10"),
      translateX: String(input.translate_x || (input.floating ? "-50%" : "0")),
      holdTimeMs: Math.max(Number(input.hold_time_ms || 450), 200),
      spring: input.spring === false ? false : true,
      tapAction: this._normalizeAction(input.tap_action),
      holdAction: this._normalizeAction(input.hold_action),
      doubleTapAction: this._normalizeAction(input.double_tap_action),
      entity: input.entity ? String(input.entity) : "",
      ariaLabel: input.aria_label ? String(input.aria_label) : "",
    };

    if (!this._config.tapAction && input.navigation_path) {
      this._config.tapAction = {
        action: "navigate",
        navigation_path: String(input.navigation_path),
      };
    }
    if (!this._config.tapAction && toggle && this._config.entity) {
      this._config.tapAction = { action: "toggle" };
    }

    this._ensureDom();
    this._applyConfig();
    this._syncVisualState({ force: true, animateSelection: false });
  }

  set hass(hass) {
    this._hass = hass;
    this._reconcileOptimisticSelected();
    this._syncVisualState();
  }

  connectedCallback() {
    this._ensureDom();
    this._attachListeners();
    this._syncVisualState({ force: true, animateSelection: false });
  }

  disconnectedCallback() {
    this._detachListeners();
    this._clearHoldTimer();
    this._clearTapTimer();
    this._cancelCurrentAnimation(false);
  }

  getCardSize() {
    return 1;
  }

  static getStubConfig() {
    return {
      type: "custom:m3-button",
      label: "Back to dashboard",
      icon: "mdi:arrow-left",
      variant: "elevated",
      tap_action: {
        action: "navigate",
        navigation_path: "/lovelace/0",
      },
    };
  }

  _normalizeVariant(variant) {
    const raw = String(variant || "filled");
    return ["filled", "tonal", "outlined", "text", "elevated"].includes(raw)
      ? raw
      : "filled";
  }

  _normalizeSize(size) {
    const raw = String(size || "m").toLowerCase();
    return ["xs", "s", "m", "l", "xl"].includes(raw) ? raw : "m";
  }

  _normalizeShape(shape) {
    const raw = String(shape || "round").toLowerCase();
    if (["round", "pill", "full"].includes(raw)) {
      return "round";
    }
    if (["square", "rounded"].includes(raw)) {
      return "square";
    }
    return "round";
  }

  _normalizeAction(action) {
    if (!action || typeof action !== "object") {
      return null;
    }
    const normalized = { ...action };
    normalized.action = String(action.action || "none");
    return normalized;
  }

  _escape(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  _variantClass() {
    return `variant-${this._config?.variant || "filled"}`;
  }

  _shapeClass() {
    return `shape-${this._config?.shape || "round"}`;
  }

  _sizeClass() {
    return `size-${this._config?.size || "m"}`;
  }

  _sizeMetrics() {
    const size = this._config?.size || "m";
    return {
      xs: {
        minHeight: "32px",
        paddingBlock: "6px",
        paddingInline: "16px",
        iconSize: "16px",
        squareRadius: "12px",
        pressedRadius: "8px",
      },
      s: {
        minHeight: "36px",
        paddingBlock: "8px",
        paddingInline: "20px",
        iconSize: "18px",
        squareRadius: "12px",
        pressedRadius: "8px",
      },
      m: {
        minHeight: "40px",
        paddingBlock: "10px",
        paddingInline: "24px",
        iconSize: "18px",
        squareRadius: "16px",
        pressedRadius: "12px",
      },
      l: {
        minHeight: "56px",
        paddingBlock: "16px",
        paddingInline: "24px",
        iconSize: "20px",
        squareRadius: "28px",
        pressedRadius: "16px",
      },
      xl: {
        minHeight: "64px",
        paddingBlock: "20px",
        paddingInline: "32px",
        iconSize: "24px",
        squareRadius: "28px",
        pressedRadius: "16px",
      },
    }[size];
  }

  _hostStyle() {
    const cfg = this._config;
    if (!cfg) {
      return "";
    }

    if (cfg.floating) {
      return [
        "display:block",
        "position:fixed",
        cfg.top ? `top:${cfg.top}` : `bottom:${cfg.bottom}`,
        cfg.left ? `left:${cfg.left}` : "",
        cfg.right ? `right:${cfg.right}` : "",
        `width:${cfg.width}`,
        `max-width:${cfg.maxWidth}`,
        `z-index:${cfg.zIndex}`,
        `transform:translateX(${cfg.translateX})`,
      ].filter(Boolean).join(";");
    }

    return [
      "display:block",
      cfg.fullWidth ? "width:100%" : "width:max-content",
      `max-width:${cfg.maxWidth}`,
      cfg.fullWidth ? "" : "margin-inline:auto",
    ].filter(Boolean).join(";");
  }

  _stylesheet() {
    return `
      :host {
        box-sizing: border-box;
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }

      ha-card {
        background: transparent;
        box-shadow: none;
        border: 0;
        overflow: visible;
      }

      .button-anchor {
        width: 100%;
        display: flex;
      }

      .m3-button {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: var(--m3-button-min-height, 40px);
        width: auto;
        max-width: 100%;
        padding: var(--m3-button-padding-block, 10px) var(--m3-button-padding-inline, 24px);
        border-radius: 999px;
        border: 1px solid transparent;
        outline: none;
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        font-family: var(--ha-font-family-body, Roboto, "Noto Sans", sans-serif);
        font-size: 14px;
        line-height: 20px;
        font-weight: 500;
        letter-spacing: 0.00625rem;
        text-decoration: none;
        overflow: hidden;
        transition:
          background-color 0.2s cubic-bezier(0.2, 0, 0, 1),
          border-color 0.2s cubic-bezier(0.2, 0, 0, 1),
          box-shadow 0.24s cubic-bezier(0.2, 0, 0, 1),
          color 0.2s cubic-bezier(0.2, 0, 0, 1);
        transform: translateY(0) scale(1);
        transform-origin: center;
        isolation: isolate;
        will-change: transform, border-radius, background-color, color, box-shadow;
        backface-visibility: hidden;
      }

      .m3-button.icon-trailing {
        flex-direction: row-reverse;
      }

      .m3-button::before {
        content: "";
        position: absolute;
        inset: 0;
        background: currentColor;
        opacity: 0;
        transition: opacity 0.12s linear;
        pointer-events: none;
        z-index: 0;
      }

      .m3-button.is-hovered::before,
      .m3-button.is-focus-visible::before {
        opacity: 0.08;
      }

      .m3-button.is-pressed::before {
        opacity: 0.12;
      }

      .m3-button.is-focus-visible {
        box-shadow:
          0 0 0 3px color-mix(in srgb, var(--md-sys-color-primary, var(--primary-color)) 24%, transparent),
          var(--button-shadow, none);
      }

      .button-icon,
      .button-label {
        position: relative;
        z-index: 1;
      }

      .button-icon {
        width: var(--m3-button-icon-size, 18px);
        height: var(--m3-button-icon-size, 18px);
        color: currentColor;
        --mdc-icon-size: var(--m3-button-icon-size, 18px);
        flex: 0 0 auto;
      }

      .button-icon[hidden],
      .button-label[hidden] {
        display: none;
      }

      .button-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .variant-filled {
        background: var(--md-sys-color-primary, var(--primary-color));
        color: var(--md-sys-color-on-primary, var(--text-primary-color, #fff));
      }

      .variant-tonal {
        background: var(--md-sys-color-secondary-container, color-mix(in srgb, var(--primary-color) 18%, var(--card-background-color)));
        color: var(--md-sys-color-on-secondary-container, var(--primary-text-color));
      }

      .variant-outlined {
        background: var(--md-sys-color-surface, var(--card-background-color));
        color: var(--md-sys-color-primary, var(--primary-color));
        border-color: var(--md-sys-color-outline, var(--outline-color));
      }

      .variant-text {
        background: transparent;
        color: var(--md-sys-color-primary, var(--primary-color));
        padding-inline: 12px;
      }

      .variant-elevated {
        background: var(--md-sys-color-surface-container-low, var(--card-background-color));
        color: var(--md-sys-color-primary, var(--primary-color));
        --button-shadow:
          0 1px 2px color-mix(in srgb, #000 18%, transparent),
          0 1px 3px color-mix(in srgb, #000 10%, transparent);
        box-shadow: var(--button-shadow);
      }

      .m3-button.is-toggle.variant-filled {
        background: var(--md-sys-color-surface-container, color-mix(in srgb, var(--card-background-color) 84%, white 16%));
        color: var(--md-sys-color-on-surface-variant, var(--secondary-text-color));
      }

      .m3-button.is-toggle.variant-filled.is-selected {
        background: var(--md-sys-color-primary, var(--primary-color));
        color: var(--md-sys-color-on-primary, var(--text-primary-color, #fff));
      }

      .m3-button.is-toggle.variant-tonal.is-selected {
        background: var(--md-sys-color-secondary, color-mix(in srgb, var(--primary-color) 72%, #5c576f));
        color: var(--md-sys-color-on-secondary, #fff);
      }

      .m3-button.is-toggle.variant-outlined.is-selected {
        background: var(--md-sys-color-inverse-surface, color-mix(in srgb, var(--primary-text-color, #fff) 92%, #000 8%));
        color: var(--md-sys-color-inverse-on-surface, var(--card-background-color, #111));
        border-color: transparent;
      }

      .m3-button.is-toggle.variant-elevated.is-selected {
        background: var(--md-sys-color-primary, var(--primary-color));
        color: var(--md-sys-color-on-primary, var(--text-primary-color, #fff));
        box-shadow:
          0 1px 2px color-mix(in srgb, #000 20%, transparent),
          0 2px 6px color-mix(in srgb, #000 14%, transparent);
      }

      .m3-button.is-disabled {
        opacity: 0.38;
        pointer-events: none;
      }
    `;
  }

  _ensureDom() {
    if (this.shadowRoot) {
      this._styleEl = this.shadowRoot.querySelector("style");
      this._buttonEl = this.shadowRoot.querySelector(".m3-button");
      this._anchorEl = this.shadowRoot.querySelector(".button-anchor");
      this._iconEl = this.shadowRoot.querySelector(".button-icon");
      this._labelEl = this.shadowRoot.querySelector(".button-label");
    }

    if (
      this._styleEl instanceof HTMLStyleElement &&
      this._buttonEl instanceof HTMLButtonElement &&
      this._anchorEl instanceof HTMLDivElement &&
      this._iconEl instanceof HTMLElement &&
      this._labelEl instanceof HTMLElement
    ) {
      this._styleEl.textContent = this._stylesheet();
      return;
    }

    this._styleEl = document.createElement("style");
    this._styleEl.textContent = this._stylesheet();

    const card = document.createElement("ha-card");
    this._anchorEl = document.createElement("div");
    this._anchorEl.className = "button-anchor";

    this._buttonEl = document.createElement("button");
    this._buttonEl.type = "button";
    this._buttonEl.className = "m3-button";

    this._iconEl = document.createElement("ha-icon");
    this._iconEl.className = "button-icon";

    this._labelEl = document.createElement("span");
    this._labelEl.className = "button-label";

    this._buttonEl.append(this._iconEl, this._labelEl);
    this._anchorEl.appendChild(this._buttonEl);
    card.appendChild(this._anchorEl);
    this.shadowRoot.replaceChildren(this._styleEl, card);

    this._attachListeners();
  }

  _attachListeners() {
    if (!(this._buttonEl instanceof HTMLElement) || this._buttonEl.dataset.listenersAttached === "true") {
      return;
    }

    this._buttonEl.addEventListener("pointerenter", this._boundPointerEnter);
    this._buttonEl.addEventListener("pointerdown", this._boundPointerDown);
    this._buttonEl.addEventListener("pointerup", this._boundPointerUp);
    this._buttonEl.addEventListener("pointercancel", this._boundPointerCancel);
    this._buttonEl.addEventListener("pointerleave", this._boundPointerLeave);
    this._buttonEl.addEventListener("click", this._boundClick);
    this._buttonEl.addEventListener("keydown", this._boundKeyDown);
    this._buttonEl.addEventListener("keyup", this._boundKeyUp);
    this._buttonEl.addEventListener("focus", this._boundFocus);
    this._buttonEl.addEventListener("blur", this._boundBlur);
    this._buttonEl.dataset.listenersAttached = "true";
  }

  _detachListeners() {
    if (!(this._buttonEl instanceof HTMLElement) || this._buttonEl.dataset.listenersAttached !== "true") {
      return;
    }

    this._buttonEl.removeEventListener("pointerenter", this._boundPointerEnter);
    this._buttonEl.removeEventListener("pointerdown", this._boundPointerDown);
    this._buttonEl.removeEventListener("pointerup", this._boundPointerUp);
    this._buttonEl.removeEventListener("pointercancel", this._boundPointerCancel);
    this._buttonEl.removeEventListener("pointerleave", this._boundPointerLeave);
    this._buttonEl.removeEventListener("click", this._boundClick);
    this._buttonEl.removeEventListener("keydown", this._boundKeyDown);
    this._buttonEl.removeEventListener("keyup", this._boundKeyUp);
    this._buttonEl.removeEventListener("focus", this._boundFocus);
    this._buttonEl.removeEventListener("blur", this._boundBlur);
    delete this._buttonEl.dataset.listenersAttached;
  }

  _applyConfig() {
    if (!this._config || !(this._buttonEl instanceof HTMLElement) || !(this._anchorEl instanceof HTMLElement)) {
      return;
    }

    this.style.cssText = this._hostStyle();

    const metrics = this._sizeMetrics();
    this._buttonEl.style.setProperty("--m3-button-min-height", metrics.minHeight);
    this._buttonEl.style.setProperty("--m3-button-padding-block", metrics.paddingBlock);
    this._buttonEl.style.setProperty("--m3-button-padding-inline", metrics.paddingInline);
    this._buttonEl.style.setProperty("--m3-button-icon-size", metrics.iconSize);

    this._buttonEl.className = [
      "m3-button",
      this._variantClass(),
      this._shapeClass(),
      this._sizeClass(),
      this._config.toggle ? "is-toggle" : "",
      this._config.iconPosition === "trailing" ? "icon-trailing" : "",
      this._config.disabled ? "is-disabled" : "",
    ].filter(Boolean).join(" ");

    this._buttonEl.style.width = this._config.fullWidth ? "100%" : "auto";
    this._buttonEl.disabled = this._config.disabled;
    this._buttonEl.setAttribute(
      "aria-label",
      this._config.ariaLabel || this._config.label || "Button"
    );

    this._anchorEl.style.justifyContent = this._config.floating
      ? "center"
      : this._config.fullWidth
        ? "stretch"
        : "center";

    if (this._config.icon) {
      this._iconEl.hidden = false;
      this._iconEl.setAttribute("icon", this._config.icon);
    } else {
      this._iconEl.hidden = true;
      this._iconEl.removeAttribute("icon");
    }

    if (this._config.label) {
      this._labelEl.hidden = false;
      this._labelEl.textContent = this._config.label;
    } else {
      this._labelEl.hidden = true;
      this._labelEl.textContent = "";
    }
  }

  _clearHoldTimer() {
    if (this._holdTimer) {
      window.clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  _clearTapTimer() {
    if (this._tapTimer) {
      window.clearTimeout(this._tapTimer);
      this._tapTimer = null;
    }
  }

  _reconcileOptimisticSelected() {
    if (this._optimisticSelected === null) {
      return;
    }
    const now = Date.now();
    if (now >= this._optimisticSelectedUntil) {
      this._optimisticSelected = null;
      this._optimisticSelectedUntil = 0;
      return;
    }
    if (!this._config?.entity || !this._hass) {
      return;
    }
    const entityState = this._hass.states?.[this._config.entity]?.state;
    if (entityState == null) {
      return;
    }
    const actual = String(entityState) === this._config.selectedState;
    if (actual === this._optimisticSelected) {
      this._optimisticSelected = null;
      this._optimisticSelectedUntil = 0;
    }
  }

  _selected() {
    if (!this._config?.toggle) {
      return false;
    }
    if (this._optimisticSelected !== null && Date.now() < this._optimisticSelectedUntil) {
      return this._optimisticSelected;
    }
    if (this._config.entity && this._hass?.states?.[this._config.entity]) {
      return String(this._hass.states[this._config.entity].state) === this._config.selectedState;
    }
    return Boolean(this._config.selected);
  }

  _setOptimisticSelected(selected) {
    this._optimisticSelected = Boolean(selected);
    this._optimisticSelectedUntil = Date.now() + 2500;
    this._syncVisualState();
  }

  _predictSelectedFromAction(actionConfig, entityId) {
    if (!this._config?.toggle) {
      return null;
    }
    const action = actionConfig?.action || "none";
    const current = this._selected();
    if (action === "toggle" && entityId) {
      return !current;
    }
    if (action !== "call-service" && action !== "perform-action") {
      return null;
    }
    const serviceRef = String(actionConfig.service || actionConfig.perform_action || "");
    const [domain, service] = serviceRef.split(".", 2);
    if (!domain || !service) {
      return null;
    }
    if (service === "toggle" && entityId) {
      return !current;
    }
    if (service === "turn_on") {
      return true;
    }
    if (service === "turn_off") {
      return false;
    }
    return null;
  }

  _restRadius(selected = this._selected()) {
    const squareRadius = this._sizeMetrics().squareRadius;
    if (!this._config?.toggle) {
      return this._config?.shape === "square" ? squareRadius : "999px";
    }
    if (this._config.shape === "round") {
      return selected ? squareRadius : "999px";
    }
    return selected ? "999px" : squareRadius;
  }

  _pressedRadius() {
    return this._sizeMetrics().pressedRadius;
  }

  _currentRadius() {
    if (!(this._buttonEl instanceof HTMLElement)) {
      return this._restRadius();
    }
    return this._buttonEl.style.borderRadius || getComputedStyle(this._buttonEl).borderRadius || this._restRadius();
  }

  _setRadius(radius) {
    if (this._buttonEl instanceof HTMLElement) {
      this._buttonEl.style.borderRadius = radius;
    }
  }

  _cancelCurrentAnimation(commitStyles = true) {
    if (!this._currentAnimation) {
      return;
    }
    if (commitStyles && this._buttonEl instanceof HTMLElement) {
      const computed = getComputedStyle(this._buttonEl);
      if (computed.transform && computed.transform !== "none") {
        this._buttonEl.style.transform = computed.transform;
      }
      if (computed.borderRadius) {
        this._buttonEl.style.borderRadius = computed.borderRadius;
      }
    }
    this._currentAnimation.cancel();
    this._currentAnimation = null;
  }

  _animateButton(keyframes, options, finalStyles = null) {
    if (!this._config?.spring || !(this._buttonEl instanceof HTMLElement) || !this._buttonEl.animate) {
      return;
    }

    this._cancelCurrentAnimation(true);
    this._currentAnimation = this._buttonEl.animate(keyframes, {
      fill: "forwards",
      ...options,
    });
    this._currentAnimation.onfinish = () => {
      if (this._buttonEl && finalStyles) {
        if (finalStyles.transform != null) {
          this._buttonEl.style.transform = finalStyles.transform;
        }
        if (finalStyles.borderRadius != null) {
          this._buttonEl.style.borderRadius = finalStyles.borderRadius;
        }
      }
      this._currentAnimation?.cancel();
      this._currentAnimation = null;
    };
    this._currentAnimation.oncancel = () => {
      this._currentAnimation = null;
    };
  }

  _animatePress() {
    const fromRadius = this._currentRadius();
    const toRadius = this._pressedRadius();
    this._animateButton(
      [
        { transform: "translateY(0) scale(1)", borderRadius: fromRadius },
        { transform: "translateY(1px) scale(0.982)", borderRadius: toRadius },
      ],
      {
        duration: 130,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      },
      {
        transform: "translateY(1px) scale(0.982)",
        borderRadius: toRadius,
      }
    );
  }

  _animateRelease() {
    const fromRadius = this._currentRadius();
    const toRadius = this._restRadius();
    this._animateButton(
      [
        { transform: "translateY(1px) scale(0.982)", borderRadius: fromRadius },
        { transform: "translateY(-1px) scale(1.012)", borderRadius: toRadius, offset: 0.42 },
        { transform: "translateY(0) scale(0.998)", borderRadius: toRadius, offset: 0.76 },
        { transform: "translateY(0) scale(1)", borderRadius: toRadius },
      ],
      {
        duration: 320,
        easing: "cubic-bezier(0.2, 0.9, 0.25, 1)",
      },
      {
        transform: "translateY(0) scale(1)",
        borderRadius: toRadius,
      }
    );
  }

  _animateSelectionChange(fromSelected, toSelected) {
    if (!this._config?.toggle || fromSelected === toSelected || !(this._buttonEl instanceof HTMLElement)) {
      this._setRadius(this._restRadius(toSelected));
      return;
    }

    const fromRadius = this._currentRadius();
    const toRadius = this._restRadius(toSelected);
    this._animateButton(
      [
        { transform: "translateY(0) scale(1)", borderRadius: fromRadius },
        { transform: "translateY(0) scale(1.008)", borderRadius: toRadius, offset: 0.48 },
        { transform: "translateY(0) scale(1)", borderRadius: toRadius },
      ],
      {
        duration: 220,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      },
      {
        transform: "translateY(0) scale(1)",
        borderRadius: toRadius,
      }
    );
  }

  _syncVisualState(options = {}) {
    const { force = false, animateSelection = true } = options;
    if (!(this._buttonEl instanceof HTMLElement) || !this._config) {
      return;
    }

    const selected = this._selected();
    const selectionChanged = force || this._lastSelected === null || this._lastSelected !== selected;

    this._buttonEl.classList.toggle("is-toggle", this._config.toggle);
    this._buttonEl.classList.toggle("is-disabled", this._config.disabled);
    this._buttonEl.classList.toggle("is-hovered", this._hovered && !this._pressed);
    this._buttonEl.classList.toggle("is-focus-visible", this._focusVisible);
    this._buttonEl.classList.toggle("is-selected", selected);
    this._buttonEl.classList.toggle("is-pressed", this._pressed);
    this._buttonEl.setAttribute(
      "aria-pressed",
      this._config.toggle ? (selected ? "true" : "false") : "false"
    );

    if (force) {
      this._cancelCurrentAnimation(false);
      this._buttonEl.style.transform = "translateY(0) scale(1)";
      this._setRadius(this._restRadius(selected));
    } else if (!this._pressed && selectionChanged) {
      if (animateSelection && this._config.spring) {
        this._animateSelectionChange(this._lastSelected, selected);
      } else {
        this._setRadius(this._restRadius(selected));
      }
    }

    this._lastSelected = selected;
  }

  _handlePointerDown(event) {
    if (this._config?.disabled) {
      return;
    }
    this._hovered = true;
    this._pressed = true;
    this._focusVisible = false;
    if (this._buttonEl?.setPointerCapture) {
      try {
        this._buttonEl.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Ignore pointer capture failures.
      }
    }
    this._syncVisualState({ animateSelection: false });
    this._holdTriggered = false;
    this._clearHoldTimer();
    this._animatePress();

    if (this._config?.holdAction && this._config.holdAction.action !== "none") {
      this._holdTimer = window.setTimeout(async () => {
        this._holdTriggered = true;
        this._clearTapTimer();
        await this._performAction(this._config.holdAction);
      }, this._config.holdTimeMs);
    }
  }

  _handlePointerUp(event) {
    this._clearHoldTimer();
    if (!this._pressed) {
      return;
    }
    if (this._buttonEl?.releasePointerCapture && event?.pointerId != null) {
      try {
        this._buttonEl.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // Ignore pointer capture release failures.
      }
    }
    this._pressed = false;
    this._syncVisualState({ animateSelection: false });
    this._animateRelease();
  }

  _handlePointerEnter() {
    if (this._config?.disabled) {
      return;
    }
    this._hovered = true;
    this._syncVisualState({ animateSelection: false });
  }

  _handlePointerLeave() {
    this._hovered = false;
    this._syncVisualState({ animateSelection: false });
  }

  _handlePointerCancel(event) {
    this._clearHoldTimer();
    this._hovered = false;
    if (this._buttonEl?.releasePointerCapture && event?.pointerId != null) {
      try {
        this._buttonEl.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // Ignore pointer capture release failures.
      }
    }
    if (!this._pressed) {
      this._syncVisualState({ animateSelection: false });
      return;
    }
    this._pressed = false;
    this._syncVisualState({ animateSelection: false });
    this._animateRelease();
  }

  _handleFocus(event) {
    this._focusVisible = event.target?.matches?.(":focus-visible") ?? false;
    this._syncVisualState({ animateSelection: false });
  }

  _handleBlur() {
    this._focusVisible = false;
    this._syncVisualState({ animateSelection: false });
  }

  async _handleClick(event) {
    if (this._config?.disabled) {
      event.preventDefault();
      return;
    }

    if (this._holdTriggered) {
      event.preventDefault();
      this._holdTriggered = false;
      return;
    }

    const doubleTapAction = this._config?.doubleTapAction;
    if (doubleTapAction && doubleTapAction.action !== "none") {
      if (this._tapTimer) {
        this._clearTapTimer();
        await this._performAction(doubleTapAction);
        return;
      }
      this._tapTimer = window.setTimeout(async () => {
        this._tapTimer = null;
        if (this._config?.tapAction && this._config.tapAction.action !== "none") {
          await this._performAction(this._config.tapAction);
        }
      }, 220);
      return;
    }

    if (this._config?.tapAction && this._config.tapAction.action !== "none") {
      await this._performAction(this._config.tapAction);
    }
  }

  _handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    this._focusVisible = true;
    if (!this._pressed) {
      this._pressed = true;
      this._syncVisualState({ animateSelection: false });
      this._animatePress();
    }
  }

  async _handleKeyUp(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    this._pressed = false;
    this._focusVisible = true;
    this._syncVisualState({ animateSelection: false });
    this._animateRelease();
    if (this._config?.tapAction && this._config.tapAction.action !== "none") {
      await this._performAction(this._config.tapAction);
    }
  }

  _navigate(path) {
    if (!path) {
      return;
    }
    window.history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
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

  async _performAction(actionConfig) {
    if (!actionConfig || !this._hass) {
      return;
    }

    const action = actionConfig.action || "none";
    const entityId = actionConfig.entity || this._config?.entity || "";
    const predictedSelected = this._predictSelectedFromAction(actionConfig, entityId);

    switch (action) {
      case "none":
        return;
      case "navigate":
        this._navigate(actionConfig.navigation_path || actionConfig.path || "");
        return;
      case "url": {
        const url = actionConfig.url_path || actionConfig.url || "";
        if (url) {
          if (actionConfig.new_tab) {
            window.open(url, "_blank", "noopener");
          } else {
            window.location.assign(url);
          }
        }
        return;
      }
      case "more-info":
        if (entityId) {
          this._fire("hass-more-info", { entityId });
        }
        return;
      case "toggle":
        if (entityId) {
          if (predictedSelected !== null) {
            this._setOptimisticSelected(predictedSelected);
          }
          await this._hass.callService("homeassistant", "toggle", { entity_id: entityId });
        }
        return;
      case "call-service":
      case "perform-action": {
        const serviceRef = actionConfig.service || actionConfig.perform_action || "";
        const [domain, service] = String(serviceRef).split(".", 2);
        if (!domain || !service) {
          throw new Error(`Invalid service reference: ${serviceRef}`);
        }
        const serviceData = { ...(actionConfig.service_data || actionConfig.data || {}) };
        if (!serviceData.entity_id && entityId) {
          serviceData.entity_id = entityId;
        }
        if (predictedSelected !== null) {
          this._setOptimisticSelected(predictedSelected);
        }
        await this._hass.callService(domain, service, serviceData, actionConfig.target);
        return;
      }
      default:
        console.warn("Unsupported m3-button action", actionConfig);
    }
  }
}

const ExistingM3Button = customElements.get("m3-button");
if (ExistingM3Button) {
  const sourceProto = M3Button.prototype;
  const targetProto = ExistingM3Button.prototype;
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
  ExistingM3Button.getStubConfig = M3Button.getStubConfig;
} else {
  customElements.define("m3-button", M3Button);
}

window.customCards = window.customCards || [];
if (!window.customCards.find((card) => card.type === "m3-button")) {
  window.customCards.push({
    type: "m3-button",
    name: "M3 Button",
    description: "Material 3 button with variants and spring-style motion for Lovelace",
  });
}

// src/m3-tabs.js
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

// src/m3-panel-stack.js
class M3PanelStack extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._cards = [];
    this._rendered = false;
  }

  async setConfig(config) {
    if (!config || !Array.isArray(config.cards) || config.cards.length === 0) {
      throw new Error("m3-panel-stack requires a non-empty cards array");
    }

    this._config = {
      gap: config.gap || "8px",
      cards: config.cards,
    };

    await this._buildCards();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    for (const card of this._cards) {
      card.hass = hass;
    }
  }

  async _buildCards() {
    const helpers = await window.loadCardHelpers();
    this._cards = this._config.cards.map((cardConfig) => helpers.createCardElement(cardConfig));
    if (this._hass) {
      for (const card of this._cards) {
        card.hass = this._hass;
      }
    }
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    this.style.cssText = [
      "display:block",
      "width:100%",
      "min-width:100%",
      "max-width:none",
      "align-self:stretch",
      "justify-self:stretch",
      "flex:1 1 auto",
    ].join(";");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block !important;
          width: 100% !important;
          min-width: 100% !important;
          max-width: none !important;
          align-self: stretch !important;
          justify-self: stretch !important;
          flex: 1 1 auto !important;
        }

        * {
          box-sizing: border-box;
        }

        ha-card {
          display: block !important;
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          background: transparent;
          border: 0;
          box-shadow: none;
          overflow: visible;
        }

        .stack {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: ${this._escape(this._config.gap)};
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
        }

        .slot {
          display: block !important;
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
        }

        .slot > * {
          display: block !important;
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          align-self: stretch !important;
          justify-self: stretch !important;
        }
      </style>
      <ha-card>
        <div class="stack"></div>
      </ha-card>
    `;

    const stack = this.shadowRoot.querySelector(".stack");
    for (const card of this._cards) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.appendChild(card);
      stack.appendChild(slot);
    }

    this._rendered = true;
  }

  _escape(value) {
    return String(value).replace(/[<>&"'`]/g, "");
  }

  getCardSize() {
    return this._cards.reduce((sum, card) => {
      if (typeof card.getCardSize === "function") {
        return sum + card.getCardSize();
      }
      return sum + 1;
    }, 0);
  }

  static getConfigElement() {
    return document.createElement("div");
  }

  static getStubConfig() {
    return {
      type: "custom:m3-panel-stack",
      cards: [],
    };
  }
}

if (!customElements.get("m3-panel-stack")) {
  customElements.define("m3-panel-stack", M3PanelStack);
}

window.customCards = window.customCards || [];
if (!window.customCards.find((card) => card.type === "m3-panel-stack")) {
  window.customCards.push({
    type: "m3-panel-stack",
    name: "M3 Panel Stack",
    description: "Material 3 stack container for composing multiple Lovelace cards",
  });
}
