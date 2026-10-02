import { BookOpenText, Brain, Cards, ChatsCircle, CheckCircle, FileText, Globe, Lightning, MagnifyingGlass, NotePencil, PencilSimple, PlugsConnected, Plus, Target, TreeStructure, Wrench } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { clamp, ease, prog } from '../lib/time';
import { font, type Tokens } from '../theme';

/**
 * 第三幕「越用，越懂你」的四块面板：智能记忆、技能管理、MCP 工具、多模型并排。
 * 文案来自 learningHub（记忆）、skills.json builtinNames（58 个内置技能）、chatV2 blocks.mcpTool。
 */

// ── 智能记忆 ──────────────────────────────────────────
export const MEM_W = 1080;
export const MEM_H = 540;
const MEMORIES: Array<[string, string, string]> = [
  ['学科状态', '中值定理里 ξ 的取值范围反复写成闭区间', '新增'],
  ['学习偏好', '先看几何直观，再看严格证明', '新增'],
  ['目标', '期末高数 90 分以上；雅思写作 7 分', '更新'],
  ['写作', '主谓一致仍是主要失分点', '新增'],
];
const ANSWER = '按你的习惯，先看几何直观：连接 A、B 两点得到一条弦，曲线上一定有一点的切线和这条弦平行——那一点就是 ξ，而且它只可能在 a、b 之间，不会落在端点上。';

export const MemoryPanel = ({ tk, k, answer }: { tk: Tokens; k: number; answer: number }) => (
  <div style={{ position: 'absolute', inset: 0, fontFamily: font.ui, background: tk.background, display: 'flex' }}>
    <div style={{ width: 470, borderRight: `1px solid ${tk.border}`, padding: '22px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Brain size={17} color={tk.primary} />
        <span style={{ fontSize: 16, fontWeight: 600, color: tk.foreground }}>记忆</span>
        <span style={{ fontSize: 12, color: tk.mutedFg }}>每轮对话后自动提取</span>
      </div>
      {MEMORIES.map(([cat, text, badge], i) => {
        const kk = clamp(k * 4.4 - i);
        return (
          <div key={text} style={{ marginTop: 14, borderRadius: 10, border: `1px solid ${tk.border}`, background: tk.card, padding: '11px 14px', opacity: kk, transform: `translateX(${(1 - kk) * -14}px)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: tk.mutedFg }}>
              <span>{cat}</span>
              <span style={{ flex: 1 }} />
              <span style={{ padding: '1px 8px', borderRadius: 999, color: badge === '新增' ? tk.success : tk.primary, background: `color-mix(in hsl, ${badge === '新增' ? tk.success : tk.primary} 11%, transparent)` }}>{badge}</span>
            </div>
            <div style={{ marginTop: 5, fontSize: 14, lineHeight: 1.6, color: tk.foreground }}>{text}</div>
          </div>
        );
      })}
      <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.7, color: tk.mutedFg, opacity: clamp(k * 4.4 - 4) }}>分类汇总成画像，自动带进之后的对话；可随时浏览、编辑、删除。</div>
    </div>
    <div style={{ flex: 1, padding: '22px 28px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ alignSelf: 'flex-end', maxWidth: '80%', borderRadius: 12, padding: '11px 16px', background: tk.muted, fontSize: 15, lineHeight: '24px', color: tk.foreground, opacity: clamp(answer * 6) }}>拉格朗日中值定理到底在说什么？</div>
      {answer > 0.12 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tk.mutedFg }}>
          <CheckCircle size={15} weight="fill" color={tk.success} />
          已参考 2 条记忆：学习偏好 · 学科状态
        </div>
      ) : null}
      <div style={{ fontSize: 16, lineHeight: '30px', color: tk.foreground }}>
        {[...ANSWER].slice(0, Math.round([...ANSWER].length * clamp((answer - 0.18) / 0.82))).join('')}
      </div>
    </div>
  </div>
);

// ── 技能管理 ──────────────────────────────────────────
export const SKILL_W = 1180;
export const SKILL_H = 540;
const SKILLS: Array<[string, string, ReactNode]> = [
  ['调研模式', '多步拆解、联网与本地检索、写成报告', <Globe key="0" size={17} />],
  ['深度学者', '围绕一个主题持续追问与整理', <Brain key="1" size={17} />],
  ['导师模式', '苏格拉底式提问，引导你自己想通', <ChatsCircle key="2" size={17} />],
  ['ChatAnki 制卡', '对话里一句话批量生成闪卡', <Cards key="3" size={17} />],
  ['智能题库', '出题、判分、变式题与掌握度', <Target key="4" size={17} />],
  ['思维导图', '一句话生成导图，多轮编辑', <TreeStructure key="5" size={17} />],
  ['文献综述助手', '检索、精读、按主题汇总文献', <BookOpenText key="6" size={17} />],
  ['学术搜索', 'arXiv / OpenAlex 搜索与下载', <MagnifyingGlass key="7" size={17} />],
  ['作文批改', '多场景评分、批注与润色', <PencilSimple key="8" size={17} />],
  ['试卷分析', '识别试卷、统计知识点分布', <FileText key="9" size={17} />],
  ['智能笔记', '在画布笔记里整理与改写', <NotePencil key="10" size={17} />],
  ['记忆管理', '查看与编辑 AI 记住的内容', <Lightning key="11" size={17} />],
];

export const SkillsPanel = ({ tk, k }: { tk: Tokens; k: number }) => {
  const count = Math.round(58 * ease.outCubic(clamp(k * 1.3)));
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: font.ui, background: tk.background, padding: '22px 26px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: tk.foreground }}>技能管理</span>
        <span style={{ fontSize: 13, color: tk.mutedFg, fontVariantNumeric: 'tabular-nums' }}>内置 {count} · 全局 6 · 项目 2</span>
        <span style={{ flex: 1 }} />
        <span style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${tk.border}`, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: tk.foreground }}>
          <Plus size={13} />
          技能市场
        </span>
      </div>
      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {SKILLS.map(([name, desc, icon], i) => {
          const kk = clamp(k * 3 - i * 0.14);
          return (
            <div key={name} style={{ borderRadius: 10, border: `1px solid ${tk.border}`, background: tk.card, padding: '13px 14px', minHeight: 116, boxSizing: 'border-box', opacity: kk, transform: `translateY(${(1 - kk) * 14}px)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: tk.mutedFg, display: 'inline-flex' }}>{icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: tk.foreground }}>{name}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.6, color: tk.mutedFg }}>{desc}</div>
              <div style={{ marginTop: 10, fontSize: 11, color: tk.mutedFg }}>内置 · 激活时才加载工具</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── MCP 工具 ──────────────────────────────────────────
export const MCP_W = 980;
export const MCP_H = 560;
const SERVERS: Array<[string, string, string]> = [
  ['内置工具', '题库 · 知识库搜索 · 导图 · 闪卡 · 记忆 等 40+ 组', '内置'],
  ['Context7', 'Resolve Library Id · Query Docs', 'OAuth'],
  ['arxiv-mcp-server', 'Search Papers · Download Paper · List Papers', 'stdio'],
  ['filesystem', 'Read File · Write File · List Directory', 'stdio'],
];

export const McpPanel = ({ tk, k, toggles, call }: { tk: Tokens; k: number; toggles: number; call: number }) => (
  <div style={{ position: 'absolute', inset: 0, fontFamily: font.ui, background: tk.background, padding: '22px 26px', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <PlugsConnected size={18} color={tk.primary} />
      <span style={{ fontSize: 16, fontWeight: 600, color: tk.foreground }}>MCP 工具</span>
      <span style={{ fontSize: 13, color: tk.mutedFg }}>选择 MCP / 外部工具连接</span>
    </div>
    <div style={{ marginTop: 16, height: 38, borderRadius: 9, border: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', fontSize: 13, color: tk.mutedFg }}>
      <MagnifyingGlass size={14} />
      搜索服务器或工具
    </div>
    {SERVERS.map(([name, tools, kind], i) => {
      const kk = clamp(k * 4 - i * 0.6);
      const on = clamp(toggles * 4 - i);
      return (
        <div key={name} style={{ marginTop: 10, height: 64, borderRadius: 10, border: `1px solid ${on > 0.5 ? `color-mix(in hsl, ${tk.primary} 35%, ${tk.border})` : tk.border}`, background: on > 0.5 ? `color-mix(in hsl, ${tk.primary} 5%, ${tk.background})` : tk.background, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', opacity: kk, transform: `translateY(${(1 - kk) * 8}px)` }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, boxSizing: 'border-box', border: `1.5px solid ${on > 0.5 ? tk.primary : tk.border}`, background: on > 0.5 ? tk.primary : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {on > 0.5 ? (
              <svg width={10} height={10} viewBox="0 0 10 10">
                <path d="M2 5.2 L4.2 7.3 L8 3" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: tk.foreground }}>{name}</span>
            <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: tk.mutedFg, whiteSpace: 'nowrap' }}>{tools}</span>
          </span>
          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, color: tk.mutedFg, background: tk.muted }}>{kind}</span>
        </div>
      );
    })}
    {call > 0 ? (
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, opacity: clamp(call * 4) }}>
        {call >= 1 ? <CheckCircle size={16} weight="fill" color={tk.success} /> : <Wrench size={16} color={tk.mutedFg} />}
        <span style={{ color: tk.foreground }}>工具调用 · Context7 / Query Docs</span>
        <span style={{ fontSize: 13, color: call >= 1 ? tk.success : tk.mutedFg }}>{call >= 1 ? '完成 (1.2s)' : '执行中...'}</span>
      </div>
    ) : null}
  </div>
);

// ── 多模型并排 ────────────────────────────────────────
export const MODELS_W = 1560;
export const MODELS_H = 500;
const MODELS: Array<[string, string, string]> = [
  ['GLM-5', '2.1s', '几何上看，拉格朗日中值定理说的是：光滑曲线上，总有一点的切线平行于连接两端点的弦。它把「平均变化率」和某一点的「瞬时变化率」联系了起来。'],
  ['Kimi K2.5', '1.8s', '把 f(b) − f(a) 除以 b − a 看成弦的斜率，定理断言存在 ξ ∈ (a, b)，使 f′(ξ) 恰好等于这个斜率——平均速度总会在某一时刻被瞬时速度精确达到。'],
  ['DeepSeek V4', '2.4s', '可以理解为罗尔定理的「倾斜版」：把弦拉平后就是罗尔定理的情形。注意 ξ 只保证存在、并且落在开区间内，定理并不告诉你它具体在哪里。'],
];

export const ModelsPanel = ({ tk, k }: { tk: Tokens; k: number }) => (
  <div style={{ position: 'absolute', inset: 0, fontFamily: font.ui, background: tk.background, padding: '20px 24px', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ borderRadius: 12, padding: '10px 16px', background: tk.muted, fontSize: 15, color: tk.foreground }}>用一句话讲清拉格朗日中值定理的几何意义</div>
    </div>
    <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
      {MODELS.map(([name, sec, text], i) => {
        const kk = clamp(k * 1.25 - i * 0.06);
        const chars = [...text];
        return (
          <div key={name} style={{ borderRadius: 12, border: `1px solid ${tk.border}`, background: tk.card, padding: '14px 18px', minHeight: 330, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: tk.foreground }}>{name}</span>
              <span style={{ flex: 1 }} />
              {kk >= 1 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: tk.mutedFg }}>
                  <CheckCircle size={13} weight="fill" color={tk.success} />
                  {sec}
                </span>
              ) : (
                <span style={{ fontSize: 12, color: tk.mutedFg }}>生成中...</span>
              )}
            </div>
            <div style={{ marginTop: 12, fontSize: 16, lineHeight: '30px', color: tk.foreground }}>
              {chars.slice(0, Math.round(chars.length * kk)).join('')}
              {kk > 0 && kk < 1 ? <span style={{ display: 'inline-block', width: 2, height: 16, marginLeft: 1, verticalAlign: 'text-bottom', background: tk.primary }} /> : null}
            </div>
          </div>
        );
      })}
    </div>
    <div style={{ position: 'absolute', left: 24, bottom: 18, fontSize: 12, color: tk.mutedFg }}>同一问题并排比较 · 预置 12 家模型供应商，也可接入自建端点</div>
  </div>
);
