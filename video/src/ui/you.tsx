import {
  ArrowCounterClockwise,
  BookOpenText,
  Brain,
  Cards,
  CaretLeft,
  CaretRight,
  ChatsCircle,
  CheckCircle,
  Copy,
  DotsThree,
  FileText,
  GitBranch,
  Globe,
  Lightning,
  MagnifyingGlass,
  NotePencil,
  PencilSimple,
  PlugsConnected,
  Plus,
  Square,
  Target,
  Trash,
  TreeStructure,
  Wrench,
} from '@phosphor-icons/react';
import { lobeIconData } from '@app/utils/lobeIconData';
import type { ReactNode } from 'react';
import { clamp, ease, PACE, prog } from '../lib/time';
import { font, type Tokens } from '../theme';
import { ChatSidebar, DockComposer, FG, LINE_SOFT, MUTED, PRI, T, UserBubble, type SidebarRow } from './research';
import { at } from './resource';

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

// ── 多模型并排（对话窗口里的并行变体 ParallelVariantView） ──────────
/** 片中这段的会话时刻：接在 08（20:05）之后，记忆 → MCP → 多模型各隔两分钟。 */
export const YOU_CLOCK = { memory: '20:12', mcp: '20:14', models: '20:16' } as const;
export const MODELS_Q = '用一句话讲清拉格朗日中值定理的几何意义';
export const MODELS_TITLE = '中值定理的几何意义';

/** 侧栏「对话」：09 三场新会话依次顶到最上面，下面是 08 的调研与第一幕那场。 */
export const youSidebar = (scene: 'memory' | 'mcp' | 'models', head: SidebarRow): SidebarRow[] => {
  const older: SidebarRow[] =
    scene === 'memory'
      ? [{ title: '大模型辅助数学证明', time: '7分钟前' }]
      : scene === 'mcp'
        ? [{ title: '拉格朗日中值定理', time: '2分钟前' }, { title: '大模型辅助数学证明', time: '9分钟前' }]
        : [{ title: 'Zotero 文献', time: '2分钟前' }, { title: '拉格朗日中值定理', time: '4分钟前' }, { title: '大模型辅助数学证明', time: '11分钟前' }];
  return [head, ...older, { title: '讲透拉格朗日中值定理', time: '23小时前' }, { title: '线性代数：特征值的直觉', time: '2天前' }];
};

/** ProviderIcon 单色图标：deepseek / zhipu 走 lobeIconData，moonshot 走 Lobe KimiMono。 */
const KIMI_PATHS = [
  'M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z',
  'M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z',
];
type Brand = 'deepseek' | 'zhipu' | 'moonshot';
const ProviderGlyph = ({ brand, x, y, size }: { brand: Brand; x: number; y: number; size: number }) => {
  if (brand === 'moonshot') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={FG} fillRule="evenodd" style={at(x, y)}>
        {KIMI_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  }
  const data = lobeIconData[brand];
  return (
    <svg width={size} height={size} viewBox={data.v} style={at(x, y)}>
      {data.p.map((d, i) => (
        <path key={i} d={d} fill={data.f[i] || data.f[0] || FG} />
      ))}
    </svg>
  );
};

/** 三张变体卡（取证 probe-ymm-3：卡宽 240.7、间距 14，换行与真机一致）。 */
const VARIANTS: Array<{ id: string; brand: Brand; x: number; dur: number; lines: string[] }> = [
  { id: 'deepseek-v4', brand: 'deepseek', x: 301, dur: 0.6, lines: ['可以把它看成罗尔定理的「倾', '斜版」：把弦拉平就是罗尔定', '理。光滑曲线上总有一点的切', '线平行于连接两端点的弦，而', '且这一点只保证存在、落在开', '区间 (a, b) 内。'] },
  { id: 'glm-5', brand: 'zhipu', x: 555.7, dur: 0.68, lines: ['几何上看，拉格朗日中值定理', '说的是：光滑曲线上，总有一', '点的切线平行于连接两端点的', '弦。它把「平均变化率」和某', '一点的「瞬时变化率」联系了', '起来。'] },
  { id: 'kimi-k3', brand: 'moonshot', x: 810.3, dur: 0.52, lines: ['把 (f(b) − f(a)) / (b − a) 看成', '弦的斜率，定理断言存在 ξ ∈', '(a, b)，使 f′(ξ) 恰好等于这个', '斜率——平均速度总会在某一', '时刻被瞬时速度精确达到。'] },
];
const CARD_W = 240.7;
const CARD_Y = 207.4;
const LH = 27.52;
const variantAt = (at: number, i: number) => at + 0.02 + i * 0.03;
export const modelsDoneAt = (at: number) => Math.max(...VARIANTS.map((v, i) => variantAt(at, i) + v.dur));

const CardBtn = ({ x, y, children }: { x: number; y: number; children: ReactNode }) => <span style={{ ...at(x, y), width: 16, height: 16, display: 'inline-flex', color: MUTED }}>{children}</span>;

/** at = 发出后第一帧（脚本秒）：三张卡同时起流，各自写完后页脚从「复制 / 取消」换成「复制 / 删除 / ⋯」，卡片随最长的那张一起长高。 */
export const ModelsChat = ({ t, at: a0 }: { t: number; at: number }) => {
  const st = VARIANTS.map((v, i) => {
    const p = clamp((t - variantAt(a0, i)) / v.dur);
    const total = v.lines.reduce((s, l) => s + [...l].length, 0);
    let left = Math.round(total * p);
    const shown: string[] = [];
    for (const l of v.lines) {
      if (left <= 0) break;
      const cs = [...l];
      shown.push(cs.slice(0, left).join(''));
      left -= cs.length;
    }
    return { p, shown, done: p >= 1 };
  });
  const streaming = st.some((s) => !s.done);
  const area = Math.max(...st.map((s) => Math.max(100, 44.2 + s.shown.length * LH)));
  const cardH = 103.5 + area;
  const bottom = CARD_Y + cardH;
  const titled = t >= modelsDoneAt(a0) + 0.12;
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', fontFamily: font.ui, color: FG }}>
      <ChatSidebar rows={youSidebar('models', { title: titled ? MODELS_TITLE : '未命名会话', time: '刚刚', active: true, streaming })} t={t} />
      <UserBubble y={60} text={MODELS_Q} time={YOU_CLOCK.models} />
      <CaretLeft size={16} color="rgba(101, 105, 114, 0.2)" style={at(613.5, 177.4)} />
      <span style={{ ...at(640, 180.4), width: 24, height: 10, borderRadius: 9999, background: PRI }} />
      <span style={{ ...at(678, 180.4), width: 10, height: 10, borderRadius: 9999, background: 'rgba(101, 105, 114, 0.3)' }} />
      <span style={{ ...at(702, 180.4), width: 10, height: 10, borderRadius: 9999, background: 'rgba(101, 105, 114, 0.3)' }} />
      <CaretRight size={16} color={MUTED} style={at(722.5, 177.4)} />
      {VARIANTS.map((v, i) => {
        const s = st[i];
        const border = !s.done ? 'rgba(30, 94, 184, 0.3)' : i === 0 ? 'rgba(30, 94, 184, 0.5)' : 'rgb(224, 224, 224)';
        const footY = bottom - 44;
        return (
          <div key={v.id}>
            <span style={{ ...at(v.x, CARD_Y), width: CARD_W, height: cardH, boxSizing: 'border-box', borderRadius: 10.5, border: `1px solid ${border}`, background: 'rgb(252, 252, 252)' }} />
            <ProviderGlyph brand={v.brand} x={v.x + 15} y={222.1} size={28} />
            <T x={v.x + 51.8} y={218.9} size={12} weight={500} lh={18}>
              {v.id}
            </T>
            <T x={v.x + 51.8} y={236.9} size={11} lh={16.5} color={MUTED}>
              10/03 {YOU_CLOCK.models}
            </T>
            <span style={{ ...at(v.x + 1, 265.9), width: CARD_W - 2, height: 1, background: LINE_SOFT }} />
            {s.shown.length === 0 ? (
              <>
                <span style={{ ...at(v.x + 17, 284), width: 8, height: 16, background: PRI, opacity: 0.5 + 0.5 * Math.cos(t * PACE * Math.PI) }} />
                <T x={v.x + 33} y={282} size={14} lh={20} color={MUTED}>
                  生成中...
                </T>
              </>
            ) : (
              s.shown.map((l, j) => (
                <T key={j} x={v.x + 15} y={288 + j * LH} size={16} lh={LH}>
                  {l}
                </T>
              ))
            )}
            <span style={{ ...at(v.x + 1, footY), width: CARD_W - 2, height: 43, boxSizing: 'border-box', borderTop: `1px solid ${LINE_SOFT}`, background: 'rgba(240, 240, 240, 0.2)' }} />
            <CardBtn x={v.x + 17.5} y={footY + 14}>
              <Copy size={16} />
            </CardBtn>
            {s.done ? (
              <>
                <CardBtn x={v.x + 47.3} y={footY + 14}>
                  <Trash size={16} />
                </CardBtn>
                <CardBtn x={v.x + 77} y={footY + 14}>
                  <DotsThree size={16} weight="bold" />
                </CardBtn>
              </>
            ) : (
              <CardBtn x={v.x + 47.3} y={footY + 14}>
                <Square size={16} />
              </CardBtn>
            )}
          </div>
        );
      })}
      <CardBtn x={374} y={bottom + 23.5}>
        <Copy size={16} />
      </CardBtn>
      <CardBtn x={405.5} y={bottom + 23.5}>
        <GitBranch size={16} />
      </CardBtn>
      <span style={{ opacity: streaming ? 0.5 : 1 }}>
        <CardBtn x={437} y={bottom + 23.5}>
          <ArrowCounterClockwise size={16} />
        </CardBtn>
        <CardBtn x={468.5} y={bottom + 23.5}>
          <Trash size={16} />
        </CardBtn>
      </span>
      <T x={497.5} y={bottom + 24.9} size={11} lh={13.2} color="rgba(101, 105, 114, 0.5)">
        {YOU_CLOCK.models}
      </T>
      <DockComposer text="" caret={false} mode={streaming ? 'stop' : 'idle'} press={0} />
    </div>
  );
};
