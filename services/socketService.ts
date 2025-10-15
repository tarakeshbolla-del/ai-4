
import type { Kpis, HeatmapDataPoint } from '../types';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../constants';

type EventCallback = (data: any) => void;

class MockSocket {
  private listeners: Map<string, EventCallback[]> = new Map();
  private intervalId?: number;

  connect() {
    console.log('[Socket] Connected');
    this.intervalId = window.setInterval(() => {
      this.simulateEvents();
    }, 5000); // Push updates every 5 seconds
  }

  disconnect() {
    console.log('[Socket] Disconnected');
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.listeners.clear();
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  private emit(event: string, data: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)?.forEach(callback => callback(data));
    }
  }

  private simulateEvents() {
    // Simulate a KPI update
    const kpiUpdate: Partial<Kpis> = {
      deflectionRate: Math.round((78 + Math.random() * 2) * 10) / 10,
      avgTimeToResolution: Math.round((4 + Math.random() * 0.5) * 10) / 10,
    };
    this.emit('kpi_update', kpiUpdate);
    console.log('[Socket] Emitted kpi_update', kpiUpdate);

    // Simulate a heatmap update
    const heatmapUpdate: HeatmapDataPoint = {
      category: TICKET_CATEGORIES[Math.floor(Math.random() * TICKET_CATEGORIES.length)],
      priority: TICKET_PRIORITIES[Math.floor(Math.random() * TICKET_PRIORITIES.length)],
      value: Math.floor(Math.random() * 20) + 1, // small increment
    };
    this.emit('heatmap_update', heatmapUpdate);
    console.log('[Socket] Emitted heatmap_update', heatmapUpdate);
  }
}

export const socketService = new MockSocket();
