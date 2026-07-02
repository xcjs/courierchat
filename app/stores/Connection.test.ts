import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConnectionStore } from './Connection';
import { UiTransportMode } from '~/features/transport/types/Transport';

describe('ConnectionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts disconnected with no active room', () => {
    const conn = useConnectionStore();
    expect(conn.signalingConnected).toBe(false);
    expect(conn.heartbeatActive).toBe(false);
    expect(conn.activeRoomName).toBeNull();
    expect(conn.activeRoomMode).toBe(UiTransportMode.Offline);
    expect(conn.activeRoomPeerCount).toBe(0);
  });

  it('transportMode is Offline when signaling not connected', () => {
    const conn = useConnectionStore();
    conn.setActiveRoom('lobby');
    conn.setActiveRoomMode(UiTransportMode.Mesh);
    expect(conn.transportMode).toBe(UiTransportMode.Offline);
  });

  it('transportMode is Offline when no active room', () => {
    const conn = useConnectionStore();
    conn.setSignalingConnected(true);
    expect(conn.transportMode).toBe(UiTransportMode.Offline);
  });

  it('transportMode reflects active room mode when connected', () => {
    const conn = useConnectionStore();
    conn.setSignalingConnected(true);
    conn.setActiveRoom('lobby');
    conn.setActiveRoomMode(UiTransportMode.Star);
    expect(conn.transportMode).toBe(UiTransportMode.Star);
  });

  it('setActiveRoom(null) resets mode and peer count', () => {
    const conn = useConnectionStore();
    conn.setSignalingConnected(true);
    conn.setActiveRoom('lobby');
    conn.setActiveRoomMode(UiTransportMode.Mesh);
    conn.setActiveRoomPeerCount(5);
    conn.setActiveRoom(null);
    expect(conn.activeRoomName).toBeNull();
    expect(conn.activeRoomMode).toBe(UiTransportMode.Offline);
    expect(conn.activeRoomPeerCount).toBe(0);
  });

  it('setSignalingConnected updates value', () => {
    const conn = useConnectionStore();
    conn.setSignalingConnected(true);
    expect(conn.signalingConnected).toBe(true);
    conn.setSignalingConnected(false);
    expect(conn.signalingConnected).toBe(false);
  });

  it('setHeartbeatActive updates value', () => {
    const conn = useConnectionStore();
    conn.setHeartbeatActive(true);
    expect(conn.heartbeatActive).toBe(true);
  });

  it('setActiveRoomMode updates value', () => {
    const conn = useConnectionStore();
    conn.setActiveRoom('lobby');
    conn.setActiveRoomMode(UiTransportMode.Relay);
    expect(conn.activeRoomMode).toBe(UiTransportMode.Relay);
  });

  it('setActiveRoomPeerCount updates value', () => {
    const conn = useConnectionStore();
    conn.setActiveRoom('lobby');
    conn.setActiveRoomPeerCount(3);
    expect(conn.activeRoomPeerCount).toBe(3);
  });

  it('reset clears all state', () => {
    const conn = useConnectionStore();
    conn.setSignalingConnected(true);
    conn.setHeartbeatActive(true);
    conn.setActiveRoom('lobby');
    conn.setActiveRoomMode(UiTransportMode.Mesh);
    conn.setActiveRoomPeerCount(4);
    conn.reset();
    expect(conn.signalingConnected).toBe(false);
    expect(conn.heartbeatActive).toBe(false);
    expect(conn.activeRoomName).toBeNull();
    expect(conn.activeRoomMode).toBe(UiTransportMode.Offline);
    expect(conn.activeRoomPeerCount).toBe(0);
  });
});
