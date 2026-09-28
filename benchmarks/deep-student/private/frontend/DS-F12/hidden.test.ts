import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(() => Promise.resolve(() => {})) }));

vi.mock('@/features/chat/core/middleware/eventBridge', () => ({
  handleBackendEventWithSequence: vi.fn(),
  flushPendingBackendEvents: vi.fn(),
  handleStreamComplete: vi.fn(() => Promise.resolve()),
  handleStreamAbort: vi.fn(() => Promise.resolve()),
  clearEventContext: vi.fn(),
  resetBridgeState: vi.fn(),
}));

vi.mock('@/features/chat/core/middleware/autoSave', () => ({
  autoSave: { forceImmediateSave: vi.fn(() => Promise.resolve()), cleanup: vi.fn() },
  streamingBlockSaver: { cleanup: vi.fn() },
}));

import { invoke } from '@tauri-apps/api/core';
import { ChatV2TauriAdapter } from '@/features/chat/adapters/TauriAdapter';

const invokeMock = vi.mocked(invoke);

const SESSION_ID = 'sess_window_test';
const PAGE_SIZE = 100;

/** 造一页后端消息：id 按时间正序连续编号 */
function makeMessages(from: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const seq = from + i;
    return {
      id: `msg_${seq}`,
      sessionId: SESSION_ID,
      role: seq % 2 === 0 ? 'user' : 'assistant',
      blockIds: [`blk_${seq}`],
      timestamp: 1000 + seq,
    };
  });
}

function makeBlocks(from: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const seq = from + i;
    return {
      id: `blk_${seq}`,
      messageId: `msg_${seq}`,
      type: 'content',
      status: 'success',
      content: `content ${seq}`,
    };
  });
}

function pageResponse(offset: number, count: number, total: number) {
  return {
    messages: makeMessages(offset, count),
    blocks: makeBlocks(offset, count),
    totalMessageCount: total,
    offset,
    limit: PAGE_SIZE,
    nextOffset: null,
  };
}

function fullSessionResponse(total: number) {
  return {
    session: { id: SESSION_ID },
    messages: makeMessages(0, total),
    blocks: makeBlocks(0, total),
    totalMessageCount: total,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

interface Harness {
  adapter: ChatV2TauriAdapter;
  prepends: Array<{ offsetGuess: number; messages: unknown[]; total: number }>;
  store: Record<string, unknown>;
}

function createHarness(opts: {
  windowStartOffset: number;
  totalCount: number;
  initialLoadedCount: number;
}): Harness {
  const prepends: Harness['prepends'] = [];

  // 最小 ChatStore 面：被测方法只触碰这些字段/动作
  const store: Record<string, unknown> = {
    sessionId: SESSION_ID,
    isDataLoaded: true,
    messageMap: new Map(),
    blocks: new Map(),
    sessionStatus: 'idle',
    currentStreamingMessageId: null,
    getOrderedMessages: () => [],
    prependHistoryFromBackend: vi.fn((response: { messages: unknown[]; totalMessageCount?: number }) => {
      prepends.push({
        offsetGuess: -1,
        messages: response.messages,
        total: response.totalMessageCount ?? -1,
      });
    }),
  };

  const adapter = new ChatV2TauriAdapter(SESSION_ID, store as never);
  const internal = adapter as unknown as Record<string, unknown>;

  // 模拟 loadSession 尾窗恢复后的窗口起点
  internal.historyWindowStartOffset = opts.windowStartOffset;
  internal.lastLoadedSessionInfo = { id: SESSION_ID };
  internal.setupGeneration = 1;

  return { adapter, prepends, store };
}

beforeEach(() => {
  invokeMock.mockReset();
  vi.restoreAllMocks();
});

describe('manual history window ownership',()=>{
 it('F2P coalesces overlapping manual page requests instead of consuming two offsets',async()=>{const {adapter,prepends}=createHarness({windowStartOffset:200,totalCount:300,initialLoadedCount:100});const page=deferred<ReturnType<typeof pageResponse>>();invokeMock.mockReturnValue(page.promise);const first=adapter.loadEarlierMessages();const second=adapter.loadEarlierMessages();expect(invokeMock).toHaveBeenCalledTimes(1);page.resolve(pageResponse(100,100,300));await Promise.all([first,second]);expect(prepends).toHaveLength(1);expect((adapter as any).historyWindowStartOffset).toBe(100);});
 it('F2P discards a page whose window ownership was superseded',async()=>{const {adapter,prepends}=createHarness({windowStartOffset:350,totalCount:450,initialLoadedCount:100});const page=deferred<ReturnType<typeof pageResponse>>();invokeMock.mockReturnValueOnce(page.promise);const pending=adapter.loadEarlierMessages();(adapter as any).historyWindowStartOffset=150;page.resolve(pageResponse(250,100,450));await pending;expect(prepends).toHaveLength(0);expect((adapter as any).historyWindowStartOffset).toBe(150);});
 it('P2P loads a contiguous page and stops at the oldest boundary',async()=>{const {adapter,prepends}=createHarness({windowStartOffset:100,totalCount:200,initialLoadedCount:100});invokeMock.mockResolvedValueOnce(pageResponse(0,100,200));await adapter.loadEarlierMessages();await adapter.loadEarlierMessages();expect(invokeMock).toHaveBeenCalledTimes(1);expect(prepends).toHaveLength(1);expect((adapter as any).historyWindowStartOffset).toBe(0);});
});
