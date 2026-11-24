import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import EmptyState from "./EmptyState.vue";

describe("EmptyState", () => {
  it("renders message text", () => {
    const wrapper = mount(EmptyState, {
      props: { message: "No tasks found" },
    });
    expect(wrapper.text()).toContain("No tasks found");
  });

  it("renders an SVG icon for a known icon key", () => {
    const wrapper = mount(EmptyState, {
      props: { message: "Empty", icon: "clipboard" },
    });
    const icon = wrapper.find(".empty-icon");
    expect(icon.exists()).toBe(true);
    expect(icon.find("svg").exists()).toBe(true);
  });

  it("does not render an icon for an unknown key", () => {
    const wrapper = mount(EmptyState, {
      props: { message: "Empty", icon: "not-a-real-icon" },
    });
    expect(wrapper.find(".empty-icon").exists()).toBe(false);
  });

  it("does not render icon when omitted", () => {
    const wrapper = mount(EmptyState, {
      props: { message: "Empty" },
    });
    expect(wrapper.find(".empty-icon").exists()).toBe(false);
  });

  it("renders default slot content", () => {
    const wrapper = mount(EmptyState, {
      props: { message: "Nothing here" },
      slots: { default: '<button class="retry-btn">Retry</button>' },
    });
    expect(wrapper.find(".retry-btn").exists()).toBe(true);
  });
});
