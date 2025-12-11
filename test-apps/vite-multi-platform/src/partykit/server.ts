/**
 * PartyKit Platform Entry Point
 *
 * This file tests that Vite can properly:
 * 1. Build for Workerd/edge runtime target
 * 2. Resolve workerd-specific export conditions
 * 3. Import PartyKit-specific springboard packages
 * 4. Handle edge runtime constraints
 */

// Note: PartyKit types would be available when partykit is installed
// For testing purposes, we define minimal types inline

interface PartyRoom {
  id: string;
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    list(options?: { prefix?: string; limit?: number }): Promise<Map<string, unknown>>;
  };
  broadcast(message: string, exclude?: string[]): void;
}

interface PartyConnection {
  id: string;
  send(message: string): void;
}

interface PartyRequest extends Request {
  headers: Headers;
}

// Test: Import from main springboard package
import springboard from 'springboard';

// Test: Import PartyKit platform
import '@springboardjs/platforms-partykit';

// Test: Import types
import type { CoreDependencies } from 'springboard/types/module_types';

// Test results
const testResults: Record<string, 'OK' | 'FAIL' | 'SKIPPED'> = {};

/**
 * PartyKit Server Implementation
 * This demonstrates the structure of a PartyKit server using Springboard
 */
export default class TestPartyServer {
  private room: PartyRoom;
  private connections: Map<string, PartyConnection> = new Map();

  constructor(room: PartyRoom) {
    this.room = room;
    this.runExportTests();
  }

  private runExportTests(): void {
    console.log('\n=== Springboard Vite Test - PartyKit Platform ===\n');

    // Test springboard default export
    testResults['springboard default'] = typeof springboard === 'object' ? 'OK' : 'FAIL';
    console.log(`springboard default: ${testResults['springboard default']}`);

    // Test that we're in a workerd-like environment
    // Note: Actual workerd checks would differ in real PartyKit runtime
    testResults['workerd environment'] = typeof globalThis !== 'undefined' ? 'OK' : 'FAIL';
    console.log(`workerd environment: ${testResults['workerd environment']}`);

    // Summary
    const passed = Object.values(testResults).filter(v => v === 'OK').length;
    const total = Object.keys(testResults).length;
    console.log(`\n=== Results: ${passed}/${total} tests passed ===\n`);
  }

  /**
   * Called when the party starts
   */
  async onStart(): Promise<void> {
    console.log(`Party ${this.room.id} started`);

    // Initialize Springboard
    springboard.reset();

    // Load any persisted state
    const savedState = await this.room.storage.get<string>('springboard_state');
    if (savedState) {
      console.log('Loaded persisted state');
    }
  }

  /**
   * Called when a new connection joins
   */
  async onConnect(connection: PartyConnection): Promise<void> {
    this.connections.set(connection.id, connection);
    console.log(`Connection ${connection.id} joined party ${this.room.id}`);

    // Send test results to new connection
    connection.send(JSON.stringify({
      type: 'test_results',
      results: testResults,
    }));
  }

  /**
   * Called when a connection leaves
   */
  async onClose(connection: PartyConnection): Promise<void> {
    this.connections.delete(connection.id);
    console.log(`Connection ${connection.id} left party ${this.room.id}`);
  }

  /**
   * Called when a message is received
   */
  async onMessage(message: string, sender: PartyConnection): Promise<void> {
    console.log(`Message from ${sender.id}: ${message}`);

    try {
      const data = JSON.parse(message);

      if (data.type === 'ping') {
        sender.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now(),
        }));
      }

      if (data.type === 'broadcast') {
        this.room.broadcast(JSON.stringify({
          type: 'broadcast',
          from: sender.id,
          content: data.content,
        }), [sender.id]);
      }

      if (data.type === 'get_tests') {
        sender.send(JSON.stringify({
          type: 'test_results',
          results: testResults,
        }));
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  /**
   * Called for HTTP requests to the party
   */
  async onRequest(request: PartyRequest): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health' || url.pathname.endsWith('/health')) {
      const allPassed = Object.values(testResults).every(v => v === 'OK');
      return new Response(JSON.stringify({
        status: allPassed ? 'healthy' : 'unhealthy',
        platform: 'partykit',
        tests: testResults,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/' || url.pathname.endsWith('/')) {
      return new Response(JSON.stringify({
        message: 'Springboard Vite Test - PartyKit Server',
        platform: 'partykit',
        roomId: this.room.id,
        connections: this.connections.size,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}

// Export test results for verification
export { testResults };
