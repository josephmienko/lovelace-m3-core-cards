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
