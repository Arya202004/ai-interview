import { EventEmitter } from 'events';

export interface SttSession {
  id: string;
  languageCode: string;
  sampleRateHertz?: number;
  emitter: EventEmitter;
}

export interface SttConfig {
  languageCode: string;
  sampleRateHertz?: number;
}

export class UnifiedSttSessionManager {
  private static _instance: UnifiedSttSessionManager | null = null;
  private sessions: Map<string, SttSession> = new Map();
  private backend: string = 'webspeech';

  private constructor() {}

  static get instance(): UnifiedSttSessionManager {
    if (!this._instance) {
      this._instance = new UnifiedSttSessionManager();
    }
    return this._instance;
  }

  createSession(id: string, config: SttConfig): SttSession {
    const session: SttSession = {
      id,
      languageCode: config.languageCode,
      sampleRateHertz: config.sampleRateHertz,
      emitter: new EventEmitter()
    };

    this.sessions.set(id, session);
    console.log('[UnifiedSTT] Session created:', id, 'backend:', this.backend);
    return session;
  }

  getSession(id: string): SttSession | undefined {
    return this.sessions.get(id);
  }

  writeAudio(id: string, chunk: Buffer | Uint8Array): void {
    const session = this.sessions.get(id);
    if (!session) {
      console.warn('[UnifiedSTT] Session not found:', id);
      return;
    }

    // For Web Speech API, we don't need to process audio chunks
    // The browser handles audio processing internally
    console.log('[UnifiedSTT] Audio chunk received for session:', id, 'size:', chunk.length);
  }

  close(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.emitter.removeAllListeners();
      this.sessions.delete(id);
      console.log('[UnifiedSTT] Session closed:', id);
    }
  }

  getBackend(): string {
    return this.backend;
  }

  getStats() {
    return {
      activeSessions: this.sessions.size,
      backend: this.backend,
      totalSessions: this.sessions.size
    };
  }
}
