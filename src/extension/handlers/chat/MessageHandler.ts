// ===================================================
// MessageHandler — message sending and streaming
// ===================================================
// Extracted from ChatHandler to handle the core message
// flow: building prompts, streaming tokens, and
// completing responses.
// ===================================================

import type { ExtensionToWebviewMessage } from '../../../shared/messages';
import type { ChatMessage, AgentId } from '../../../shared/types';
import { BUILT_IN_AGENTS } from '../../../shared/constants';
import { ClaudeService, type TokenUsage } from '../../services/ClaudeService';
import { ConversationStore } from '../../services/ConversationStore';
import { SettingsService } from '../../services/SettingsService';
import { generateId } from '../../../shared/utils/generateId';
import type { ToolExecutionCoordinator } from './ToolExecutionCoordinator';

// -------------------------------------------------
// detectMimeTypeFromBase64 — detect image MIME type from base64 magic bytes
// -------------------------------------------------
function detectMimeTypeFromBase64(base64: string): string {
  const header = base64.substring(0, 16);
  if (header.startsWith('/9j/')) return 'image/jpeg';
  if (header.startsWith('iVBOR')) return 'image/png';
  if (header.startsWith('R0lGO')) return 'image/gif';
  if (header.startsWith('UklGR')) return 'image/webp';
  if (header.startsWith('PHN2Z') || header.startsWith('PD94b')) return 'image/svg+xml';
  return 'image/png'; // fallback
}

export class MessageHandler {
  constructor(
    private readonly claudeService: ClaudeService,
    private readonly settingsService: SettingsService,
    private readonly conversationStore: ConversationStore,
    private readonly postMessage: (msg: ExtensionToWebviewMessage) => void,
    private readonly getContext: () => { projectId: string | null; agentId: AgentId },
    private readonly toolCoordinator: ToolExecutionCoordinator,
    private readonly markDirty: () => void,
  ) {}

  // -------------------------------------------------
  // sendMessage — send a message to Claude
  // -------------------------------------------------
  public async sendMessage(content: string, images?: string[]): Promise<void> {
    const { projectId, agentId } = this.getContext();

    // Initialise Claude if needed
    if (!this.claudeService.isReady()) {
      const apiKey = await this.settingsService.getApiKey();
      await this.claudeService.initialize(apiKey || undefined);
    }

    // Create conversation if none active
    const effectiveProjectId = projectId || 'quick-chat';
    if (!this.conversationStore.getActiveId()) {
      await this.conversationStore.create(effectiveProjectId, agentId);
    }

    const conversationId = this.conversationStore.getActiveId();
    if (!conversationId) return;

    // Build user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      images: images?.map((data, i) => {
        const mimeType = detectMimeTypeFromBase64(data);
        const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
        return {
          id: `img-${generateId()}`,
          name: `image-${i}.${ext}`,
          mimeType,
          data,
        };
      }),
    };

    // Save and send to UI
    await this.conversationStore.addMessage(conversationId, userMessage);
    this.postMessage({ type: 'addMessage', payload: userMessage });

    this.markDirty();
    await this.conversationStore.clearDraft(conversationId);

    // Clear previous errors + update status
    this.postMessage({ type: 'error', payload: { message: '' } });
    this.postMessage({ type: 'statusUpdate', payload: { status: 'thinking' } });

    // Create empty assistant message (filled via streaming)
    const assistantMessageId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      agentId,
      isStreaming: true,
      toolUses: [],
    };

    this.postMessage({ type: 'addMessage', payload: assistantMessage });

    // Build system prompt
    const agent = BUILT_IN_AGENTS[agentId];
    const settings = this.settingsService.getSettings();

    let systemPrompt = agent.systemPrompt;

    if (settings.learningMode) {
      systemPrompt += '\n\nLEARNING MODE: Add detailed Hebrew comments to ALL code you write. Explain every step.';
    }

    systemPrompt += `\n\nUser language: ${settings.language === 'he' ? 'Hebrew' : 'English'}. Respond in this language.`;

    // Get conversation history
    const conversation = this.conversationStore.get(conversationId);
    const messages = conversation?.messages ?? [];

    let streamingStarted = false;

    // Send to Claude with streaming
    await this.claudeService.sendMessage(
      messages,
      systemPrompt,
      settings.model,
      settings.maxTokens,
      {
        onToken: (token) => {
          if (!streamingStarted) {
            streamingStarted = true;
            this.postMessage({ type: 'statusUpdate', payload: { status: 'streaming' } });
          }
          this.postMessage({
            type: 'streamToken',
            payload: { messageId: assistantMessageId, token },
          });
        },
        onComplete: (fullText, tokenCount, usage?: TokenUsage) => {
          const finalMessage: ChatMessage = {
            ...assistantMessage,
            content: fullText,
            tokenCount,
            isStreaming: false,
          };

          void this.conversationStore.addMessage(conversationId, finalMessage).then(() => {
            this.markDirty();
          });

          this.postMessage({
            type: 'streamComplete',
            payload: { messageId: assistantMessageId, fullContent: fullText, tokenCount },
          });

          this.postMessage({ type: 'statusUpdate', payload: { status: 'idle' } });

          const inputTokens = usage?.inputTokens ?? 0;
          const outputTokens = usage?.outputTokens ?? 0;
          const cost = (inputTokens > 0 || outputTokens > 0)
            ? ClaudeService.estimateCost(settings.model, inputTokens, outputTokens)
            : 0;
          this.postMessage({
            type: 'costUpdate',
            payload: { sessionCost: cost, totalTokens: tokenCount },
          });
        },
        onToolUse: (toolUse) => {
          this.toolCoordinator.handleToolUse(toolUse, assistantMessageId);
        },
        onError: (error) => {
          // Mark the assistant message as no longer streaming
          this.postMessage({
            type: 'streamComplete',
            payload: {
              messageId: assistantMessageId,
              fullContent: error.message ? `⚠️ ${error.message}` : '⚠️ שגיאה בחיבור',
              tokenCount: 0,
            },
          });
          this.postMessage({
            type: 'error',
            payload: { message: error.message },
          });
          this.postMessage({
            type: 'statusUpdate',
            payload: { status: 'idle' },
          });
        },
        onProgress: (step) => {
          this.postMessage({
            type: 'statusUpdate',
            payload: { status: 'thinking', message: step },
          });
        },
      },
    );
  }
}
