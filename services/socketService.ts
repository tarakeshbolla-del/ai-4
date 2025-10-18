
import type { Kpis, HeatmapDataPoint, SlaBreachTicket } from '../types';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../constants';
import { getTrainingState } from './api';

type EventCallback = (data: any) => void;

// Helper to pick a weighted random item
function getWeightedRandom<T>(items: T[], weights: number[]): T | undefined {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0) {
      return items[Math.floor(Math.random() * items.length)];
    }
    let random = Math.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
        if (random < weights[i]) {
            return items[i];
        }
        random -= weights[i];
    }
    return items[items.length - 1]; // Fallback
}


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

  public emitNewTicket(ticket: SlaBreachTicket) {
    this.emit('new_sla_ticket', ticket);
    console.log('[Socket] Emitted new_sla_ticket', ticket);
  }

  private simulateEvents() {
    const { isModelTrained, dataDistribution } = getTrainingState();

    // Simulate a KPI update
    const deflectionBase = isModelTrained ? 85.2 : 78;
    const timeToBase = isModelTrained ? 3.8 : 4;
    const kpiUpdate: Partial<Kpis> = {
      deflectionRate: Math.max(0, Math.min(100, Math.round((deflectionBase + Math.random() * 0.5 - 0.25) * 10) / 10)),
      avgTimeToResolution: Math.max(0, Math.round((timeToBase + Math.random() * 0.2 - 0.1) * 10) / 10),
    };
    this.emit('kpi_update', kpiUpdate);
    console.log('[Socket] Emitted kpi_update', kpiUpdate);

    // Simulate a heatmap update
    let category: string;
    let priority: string;

    if (isModelTrained && dataDistribution && dataDistribution.categories.length > 0) {
        // Weighted random selection based on trained data distribution
        category = getWeightedRandom(dataDistribution.categories, dataDistribution.categoryWeights) || TICKET_CATEGORIES[0];
        priority = dataDistribution.priorities[Math.floor(Math.random() * dataDistribution.priorities.length)];
    } else {
        // Original random selection
        category = TICKET_CATEGORIES[Math.floor(Math.random() * TICKET_CATEGORIES.length)];
        priority = TICKET_PRIORITIES[Math.floor(Math.random() * TICKET_PRIORITIES.length)];
    }

    const heatmapUpdate: HeatmapDataPoint = {
      category,
      priority,
      value: Math.floor(Math.random() * 5) + 1, // small increment
    };
    this.emit('heatmap_update', heatmapUpdate);
    console.log('[Socket] Emitted heatmap_update', heatmapUpdate);
  }
}

export const socketService = new MockSocket();
