import { describe, expect, it, vi } from "vitest";

import "../src/m3-slider.js";
import "../src/m3-button.js";
import "../src/m3-tabs.js";
import "../src/m3-panel-stack.js";

const flushAsyncWork = () => new Promise((resolve) => window.setTimeout(resolve, 0));

describe("lovelace-m3-core-cards", () => {
  it("registers the public custom elements and customCards metadata", () => {
    expect(customElements.get("m3-slider")).toBeTypeOf("function");
    expect(customElements.get("m3-button")).toBeTypeOf("function");
    expect(customElements.get("m3-tabs")).toBeTypeOf("function");
    expect(customElements.get("m3-panel-stack")).toBeTypeOf("function");

    const cardTypes = new Set((window.customCards || []).map((card) => card.type));
    expect(cardTypes.has("m3-slider")).toBe(true);
    expect(cardTypes.has("m3-button")).toBe(true);
    expect(cardTypes.has("m3-tabs")).toBe(true);
    expect(cardTypes.has("m3-panel-stack")).toBe(true);
  });

  it("syncs slider state, dispatches interaction events, and calls light.turn_on", async () => {
    const hass = {
      states: {
        "light.kitchen": {
          entity_id: "light.kitchen",
          state: "on",
          attributes: {
            brightness: 128,
            supported_color_modes: ["brightness"],
          },
        },
      },
      callService: vi.fn().mockResolvedValue(undefined),
    };

    const slider = document.createElement("m3-slider");
    slider.setConfig({
      entity: "light.kitchen",
      show_value_indicator: true,
      show_inset_icon: true,
    });
    document.body.appendChild(slider);
    slider.hass = hass;

    const startSpy = vi.fn();
    const endSpy = vi.fn();
    slider.addEventListener("m3-slider-interaction-start", startSpy);
    slider.addEventListener("m3-slider-interaction-end", endSpy);

    const range = slider.shadowRoot.querySelector(".native-range");
    expect(range).toBeInstanceOf(HTMLInputElement);
    expect(range.value).toBe("50");
    expect(range.getAttribute("aria-valuetext")).toBe("50%");

    range.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    range.value = "75";
    range.dispatchEvent(new Event("change", { bubbles: true }));
    await flushAsyncWork();

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy.mock.calls[0][0].detail).toEqual({ entityId: "light.kitchen" });
    expect(hass.callService).toHaveBeenCalledWith("light", "turn_on", {
      entity_id: "light.kitchen",
      brightness_pct: 75,
    });
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(endSpy.mock.calls[0][0].detail).toEqual({
      entityId: "light.kitchen",
      targetValue: 75,
    });
  });

  it("turns the slider target entity off when the selected value reaches zero", async () => {
    const hass = {
      states: {
        "light.kitchen": {
          entity_id: "light.kitchen",
          state: "on",
          attributes: {
            brightness: 64,
            supported_color_modes: ["brightness"],
          },
        },
      },
      callService: vi.fn().mockResolvedValue(undefined),
    };

    const slider = document.createElement("m3-slider");
    slider.setConfig({ entity: "light.kitchen" });
    document.body.appendChild(slider);
    slider.hass = hass;

    const range = slider.shadowRoot.querySelector(".native-range");
    range.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    range.value = "0";
    range.dispatchEvent(new Event("change", { bubbles: true }));
    await flushAsyncWork();

    expect(hass.callService).toHaveBeenCalledWith("homeassistant", "turn_off", {
      entity_id: "light.kitchen",
    });
  });

  it("toggles button entities through Home Assistant and updates aria-pressed optimistically", async () => {
    const hass = {
      states: {
        "light.patio": {
          entity_id: "light.patio",
          state: "off",
          attributes: {},
        },
      },
      callService: vi.fn().mockResolvedValue(undefined),
    };

    const button = document.createElement("m3-button");
    button.setConfig({
      entity: "light.patio",
      label: "Patio",
      toggle: true,
      spring: false,
    });
    document.body.appendChild(button);
    button.hass = hass;

    const innerButton = button.shadowRoot.querySelector(".m3-button");
    expect(innerButton).toBeInstanceOf(HTMLButtonElement);
    expect(innerButton.getAttribute("aria-pressed")).toBe("false");

    innerButton.click();
    await flushAsyncWork();

    expect(hass.callService).toHaveBeenCalledWith("homeassistant", "toggle", {
      entity_id: "light.patio",
    });
    expect(innerButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("builds panel-stack child cards with helpers and forwards hass to each child", async () => {
    const createdCards = [];

    window.loadCardHelpers = vi.fn().mockResolvedValue({
      createCardElement: vi.fn((cardConfig) => {
        const card = document.createElement("mock-card");
        card.cardConfig = cardConfig;
        card.getCardSize = () => 2;
        createdCards.push(card);
        return card;
      }),
    });

    const stack = document.createElement("m3-panel-stack");
    const hass = { states: {} };
    stack.hass = hass;
    document.body.appendChild(stack);

    await stack.setConfig({
      gap: "12px",
      cards: [
        { type: "entities", entities: ["light.kitchen"] },
        { type: "markdown", content: "Hello" },
      ],
    });

    expect(window.loadCardHelpers).toHaveBeenCalledTimes(1);
    expect(createdCards).toHaveLength(2);
    expect(createdCards[0].hass).toBe(hass);
    expect(createdCards[1].hass).toBe(hass);

    const slots = [...stack.shadowRoot.querySelectorAll(".slot")];
    expect(slots).toHaveLength(2);
    expect(slots[0].firstElementChild).toBe(createdCards[0]);
    expect(slots[1].firstElementChild).toBe(createdCards[1]);
    expect(stack.getCardSize()).toBe(4);
  });
});
