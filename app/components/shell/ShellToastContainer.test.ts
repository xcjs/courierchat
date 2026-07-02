// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ShellToastContainer from './ShellToastContainer.vue';
import { useNotificationsStore, NotificationSeverity } from '~/stores/Notifications';

const iconStub = { template: '<span />' };

function mountToaster (): VueWrapper {
  return mount(ShellToastContainer, {
    global: { stubs: { Icon: iconStub } }
  });
}

describe('ShellToastContainer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when queue is empty', () => {
    const wrapper = mountToaster();
    expect(wrapper.find('[role="region"]').exists()).toBe(false);
  });

  it('renders toast for each queued notification', () => {
    const notifications = useNotificationsStore();
    notifications.push('Hello world');
    notifications.push('Another message');
    const wrapper = mountToaster();
    expect(wrapper.text()).toContain('Hello world');
    expect(wrapper.text()).toContain('Another message');
  });

  it('uses error styling for error severity', () => {
    const notifications = useNotificationsStore();
    notifications.push('Something failed', NotificationSeverity.Error);
    const wrapper = mountToaster();
    const toast = wrapper.find('.pointer-events-auto');
    expect(toast.classes()).toContain('bg-text-error');
  });

  it('uses info styling for info severity', () => {
    const notifications = useNotificationsStore();
    notifications.push('Just info');
    const wrapper = mountToaster();
    const toast = wrapper.find('.pointer-events-auto');
    expect(toast.classes()).toContain('bg-background-interactive');
  });

  it('dismisses notification on button click', async () => {
    vi.useFakeTimers();
    const notifications = useNotificationsStore();
    notifications.push('Dismiss me');
    const wrapper = mountToaster();
    const dismissBtn = wrapper.find('button[aria-label="Dismiss notification"]');
    await dismissBtn.trigger('click');
    expect(notifications.queue).toHaveLength(0);
  });

  it('has region role with aria-label', () => {
    const notifications = useNotificationsStore();
    notifications.push('Test');
    const wrapper = mountToaster();
    expect(wrapper.find('[role="region"]').attributes('aria-label')).toBe('Notifications');
  });
});
