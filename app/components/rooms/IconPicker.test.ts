// @vitest-environment nuxt
import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import IconPicker from './IconPicker.vue';

const iconStub = { template: '<span :data-icon="name" />' };

function mountPicker (props: Partial<{ selectedIcon: string }> = {}): VueWrapper {
  return mount(IconPicker, {
    props: { selectedIcon: props.selectedIcon ?? '' },
    global: { stubs: { Icon: iconStub } }
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('IconPicker', () => {
  it('renders icons tab by default', () => {
    const wrapper = mountPicker();
    const icons = wrapper.findAll('[title^="lucide:"]');
    expect(icons.length).toBeGreaterThan(0);
  }, 15000);

  it('switches to emojis tab on click', async () => {
    const wrapper = mountPicker();
    await wrapper.findAll('button').find(b => b.text() === 'Emojis')!.trigger('click');
    const emojis = wrapper.findAll('[title^="emoji:"]');
    expect(emojis.length).toBeGreaterThan(0);
  });

  it('emits select with lucide: prefix when an icon is clicked', async () => {
    const wrapper = mountPicker();
    const firstIcon = wrapper.find('[title^="lucide:"]');
    const name = firstIcon.attributes('title')!;
    await firstIcon.trigger('click');
    expect(wrapper.emitted('select')).toEqual([[name]]);
  });

  it('emits select with emoji: prefix when an emoji is clicked', async () => {
    const wrapper = mountPicker();
    await wrapper.findAll('button').find(b => b.text() === 'Emojis')!.trigger('click');
    const firstEmoji = wrapper.find('[title^="emoji:"]');
    const name = firstEmoji.attributes('title')!;
    await firstEmoji.trigger('click');
    expect(wrapper.emitted('select')).toEqual([[name]]);
  });

  it('filters icons by search query', async () => {
    const wrapper = mountPicker();
    const search = wrapper.find('input[type="search"]');
    await search.setValue('hash');
    const icons = wrapper.findAll('[title^="lucide:"]');
    expect(icons.length).toBeGreaterThan(0);
    icons.forEach((btn) => {
      expect(btn.attributes('title')!.toLowerCase()).toContain('hash');
    });
  });

  it('filters emojis by keyword search', async () => {
    const wrapper = mountPicker();
    await wrapper.findAll('button').find(b => b.text() === 'Emojis')!.trigger('click');
    await wrapper.find('input[type="search"]').setValue('heart');
    const emojis = wrapper.findAll('[title^="emoji:"]');
    expect(emojis.length).toBeGreaterThan(0);
  });

  it('shows no-match message when search yields nothing', async () => {
    const wrapper = mountPicker();
    await wrapper.find('input[type="search"]').setValue('zzzzzzzzzzzzz');
    expect(wrapper.text()).toContain('No icons match.');
  });

  it('emits select with empty string when Clear is clicked', async () => {
    const wrapper = mountPicker();
    await wrapper.findAll('button').find(b => b.text() === 'Clear')!.trigger('click');
    expect(wrapper.emitted('select')).toEqual([['']]);
  });

  it('highlights the selected icon', async () => {
    const wrapper = mountPicker();
    const firstIcon = wrapper.find('[title^="lucide:"]');
    const name = firstIcon.attributes('title')!;
    await wrapper.setProps({ selectedIcon: name });
    const selBtn = wrapper.find(`[title="${name}"]`);
    expect(selBtn.classes()).toContain('ring-background-interactive');
  });

  it('shows all icons when no search is active', () => {
    const wrapper = mountPicker();
    const icons = wrapper.findAll('[title^="lucide:"]');
    expect(icons.length).toBeGreaterThan(128);
  });
});
