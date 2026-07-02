import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ShellStatusBar from './ShellStatusBar.vue';

describe('ShellStatusBar', () => {
  it('renders connected status', () => {
    const wrapper = mount(ShellStatusBar, {
      props: { connected: true, transportMode: 'mesh' }
    });
    expect(wrapper.text()).toContain('Connected');
  });

  it('renders disconnected status', () => {
    const wrapper = mount(ShellStatusBar, {
      props: { connected: false, transportMode: 'mesh' }
    });
    expect(wrapper.text()).toContain('Disconnected');
  });

  it('shows heartbeat indicator when active', () => {
    const wrapper = mount(ShellStatusBar, {
      props: { connected: true, heartbeat: true, transportMode: 'star' }
    });
    expect(wrapper.text()).toContain('heartbeat');
  });

  it('hides heartbeat indicator when not provided', () => {
    const wrapper = mount(ShellStatusBar, {
      props: { connected: true, transportMode: 'mesh' }
    });
    expect(wrapper.text()).not.toContain('heartbeat');
  });

  it('shows transport mode', () => {
    const wrapper = mount(ShellStatusBar, {
      props: { connected: true, transportMode: 'relay' }
    });
    expect(wrapper.text()).toContain('relay mode');
  });

  it('has role=status', () => {
    const wrapper = mount(ShellStatusBar, {
      props: { connected: true, transportMode: 'mesh' }
    });
    expect(wrapper.attributes('role')).toBe('status');
  });
});
