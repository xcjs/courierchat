// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import ShellHeader from './ShellHeader.vue';
import { UiTransportMode } from '~/features/transport/types/Transport';

const nuxtLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to']
};

const iconStub = { template: '<span class="icon-stub" />' };
const imgStub = { template: '<img />' };

function mountHeader (props: { connected: boolean; roomName?: string; memberCount?: number; transportMode?: UiTransportMode; username?: string | null }): VueWrapper {
  return mount(ShellHeader, {
    props,
    global: {
      stubs: { NuxtLink: nuxtLinkStub, Icon: iconStub, img: imgStub }
    }
  });
}

describe('ShellHeader', () => {
  it('renders default title when no roomName', () => {
    const wrapper = mountHeader({ connected: false });
    expect(wrapper.find('h1').text()).toBe('CourierChat');
  });

  it('renders room name when provided', () => {
    const wrapper = mountHeader({ roomName: 'lounge', connected: true });
    expect(wrapper.find('h1').text()).toBe('lounge');
  });

  it('shows member count when provided', () => {
    const wrapper = mountHeader({ roomName: 'lounge', memberCount: 5, connected: true });
    expect(wrapper.text()).toContain('5 members');
  });

  it('shows singular member when count is 1', () => {
    const wrapper = mountHeader({ roomName: 'lounge', memberCount: 1, connected: true });
    expect(wrapper.text()).toContain('1 member');
  });

  it('shows sign in link when no username', () => {
    const wrapper = mountHeader({ connected: false });
    expect(wrapper.text()).toContain('Sign In');
  });

  it('shows username when provided', () => {
    const wrapper = mountHeader({ username: 'alice', connected: true });
    expect(wrapper.text()).toContain('alice');
  });

  it('emits logout when logout button clicked', async () => {
    const wrapper = mountHeader({ username: 'alice', connected: true });
    await wrapper.find('[aria-label="User menu"]').trigger('click');
    const logoutBtn = wrapper.findAll('button').find(b => b.text() === 'Log Out');
    expect(logoutBtn).toBeDefined();
    await logoutBtn!.trigger('click');
    expect(wrapper.emitted('logout')).toHaveLength(1);
  });

  it('toggles menu on user button click', async () => {
    const wrapper = mountHeader({ username: 'alice', connected: true });
    const btn = wrapper.find('[aria-label="User menu"]');
    expect(wrapper.find('.absolute.right-0.top-10').exists()).toBe(false);
    await btn.trigger('click');
    expect(wrapper.find('.absolute.right-0.top-10').exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.find('.absolute.right-0.top-10').exists()).toBe(false);
  });

  it('renders offline icon when disconnected', () => {
    const wrapper = mountHeader({ username: 'alice', connected: false });
    const statusSpan = wrapper.find('[title^="Status:"]');
    expect(statusSpan.exists()).toBe(true);
    expect(statusSpan.html()).toContain('text-text-error');
  });

  it('renders online icon when connected', () => {
    const wrapper = mountHeader({ username: 'alice', connected: true });
    const statusSpan = wrapper.find('[title^="Status:"]');
    expect(statusSpan.exists()).toBe(true);
    expect(statusSpan.html()).toContain('text-green-500');
  });

  it('shows online status label in menu', async () => {
    const wrapper = mountHeader({ username: 'alice', connected: true });
    await wrapper.find('[aria-label="User menu"]').trigger('click');
    const menu = wrapper.find('.absolute.right-0.top-10');
    expect(menu.text()).toContain('online');
  });

  it('shows offline status label in menu', async () => {
    const wrapper = mountHeader({ username: 'alice', connected: false });
    await wrapper.find('[aria-label="User menu"]').trigger('click');
    const menu = wrapper.find('.absolute.right-0.top-10');
    expect(menu.text()).toContain('offline');
  });

  it('shows mesh status label in menu when in mesh mode', async () => {
    const wrapper = mountHeader({ username: 'alice', connected: true, transportMode: UiTransportMode.Mesh });
    await wrapper.find('[aria-label="User menu"]').trigger('click');
    const menu = wrapper.find('.absolute.right-0.top-10');
    expect(menu.text()).toContain('mesh');
  });

  it('shows relay status with amber icon in menu', async () => {
    const wrapper = mountHeader({ username: 'alice', connected: true, transportMode: UiTransportMode.Relay });
    await wrapper.find('[aria-label="User menu"]').trigger('click');
    const menu = wrapper.find('.absolute.right-0.top-10');
    expect(menu.text()).toContain('relay');
    expect(menu.text()).not.toContain('mesh mode');
  });
});
