import { ArrowSquareOut, BookOpenText, Brain, CheckCircle, CircleNotch, DownloadSimple, FilePdf, Globe, MagnifyingGlass, NotePencil, Stack } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { clamp, ease, prog } from '../lib/time';
import { font, type Tokens } from '../theme';

/**
 * 08 调研：对话里的「调研模式」步骤清单 → 报告存为笔记；「学术搜索」查 arXiv → 下载入库；
 * 资源库「知识库索引」（learningHub 文案：正在 OCR 识别 / 正在建立索引 / 已索引）。
 */
export const CHAT_W = 1000;
export const CHAT_H = 800;
export const NOTE_W = 660;
export const NOTE_H = 720;
export const HUB_W = 1080;
export const HUB_H = 640;

const RESEARCH_Q = '调研：大模型现在怎样辅助数学证明？整理成一篇笔记';
const PAPER_Q = '再找 2026 年 LLM 数学推理的论文，下载最相关的一篇';

export const STEPS: Array<[string, string, ReactNode]> = [
  ['明确调研目标', '拆成 4 个子问题', <Brain key="b" size={15} />],
  ['联网搜索', 'Tavily · 博查 · 12 个来源', <Globe key="g" size={15} />],
  ['本地资料检索', '3 份笔记 · 1 本教材', <MagnifyingGlass key="m" size={15} />],
  ['分析整理', '去重、交叉核对、提炼观点', <Stack key="s" size={15} />],
  ['生成报告', '6 节 · 约 2,400 字', <NotePencil key="n" size={15} />],
];

const PAPERS: Array<[string, string, string]> = [
  ['Formal Theorem Proving with Process-Supervised Language Models', 'L. Chen, A. Gupta, et al.', 'arXiv:2603.04117 · 2026-03'],
  ['Self-Verifying Chain-of-Thought for Competition Mathematics', 'R. Okafor, Y. Sato, et al.', 'arXiv:2605.11862 · 2026-05'],
  ['Lean-Augmented Retrieval for Undergraduate Analysis Proofs', 'M. Li, K. Novak, et al.', 'arXiv:2607.02290 · 2026-07'],
];

export type ResearchState = {
  sent: number;
  steps: number;
  noteTool: number;
  paperSent: number;
  search: number;
  results: number;
  dlPress: number;
  dl: number;
};

const Bubble = ({ tk, text, k }: { tk: Tokens; text: string; k: number }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', opacity: k, transform: `translateY(${(1 - k) * 10}px)` }}>
    <div style={{ maxWidth: '80%', borderRadius: 12, padding: '11px 16px', background: tk.muted, fontSize: 15, lineHeight: '24px', color: tk.foreground }}>{text}</div>
  </div>
);

const ToolRow = ({ tk, icon, label, status, done, k }: { tk: Tokens; icon: ReactNode; label: string; status: string; done: boolean; k: number }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, fontSize: 14, opacity: k }}>
    <span style={{ color: done ? tk.success : tk.mutedFg, display: 'inline-flex' }}>{done ? <CheckCircle size={16} weight="fill" /> : <CircleNotch size={16} />}</span>
    <span style={{ color: tk.mutedFg, display: 'inline-flex' }}>{icon}</span>
    <span style={{ color: tk.foreground }}>{label}</span>
    <span style={{ fontSize: 13, color: done ? tk.success : tk.mutedFg }}>{status}</span>
  </div>
);

export const ResearchChat = ({ tk, s, t }: { tk: Tokens; s: ResearchState; t: number }) => {
  const scroll = -260 * ease.inOutCubic(clamp(s.paperSent * 1.2));
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: font.ui, background: tk.background }}>
      <div style={{ height: 46, borderBottom: `1px solid ${tk.border}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', fontSize: 14 }}>
        <span style={{ fontWeight: 600, color: tk.foreground }}>大模型辅助数学证明</span>
        <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 12, color: tk.primary, background: `color-mix(in hsl, ${tk.primary} 10%, transparent)` }}>调研模式</span>
        <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 12, color: tk.mutedFg, background: tk.muted }}>学术搜索</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 46, bottom: 120, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 60, right: 60, top: 26, transform: `translateY(${scroll}px)`, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Bubble tk={tk} text={RESEARCH_Q} k={s.sent} />
          {s.steps > 0 ? (
            <div style={{ borderRadius: 12, border: `1px solid ${tk.border}`, background: tk.card, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tk.mutedFg }}>
                <span style={{ fontWeight: 600, color: tk.foreground }}>调研计划</span>
                <span>深度：标准 · 输出：报告笔记</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.min(5, Math.floor(s.steps * 5))}/5</span>
              </div>
              <div style={{ marginTop: 10 }}>
                {STEPS.map(([name, detail, icon], i) => {
                  const k = s.steps * 5 - i;
                  const done = k >= 1;
                  const active = k > 0 && k < 1;
                  return (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 36, opacity: k > -0.2 ? 1 : 0.45 }}>
                      <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', color: done ? tk.success : active ? tk.primary : tk.mutedFg }}>
                        {done ? <CheckCircle size={17} weight="fill" /> : active ? <span style={{ display: 'inline-flex', transform: `rotate(${t * 720}deg)` }}><CircleNotch size={17} /></span> : <span style={{ width: 13, height: 13, borderRadius: '50%', border: `1.5px solid ${tk.border}` }} />}
                      </span>
                      <span style={{ color: tk.mutedFg, display: 'inline-flex' }}>{icon}</span>
                      <span style={{ fontSize: 15, color: done || active ? tk.foreground : tk.mutedFg, textDecoration: done ? 'none' : undefined }}>{name}</span>
                      <span style={{ fontSize: 13, color: tk.mutedFg, opacity: done || active ? 1 : 0 }}>{detail}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {s.noteTool > 0 ? <ToolRow tk={tk} icon={<NotePencil size={15} />} label="创建笔记" status={s.noteTool >= 1 ? '完成 · 已存入「笔记」' : '执行中...'} done={s.noteTool >= 1} k={clamp(s.noteTool * 4)} /> : null}
          {s.paperSent > 0 ? <Bubble tk={tk} text={PAPER_Q} k={s.paperSent} /> : null}
          {s.search > 0 ? <ToolRow tk={tk} icon={<BookOpenText size={15} />} label="arXiv Search" status={s.search >= 1 ? '完成 · 3 篇' : '执行中...'} done={s.search >= 1} k={clamp(s.search * 4)} /> : null}
          {s.results > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PAPERS.map(([title, authors, meta], i) => {
                const k = clamp(s.results * 3 - i);
                const first = i === 0;
                return (
                  <div key={title} style={{ borderRadius: 12, border: `1px solid ${first && s.dl > 0 ? `color-mix(in hsl, ${tk.primary} 40%, ${tk.border})` : tk.border}`, background: tk.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: k, transform: `translateY(${(1 - k) * 8}px)` }}>
                    <span style={{ width: 34, height: 40, borderRadius: 4, flexShrink: 0, background: `color-mix(in hsl, ${tk.destructive} 9%, #fff)`, color: tk.destructive, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FilePdf size={20} weight="fill" />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: tk.foreground, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                      <span style={{ display: 'block', marginTop: 3, fontSize: 12, color: tk.mutedFg }}>
                        {authors} · {meta}
                      </span>
                    </span>
                    {first ? (
                      <span
                        style={{
                          height: 32,
                          minWidth: 100,
                          padding: '0 12px',
                          borderRadius: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          fontSize: 13,
                          fontWeight: 500,
                          color: s.dl >= 1 ? tk.success : tk.foreground,
                          background: s.dl > 0 && s.dl < 1 ? `linear-gradient(90deg, color-mix(in hsl, ${tk.primary} 14%, transparent) ${s.dl * 100}%, ${tk.muted} ${s.dl * 100}%)` : tk.muted,
                          transform: `scale(${1 - s.dlPress * 0.05})`,
                        }}
                      >
                        {s.dl >= 1 ? <CheckCircle size={14} weight="fill" /> : <DownloadSimple size={14} />}
                        {s.dl >= 1 ? '已入库' : s.dl > 0 ? `${Math.round(s.dl * 100)}%` : '下载 PDF'}
                      </span>
                    ) : (
                      <ArrowSquareOut size={15} color={tk.mutedFg} />
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 60, right: 60, bottom: 24, height: 76, borderRadius: 16, border: `1px solid ${tk.border}`, background: tk.background, boxShadow: tk.shadowSoft, padding: '12px 16px', boxSizing: 'border-box', fontSize: 15, color: tk.mutedFg }}>
        输入消息...
      </div>
    </div>
  );
};

const NOTE_SECTIONS: Array<[string, string]> = [
  ['一、形式化证明：让模型写 Lean', '把定理翻译成 Lean / Isabelle 代码，由证明助手逐步验证，模型只负责搜索证明路径 [1][3]。'],
  ['二、过程监督：每一步都可检查', '对推理链的每一步打分而不是只看答案，竞赛题准确率显著提高，也更容易定位错误 [2]。'],
  ['三、检索增强：先找到可用的引理', '从教材与定理库里检索相关引理再组织证明，本科分析学证明的成功率提升明显 [3]。'],
];

export const NoteView = ({ tk, k }: { tk: Tokens; k: number }) => (
  <div style={{ position: 'absolute', inset: 0, fontFamily: font.ui, background: tk.background, padding: '26px 34px', boxSizing: 'border-box' }}>
    <div style={{ fontSize: 12, color: tk.mutedFg }}>笔记 · 调研报告 · 刚刚</div>
    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 600, lineHeight: 1.35, color: tk.foreground }}>大模型辅助数学证明：现状与方法</div>
    <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
      {['调研', '数学证明', 'LLM'].map((x) => (
        <span key={x} style={{ padding: '2px 9px', borderRadius: 999, fontSize: 12, color: tk.mutedFg, background: tk.muted }}>{x}</span>
      ))}
    </div>
    {NOTE_SECTIONS.map(([h, p], i) => {
      const kk = clamp(k * 3.2 - i * 0.7);
      return (
        <div key={h} style={{ marginTop: 20, opacity: kk, transform: `translateY(${(1 - kk) * 8}px)` }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: tk.foreground }}>{h}</div>
          <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.8, color: tk.foreground }}>{p}</div>
        </div>
      );
    })}
    <div style={{ position: 'absolute', left: 34, right: 34, bottom: 24, paddingTop: 12, borderTop: `1px solid ${tk.border}`, fontSize: 12, lineHeight: 1.8, color: tk.mutedFg }}>
      参考来源 12 · 本地资料 4 · 由调研模式生成，可继续编辑
    </div>
  </div>
);

const PIPE = ['OCR 识别', '分块', '向量化', '已索引'];

export const HubIndexView = ({ tk, k }: { tk: Tokens; k: number }) => {
  const stage = k * 4;
  const pct = Math.round(97.7 + 2.3 * clamp(k * 1.05));
  const ring = 0.977 + 0.023 * clamp(k * 1.05);
  const R = 34;
  const C = 2 * Math.PI * R;
  const chunks = Math.round(4646 + 66 * clamp(k * 1.1));
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: font.ui, background: tk.background, display: 'flex' }}>
      <div style={{ width: 210, borderRight: `1px solid ${tk.border}`, background: tk.nav, padding: '18px 12px', boxSizing: 'border-box', fontSize: 13 }}>
        {['全部文件', '全部笔记', '全部教材', '全部题目集', '全部翻译', '全部作文', '知识导图'].map((x) => (
          <div key={x} style={{ height: 34, display: 'flex', alignItems: 'center', padding: '0 10px', borderRadius: 8, color: tk.foreground }}>{x}</div>
        ))}
        <div style={{ height: 34, display: 'flex', alignItems: 'center', padding: '0 10px', borderRadius: 8, color: tk.foreground, background: tk.selected, fontWeight: 500 }}>知识库索引</div>
      </div>
      <div style={{ flex: 1, padding: '22px 26px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ position: 'relative', width: 84, height: 84 }}>
            <svg width={84} height={84} viewBox="0 0 84 84" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
              <circle cx={42} cy={42} r={R} fill="none" stroke={tk.muted} strokeWidth={6} />
              <circle cx={42} cy={42} r={R} fill="none" stroke={tk.success} strokeWidth={6} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ring)} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 600, color: tk.foreground }}>{pct}%</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: tk.foreground }}>知识库索引</div>
            <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.6, color: tk.mutedFg, maxWidth: 440 }}>完成索引后，AI 才能在对话中检索这些内容。</div>
          </div>
          <span style={{ flex: 1 }} />
          {[
            ['文本块', chunks.toLocaleString('en-US')],
            ['已索引', String(42 + (k >= 1 ? 1 : 0))],
            ['待索引', String(k >= 1 ? 0 : 1)],
          ].map(([l, v]) => (
            <div key={l} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: tk.mutedFg }}>{l}</div>
              <div style={{ marginTop: 2, fontSize: 20, fontWeight: 600, color: tk.foreground, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, borderRadius: 12, border: `1px solid ${tk.border}`, overflow: 'hidden' }}>
          {[
            ['Formal Theorem Proving with Process-Supervised LMs.pdf', '刚刚', true],
            ['高数期中模拟卷.pdf', '09:02', false],
            ['雅思大作文二稿.docx', '14:08', false],
            ['高等数学（第七版）上册.pdf', '昨天', false],
          ].map(([name, when, fresh], i) => (
            <div key={name as string} style={{ minHeight: 56, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', borderTop: i ? `1px solid ${tk.border}` : undefined, background: fresh ? `color-mix(in hsl, ${tk.primary} 4%, ${tk.background})` : tk.background }}>
              <FilePdf size={20} color={fresh ? tk.destructive : tk.mutedFg} weight={fresh ? 'fill' : 'regular'} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: tk.foreground, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
              {fresh ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {PIPE.map((p, j) => {
                    const sk = clamp(stage - j);
                    const done = sk >= 1;
                    const active = sk > 0 && sk < 1;
                    return (
                      <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {j ? <span style={{ width: 16, height: 1, background: done || active ? tk.primary : tk.border }} /> : null}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, fontSize: 12, color: done ? (j === 3 ? tk.success : tk.foreground) : active ? tk.primary : tk.mutedFg, background: done && j === 3 ? `color-mix(in hsl, ${tk.success} 12%, transparent)` : active ? `color-mix(in hsl, ${tk.primary} 10%, transparent)` : tk.muted }}>
                          {done ? <CheckCircle size={12} weight="fill" /> : null}
                          {p}
                        </span>
                      </span>
                    );
                  })}
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, fontSize: 12, color: tk.success, background: `color-mix(in hsl, ${tk.success} 12%, transparent)` }}>
                  <CheckCircle size={12} weight="fill" />
                  已索引
                </span>
              )}
              <span style={{ width: 46, textAlign: 'right', fontSize: 12, color: tk.mutedFg }}>{when as string}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** 第一篇论文「下载 PDF」按钮中心（对话窗口内容坐标，需要传入当前滚动后的位置）。 */
export const paperDownloadCenter = () => ({ x: CHAT_W - 60 - 16 - 50, y: 46 + 26 - 260 + 0 });
