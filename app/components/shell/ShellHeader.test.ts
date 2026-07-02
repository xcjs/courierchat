// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import ShellHeader from './ShellHeader.vue';
import { UiTransportMode } from '~/features/transport/types/Transport';

const nuxtLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to']
};

const iconStub = { template: '<span />' };
const imgStub = { template: '<img />' };

function mountHeader (props: { transportMode: UiTransportMode; roomName?: string; memberCount?: number; username?: string | null }): VueWrapper {
  return mount(ShellHeader, {
    props,
    global: {
      stubs: { NuxtLink: nuxtLinkStub, Icon: iconStub, img: imgStub }
    }
  });
}

describe('ShellHeader', () => {
  it('renders default title when no roomName', () => {
    const wrapper = mountHeader({ transportMode: UiTransportMode.Offline });
    expect(wrapper.find('h1').text()).toBe('CourierChat');
  });

  it('renders room name when provided', () => {
    const wrapper = mountHeader({ roomName: 'lounge', transportMode: UiTransportMode.Mesh });
    expect(wrapper.find('h1').text()).toBe('lounge');
  });

  it('shows member count when provided', () => {
    const wrapper = mountHeader({ roomName: 'lounge', memberCount: 5, transportMode: UiTransportMode.Mesh });
    expect(wrapper.text()).toContain('5 members');
  });

  it('shows singular member when count is 1', () => {
    const wrapper = mountHeader({ roomName: 'lounge', memberCount: 1, transportMode: UiTransportMode.Mesh });
    expect(wrapper.text()).toContain('1 member');
  });

  it('shows sign in link when no username', () => {
    const wrapper = mountHeader({ transportMode: UiTransportMode.Offline });
    expect(wrapper.text()).toContain('Sign In');
  });

  it('shows username when provided', () => {
    const wrapper = mountHeader({ username: 'alice', transportMode: UiTransportMode.Mesh });
    expect(wrapper.text()).toContain('alice');
  });

  it('emits logout when logout button clicked', async () => {
    const wrapper = mountHeader({ username: 'alice', transportMode: UiTransportMode.Mesh });
    await wrapper.find('[aria-label="User menu"]').trigger('click');
    const logoutBtn = wrapper.findAll('button').find(b => b.text() === 'Log Out');
    expect(logoutBtn).toBeDefined();
    await logoutBtn!.trigger('click');
    expect(wrapper.emitted('logout')).toHaveLength(1);
  });

  it('toggles menu on user button click', async () => {
    const wrapper = mountHeader({ username: 'alice', transportMode: UiTransportMode.Mesh });
    const btn = wrapper.find('[aria-label="User menu"]');
    expect(wrapper.find('.absolute.right-0.top-10').exists()).toBe(false);
    await btn.trigger('click');
    expect(wrapper.find('.absolute.right-0.top-10').exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.find('.absolute.right-0.top-10').exists()).toBe(false);
  });

  it('renders mode dot for mesh', () => {
    const wrapper = mountHeader({ username: 'alice', transportMode: UiTransportMode.Mesh });
    const dot = wrapper.find('.w-2.h-2.rounded-full');
    expect(dot.classes()).toContain('bg-background-primary');
  });

  it('renders mode dot for relay', () => {
    const wrapper = mountHeader({ username: 'alice', transportMode: UiTransportMode.Relay });
    const dot = wrapper.find('.w-2.h-2.rounded-full');
    expect(dot.classes()).toContain('bg-text-error');
  });

  it('renders mode dot for offline', () => {
    const wrapper = mountHeader({ username: 'alice', transportMode: UiTransportMode.Offline });
    const dot = wrapper.find('.w-2.h-2.rounded-full');
    expect(dot.classes()).toContain('bg-text-error');
  });
});
