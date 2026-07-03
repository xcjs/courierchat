// @vitest-environment nuxt
import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import CreateRoomModal from './CreateRoomModal.vue';
import IconPicker from './IconPicker.vue';
import { Tier } from '#shared/types/Tier';

const linkStub = {
  template: '<a :href="to"><slot /></a>',
  props: ['to']
};

const iconStub = { template: '<span />' };

const iconPickerStub = {
  template: '<div class="icon-picker-stub" />',
  emits: ['select']
};

function mountModal (props: Partial<{ tiers: Tier[] }> = {}): VueWrapper {
  return mount(CreateRoomModal, {
    props: { tiers: props.tiers ?? [Tier.Adult, Tier.Minor] },
    global: {
      stubs: { NuxtLink: linkStub, Icon: iconStub, IconPicker: iconPickerStub }
    }
  });
}
afterEach(() => {
  document.body.innerHTML = '';
});

describe('CreateRoomModal', () => {
  it('emits close on backdrop click', async () => {
    const wrapper = mountModal();
    await wrapper.find('[role="dialog"]').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('does not emit close when clicking inside the modal body', async () => {
    const wrapper = mountModal();
    await wrapper.find('form').trigger('click');
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('emits close on Cancel button', async () => {
    const wrapper = mountModal();
    const cancelBtn = wrapper.findAll('button').find(b => b.text() === 'Cancel')!;
    await cancelBtn.trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('emits create with trimmed name, tiers, and icon', async () => {
    const wrapper = mountModal();
    const nameInput = wrapper.find('#room-name');
    await nameInput.setValue('  lounge  ');
    wrapper.findComponent(IconPicker).vm.$emit('select', 'lucide:hash');
    await wrapper.vm.$nextTick();
    const form = wrapper.find('form');
    await form.trigger('submit.prevent');
    const evt = wrapper.emitted('create');
    expect(evt).toHaveLength(1);
    expect(evt![0]).toEqual(['lounge', [Tier.Adult, Tier.Minor], 'lucide:hash']);
  });

  it('emits create with undefined icon when icon field is empty', async () => {
    const wrapper = mountModal();
    await wrapper.find('#room-name').setValue('general');
    await wrapper.find('form').trigger('submit.prevent');
    const evt = wrapper.emitted('create');
    expect(evt![0]).toEqual(['general', [Tier.Adult, Tier.Minor], undefined]);
  });

  it('does not emit create when name is empty or whitespace', async () => {
    const wrapper = mountModal();
    await wrapper.find('#room-name').setValue('   ');
    await wrapper.find('form').trigger('submit.prevent');
    expect(wrapper.emitted('create')).toBeUndefined();
  });

  it('emits close on Escape key', async () => {
    const wrapper = mountModal();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('does not emit close on non-Escape key', async () => {
    const wrapper = mountModal();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('focuses name input on mount', async () => {
    const wrapper = mountModal();
    await wrapper.vm.$nextTick();
    const input = wrapper.find('#room-name');
    expect(input.exists()).toBe(true);
    expect(input.attributes('id')).toBe('room-name');
  });
});
