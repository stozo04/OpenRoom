import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatHistoryData, DisplayMessage } from '../chatHistoryStorage';
import type { ChatMessage } from '../llmClient';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const SESSION_PATH = 'char-1/mod-1';

function expectedUrl(file: string): string {
  return `/api/session-data?path=${encodeURIComponent(`${SESSION_PATH}/chat/${file}`)}`;
}

const sampleMessages: DisplayMessage[] = [
  { id: '1', role: 'user', content: 'Hello' },
  { id: '2', role: 'assistant', content: 'Hi there!' },
];

const sampleChatHistory: ChatMessage[] = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' },
];

function makeSavedData(msgs = sampleMessages, history = sampleChatHistory): ChatHistoryData {
  return { version: 1, savedAt: Date.now(), messages: msgs, chatHistory: history };
}

describe('chatHistoryStorage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.resetModules();
  });

  describe('loadChatHistorySync', () => {
    it('returns null', async () => {
      const { loadChatHistorySync } = await import('../chatHistoryStorage');
      expect(loadChatHistorySync(SESSION_PATH)).toBeNull();
    });
  });

  describe('loadChatHistory', () => {
    it('loads from API', async () => {
      const data = makeSavedData();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(data),
      });
      const { loadChatHistory } = await import('../chatHistoryStorage');

      const result = await loadChatHistory(SESSION_PATH);

      expect(fetchMock).toHaveBeenCalledWith(expectedUrl('chat.json'));
      expect(result).not.toBeNull();
      expect(result!.messages).toEqual(sampleMessages);
    });

    it('returns null when API returns non-ok', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
      const { loadChatHistory } = await import('../chatHistoryStorage');

      const result = await loadChatHistory(SESSION_PATH);

      expect(result).toBeNull();
    });

    it('returns null when fetch throws', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network error'));
      const { loadChatHistory } = await import('../chatHistoryStorage');

      const result = await loadChatHistory(SESSION_PATH);

      expect(result).toBeNull();
    });

    it('returns null when API is empty', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
      const { loadChatHistory } = await import('../chatHistoryStorage');

      const result = await loadChatHistory(SESSION_PATH);
      expect(result).toBeNull();
    });
  });

  describe('saveChatHistory', () => {
    it('POSTs to API with expected payload', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });
      const { saveChatHistory } = await import('../chatHistoryStorage');

      await saveChatHistory(SESSION_PATH, sampleMessages, sampleChatHistory);

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(expectedUrl('chat.json'));
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body.version).toBe(1);
      expect(body.messages).toEqual(sampleMessages);
      expect(body.chatHistory).toEqual(sampleChatHistory);
    });

    it('does not throw when fetch fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network error'));
      const { saveChatHistory } = await import('../chatHistoryStorage');

      await expect(
        saveChatHistory(SESSION_PATH, sampleMessages, sampleChatHistory),
      ).resolves.toBeUndefined();
    });
  });

  describe('clearChatHistory', () => {
    it('sends DELETE to API', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });
      const { clearChatHistory } = await import('../chatHistoryStorage');

      await clearChatHistory(SESSION_PATH);

      expect(fetchMock).toHaveBeenCalledWith(expectedUrl('chat.json'), { method: 'DELETE' });
    });

    it('does not throw when DELETE fetch fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network error'));
      const { clearChatHistory } = await import('../chatHistoryStorage');

      await expect(clearChatHistory(SESSION_PATH)).resolves.toBeUndefined();
    });
  });
});
