import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { createStore } from 'zustand/vanilla';
import { invoke } from '@tauri-apps/api/core';
import { InputBarV2 } from '@/features/chat/components/input-bar/InputBarV2';
import { ModelPicker } from '@/features/chat/components/input-bar/ModelPicker';

let capturedInputBarUIProps: Record<string, any> | null = null;
const mockModeRegistryState = vi.hoisted(() => ({
  plugin: {} as Record<string, any>,
}));

vi.mock('@/features/chat/components/input-bar/InputBarUI', () => ({
  InputBarUI: (props: Record<string, any>) => {
    capturedInputBarUIProps = props;
    return null;
  },
}));

vi.mock('@/features/chat/components/input-bar/useInputBarV2', () => ({
  useInputBarV2: (store: any) => ({
    canSend: true,
    canAbort: false,
    isStreaming: false,
    attachments: store.getState().attachments,
    panelStates: {
      attachment: false,
      model: false,
      advanced: false,
      mcp: false,
      skill: false,
    },
    setInputValue: vi.fn(),
    sendMessage: vi.fn(),
    abortStream: vi.fn(),
    addAttachment: vi.fn(),
    updateAttachment: vi.fn(),
    removeAttachment: vi.fn(),
    clearAttachments: vi.fn(),
    setPanelState: vi.fn(),
  }),
}));

vi.mock('@/features/chat/registry', () => ({
  modeRegistry: {
    getResolved: () => mockModeRegistryState.plugin,
  },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// 测试环境不加载异步 i18n 命名空间（chatV2 等按需加载），真实 t 会原样返回
// key。与同目录其它测试一致，mock useTranslation 并补上 {{var}} 插值；
// thinkingState 系列 key 现在不再携带 defaultValue，这里按 zh-CN/chatV2.json
// 提供模板，保证断言确定性。
const ZH_TEMPLATES = vi.hoisted(
  (): Record<string, string> => ({
    'chatV2:inputBar.thinkingState.unsupported': '推理: 不支持',
    'chatV2:inputBar.thinkingState.off': '推理: 关闭',
    'chatV2:inputBar.thinkingState.on': '推理: {{depth}}',
  })
);

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const translate = (
    key: string,
    defaultValueOrOptions?: unknown,
    maybeOptions?: Record<string, unknown>
  ): string => {
    const defaultValue =
      typeof defaultValueOrOptions === 'string'
        ? defaultValueOrOptions
        : (defaultValueOrOptions as { defaultValue?: string } | undefined)?.defaultValue;
    const options =
      (typeof defaultValueOrOptions === 'object' && defaultValueOrOptions !== null
        ? (defaultValueOrOptions as Record<string, unknown>)
        : maybeOptions) ?? {};
    const template = defaultValue ?? ZH_TEMPLATES[key] ?? key;
    return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
      options[name] !== undefined ? String(options[name]) : match
    );
  };
  return {
    ...actual,
    useTranslation: () => ({
      t: translate,
      i18n: { language: 'zh-CN', changeLanguage: vi.fn() },
    }),
  };
});

vi.mock('@/features/chat/skills/hooks/useLoadedSkills', () => ({
  useLoadedSkills: () => ({ loadedSkillIds: new Set<string>() }),
}));

vi.mock('@/features/chat/components/input-bar/usePdfPageRefs', () => ({
  usePdfPageRefs: () => ({
    pageRefs: [],
    clearPageRefs: vi.fn(),
    removePageRef: vi.fn(),
    buildRefTags: vi.fn(() => ''),
    hasPageRefs: false,
  }),
}));

vi.mock('@/contexts/DialogControlContext', () => ({
  useDialogControl: () => ({
    availableMcpServers: [],
    selectedMcpServers: [],
    setSelectedMcpServers: vi.fn(),
  }),
}));

vi.mock('@/mcp/builtinMcpServer', () => ({
  isBuiltinServer: () => false,
}));

vi.mock('@/config/featureFlags', () => ({
  isMultiModelSelectEnabled: () => true,
}));

vi.mock('@/features/chat/skills/loader', () => ({
  reloadSkills: vi.fn(),
}));

function createMockStore() {
  const addContextRef = vi.fn();
  const setChatParams = vi.fn();

  const store = createStore<any>(() => ({
    sessionId: 'session_1',
    mode: 'chat',
    inputValue: '',
    chatParams: {
      modelId: 'deepseek-official-v4',
      model2OverrideId: null,
      maxTokens: 32_768,
      enableThinking: true,
      reasoningEffort: undefined,
      thinkingBudget: undefined,
    },
    modelRetryTarget: null,
    skillStateJson: null,
    setChatParams,
    activeSkillIds: [],
    activateSkill: vi.fn(),
    deactivateSkill: vi.fn(),
    pendingContextRefs: [],
    removeContextRef: vi.fn(),
    clearContextRefs: vi.fn(),
    pendingApprovalRequest: null,
    attachments: [{ id: 'att_1' }],
    addContextRef,
    setModelRetryTarget: vi.fn(),
    setPanelState: vi.fn(),
    retryMessage: vi.fn(),
    setPendingParallelModelIds: vi.fn(),
  }));

  return { store, addContextRef, setChatParams };
}

describe('model identity in composer',()=>{
 beforeEach(()=>{capturedInputBarUIProps=null;mockModeRegistryState.plugin={};vi.clearAllMocks();vi.mocked(invoke).mockImplementation(async(cmd)=>cmd==='get_model_assignments'?{model2_config_id:'vendor-b'}:[]);});
 const models=[{id:'vendor-a',name:'Shared',model:'Shared',vendorName:'Vendor A',providerType:'openai',providerScope:'openai'},{id:'vendor-b',name:'Shared',model:'Shared',vendorName:'Vendor B',providerType:'openai',providerScope:'openai'}];
 it('F2P uses the configured vendor when display names collide',async()=>{const {store}=createMockStore();store.setState({chatParams:{modelId:'',modelDisplayName:'Shared',modelIdPinnedByUser:false,maxTokens:4096,enableThinking:false}});render(<InputBarV2 store={store as any} availableModels={models as any}/>);await waitFor(()=>expect(capturedInputBarUIProps?.runtimeModelProviderLabel).toBe('Vendor B'));});
 it('P2P keeps an explicitly pinned first vendor selected',async()=>{const {store}=createMockStore();store.setState({chatParams:{modelId:'vendor-a',modelDisplayName:'Shared',modelIdPinnedByUser:true,maxTokens:4096,enableThinking:false}});render(<InputBarV2 store={store as any} availableModels={models as any}/>);await waitFor(()=>expect(capturedInputBarUIProps?.runtimeModelProviderLabel).toBe('Vendor A'));});
});
