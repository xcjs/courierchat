// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import ShellIconRail from './ShellIconRail.vue';

const nuxtLinkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to']
};

const iconStub = { template: '<span />' };
const imgStub = { template: '<img />' };

function mountRail (props: { rooms: Array<{ name: string; icon?: string }>; activeRoomName?: string }): VueWrapper {
  return mount(ShellIconRail, {
    props,
    global: {
      stubs: { NuxtLink: nuxtLinkStub, Icon: iconStub, img: imgStub }
    }
  });
}

describe('ShellIconRail', () => {
  it('emits create-room when create button clicked', async () => {
    const wrapper = mountRail({ rooms: [] });
    const btn = wrapper.find('[aria-label="Create a Room"]');
    await btn.trigger('click');
    expect(wrapper.emitted('create-room')).toHaveLength(1);
  });

  it('renders room links', () => {
    const wrapper = mountRail({
      rooms: [
        { name: 'lounge', icon: 'lucide:hash' },
        { name: 'general', icon: undefined }
      ]
    });
    const links = wrapper.findAll('a');
    expect(links).toHaveLength(2);
    expect(links[0]!.attributes('href')).toBe('/rooms/lounge');
    expect(links[1]!.attributes('href')).toBe('/rooms/general');
  });

  it('marks active room with aria-current', () => {
    const wrapper = mountRail({
      rooms: [{ name: 'lounge' }, { name: 'general' }],
      activeRoomName: 'lounge'
    });
    const links = wrapper.findAll('a');
    expect(links[0]!.attributes('aria-current')).toBe('true');
    expect(links[1]!.attributes('aria-current')).toBeUndefined();
  });

  it('encodes room names in URL', () => {
    const wrapper = mountRail({ rooms: [{ name: 'my room' }] });
    const link = wrapper.find('a');
    expect(link.attributes('href')).toBe('/rooms/my%20room');
  });
});
