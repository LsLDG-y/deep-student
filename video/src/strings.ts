import anki from '@app/locales/zh-CN/anki.json';
import chatV2 from '@app/locales/zh-CN/chatV2.json';
import common from '@app/locales/zh-CN/common.json';
import flashcards from '@app/locales/zh-CN/flashcards.json';
import generativeUi from '@app/locales/zh-CN/generativeUi.json';
import mindmap from '@app/locales/zh-CN/mindmap.json';
import sidebar from '@app/locales/zh-CN/sidebar.json';
import stats from '@app/locales/zh-CN/stats.json';
import workbench from '@app/locales/zh-CN/workbench.json';

const NS = { anki, chatV2, common, flashcards, generativeUi, mindmap, sidebar, stats, workbench } as const;
type Ns = keyof typeof NS;

/**
 * 界面文案一律从主应用 zh-CN locale 读取；key 失效时直接抛错，
 * 让文案漂移在渲染阶段暴露，而不是静默出现过时字符串。
 */
export const tr = (ns: Ns, key: string, vars: Record<string, string | number> = {}): string => {
  let node: unknown = NS[ns];
  for (const part of key.split('.')) {
    node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
  }
  if (typeof node !== 'string') throw new Error(`[strings] missing zh-CN key ${ns}:${key}`);
  return node.replace(/\{\{(\w+)\}\}/g, (_, v: string) => String(vars[v] ?? `{{${v}}}`));
};

export const S = {
  emptyTitle: tr('chatV2', 'messageList.empty.primaryAction'),
  placeholder: tr('chatV2', 'inputBar.placeholder'),
  refAdded: tr('chatV2', 'selectionRef.added'),
  sel: {
    copy: tr('chatV2', 'selectionToolbar.copy'),
    explain: tr('chatV2', 'selectionToolbar.explain'),
    translate: tr('chatV2', 'selectionToolbar.translate'),
    saveAsNote: tr('chatV2', 'selectionToolbar.saveAsNote'),
    makeCards: tr('chatV2', 'selectionToolbar.makeCards'),
    addToChat: tr('chatV2', 'selectionToolbar.addToChat'),
    addAsContext: tr('chatV2', 'selectionToolbar.addAsContext'),
  },
  thinking: (s: number) => tr('chatV2', 'timeline.thinking.inProgress', { seconds: s }),
  thought: (s: number) => tr('chatV2', 'timeline.thinking.completed', { seconds: s }),
  searching: tr('chatV2', 'timeline.retrieval.searching'),
  retrievalSummary: (n: number) => tr('chatV2', 'timeline.retrieval.summary', { count: n }),
  unifiedSearch: tr('common', 'mcp.tools.unified_search'),
  memorySearch: tr('common', 'mcp.tools.memory_search'),
  nodeCount: (n: number) => tr('mindmap', 'embed.nodeCount', { count: n }),
  open: tr('common', 'actions.open'),
  mm: {
    outline: tr('mindmap', 'toolbar.outline'),
    mindmap: tr('mindmap', 'toolbar.mindmap'),
    switchStructure: tr('mindmap', 'toolbar.switchStructure'),
    styleSettings: tr('mindmap', 'toolbar.styleSettings'),
    hideCompleted: tr('mindmap', 'toolbar.hideCompleted'),
    recite: tr('mindmap', 'recite.title'),
    reviewStart: tr('mindmap', 'recite.reviewStart'),
    revealAll: tr('mindmap', 'recite.revealAll'),
    resetAll: tr('mindmap', 'recite.resetAll'),
    exit: tr('mindmap', 'recite.exit'),
    structMindmap: tr('chatV2', 'mindmapCitation.mindmap'),
    structLogic: tr('mindmap', 'structure.logic'),
    structOrg: tr('mindmap', 'structure.orgchart'),
    timeline: tr('mindmap', 'layouts.timeline'),
    presetBalanced: tr('mindmap', 'presets.mindmapBalanced'),
    presetLogic: tr('mindmap', 'presets.logicTreeRight'),
    presetOrg: tr('mindmap', 'presets.orgchartDown'),
    presetTimeline: tr('mindmap', 'presets.timelineRight'),
    structureCurrent: tr('mindmap', 'structure.current'),
  },
  anki: {
    generating: tr('chatV2', 'blocks.ankiCards.loading'),
    title: tr('chatV2', 'blocks.ankiCards.title'),
    add: tr('chatV2', 'blocks.ankiCards.addToLibrary'),
    added: tr('chatV2', 'blocks.ankiCards.addedToLibrary'),
    review: tr('chatV2', 'blocks.ankiCards.reviewBatch'),
    edit: tr('anki', 'chatV2.editInline'),
  },
  fc: {
    showAnswer: tr('flashcards', 'review.showAnswer'),
    again: tr('flashcards', 'session.again'),
    hard: tr('flashcards', 'session.hard'),
    good: tr('flashcards', 'session.good'),
    easy: tr('flashcards', 'session.easy'),
    front: tr('flashcards', 'session.front'),
    back: tr('flashcards', 'session.back'),
    tapToFlip: tr('flashcards', 'session.tapToFlip'),
    done: tr('flashcards', 'session.done'),
    doneHint: tr('flashcards', 'review.doneHint'),
    statRated: tr('flashcards', 'review.statRated'),
    statTime: tr('flashcards', 'review.statTime'),
    statBestStreak: tr('flashcards', 'review.statBestStreak'),
    heatmap: tr('flashcards', 'stats.heatmap.title'),
    less: tr('flashcards', 'stats.heatmap.legendLess'),
    more: tr('flashcards', 'stats.heatmap.legendMore'),
  },
  radar: {
    title: tr('stats', 'knowledgeRadar.title'),
    mastery: tr('stats', 'knowledgeRadar.mastery'),
  },
  wb: {
    agenda: tr('workbench', 'agenda.label'),
    briefing: tr('generativeUi', 'workbench.briefing_label'),
    appsSearch: tr('workbench', 'appsPanel.searchPlaceholder'),
    allApps: tr('workbench', 'appsPanel.title'),
    sectionResources: tr('workbench', 'appsPanel.sectionResources'),
    sectionChat: tr('workbench', 'appsPanel.sectionChat'),
    operating: (label: string) => tr('workbench', 'agent.core.operating', { label }),
    filePreview: tr('workbench', 'apps.filePreview'),
    pomodoro: tr('workbench', 'apps.pomodoro'),
    files: tr('workbench', 'agentControlCenter.apps.files.name'),
    flashcards: tr('workbench', 'agentControlCenter.apps.flashcards.name'),
  },
  nav: {
    newChat: tr('sidebar', 'navigation.chat_v2'),
    learningHub: tr('sidebar', 'navigation.learning_hub'),
    todo: tr('common', 'navigation.todo'),
    skills: tr('sidebar', 'navigation.skills_management'),
    anki: tr('sidebar', 'navigation.anki_generation'),
    flashcards: tr('sidebar', 'navigation.flashcards'),
    templates: tr('anki', 'template_management.page_title'),
    settings: tr('sidebar', 'navigation.settings'),
    pinned: tr('sidebar', 'sections.pinned'),
    topics: tr('sidebar', 'sections.topics'),
    conversations: tr('sidebar', 'sections.conversations'),
    search: tr('sidebar', 'search.placeholder'),
    workbenchMode: tr('sidebar', 'navigation.workbench_mode'),
  },
  apps: {
    chat: tr('workbench', 'apps.chat.name'),
    note: tr('workbench', 'apps.note'),
    exam: tr('workbench', 'apps.exam'),
    translation: tr('workbench', 'apps.translation'),
    essay: tr('workbench', 'apps.essay'),
    filePreview: tr('workbench', 'apps.filePreview'),
    files: tr('workbench', 'apps.files'),
    todo: tr('workbench', 'apps.todo'),
    flashcards: tr('workbench', 'apps.flashcards'),
    settings: tr('workbench', 'apps.settings'),
    pomodoro: tr('workbench', 'apps.pomodoro'),
    textbook: tr('workbench', 'apps.textbook'),
    aiDashboard: tr('workbench', 'apps.aiDashboard'),
    sectionApps: tr('workbench', 'appsPanel.sectionApps'),
    sectionCommands: tr('workbench', 'appsPanel.sectionCommands'),
  },
};
