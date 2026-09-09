export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

export interface PerformanceMark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  category: string;
}

class StartupLogger {
  private logs: LogEntry[] = [];
  private marks: Map<string, PerformanceMark> = new Map();
  private maxLogs = 1000;
  private logLevel: LogLevel = 'info';
  private subscribers: Set<(entry: LogEntry) => void> = new Set();

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  log(level: LogLevel, category: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: performance.now(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${category}]`;
    
    switch (level) {
      case 'debug':
        console.debug(prefix, message, data || '');
        break;
      case 'info':
        console.log(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'error':
        console.error(prefix, message, data || '');
        break;
    }

    this.subscribers.forEach(cb => cb(entry));
  }

  debug(category: string, message: string, data?: any): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: any): void {
    this.log('error', category, message, data);
  }

  startMark(name: string, category = 'performance'): void {
    this.marks.set(name, {
      name,
      startTime: performance.now(),
      category,
    });
  }

  endMark(name: string): number | null {
    const mark = this.marks.get(name);
    if (!mark) {
      this.warn('PERF', `Mark not found: ${name}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - mark.startTime;
    
    mark.endTime = endTime;
    mark.duration = duration;

    this.info('PERF', `${name} completed in ${duration.toFixed(2)}ms`, { category: mark.category });
    return duration;
  }

  getMark(name: string): PerformanceMark | undefined {
    return this.marks.get(name);
  }

  getAllMarks(): PerformanceMark[] {
    return Array.from(this.marks.values());
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (!level) return [...this.logs];
    return this.logs.filter(l => l.level === level);
  }

  clearLogs(): void {
    this.logs = [];
  }

  subscribe(callback: (entry: LogEntry) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  getSummary(): {
    totalLogs: number;
    byLevel: Record<LogLevel, number>;
    byCategory: Record<string, number>;
    totalDuration: number;
    marks: PerformanceMark[];
  } {
    const byLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    const byCategory: Record<string, number> = {};

    for (const log of this.logs) {
      byLevel[log.level]++;
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
    }

    return {
      totalLogs: this.logs.length,
      byLevel,
      byCategory,
      totalDuration: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : 0,
      marks: this.getAllMarks(),
    };
  }
}

export const startupLogger = new StartupLogger();

export function measureAsync<T>(name: string, category: string, fn: () => Promise<T>): Promise<T> {
  startupLogger.startMark(name, category);
  return fn().finally(() => {
    startupLogger.endMark(name);
  });
}

export function measureSync<T>(name: string, category: string, fn: () => T): T {
  startupLogger.startMark(name, category);
  try {
    return fn();
  } finally {
    startupLogger.endMark(name);
  }
}