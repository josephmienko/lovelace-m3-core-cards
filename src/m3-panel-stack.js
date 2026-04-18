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
