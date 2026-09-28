import { appendFileSync } from 'node:fs';

// OpenCode v2 may accept a prompt before the MCP tool reaches its registry.
// Wait for the actual capability, not an elapsed startup delay or model output.
export default {
  id: 'deep-student-bench-container-ready',
  async setup(ctx) {
    const output = process.env.DS_BENCH_TOOL_AUDIT;
    if (!output) throw new Error('Missing benchmark tool audit output');
    const record = (data) => appendFileSync(output, JSON.stringify({ at: new Date().toISOString(), ...data }) + '\n');
    await ctx.session.hook('prompt', async () => {
      const deadline = Date.now() + 20000;
      while (true) {
        const tools = await ctx.tool.list();
        if (tools.some((tool) => tool.id === 'bench_shell' && tool.options?.codemode === false)) {
          record({ phase: 'registry-ready', names: ['bench_shell'] });
          return;
        }
        if (Date.now() >= deadline) throw new Error('Benchmark container tool did not become ready');
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    });
    await ctx.session.hook('context', (event) => {
      record({ phase: 'context', names: Object.keys(event.tools) });
    });
    await ctx.session.hook('http.request', async (event) => {
      const body = await event.request.clone().json();
      record({ phase: 'http.request', kind: event.kind,
        names: (body.tools ?? []).map((tool) => tool.function?.name ?? tool.name ?? tool.type) });
    });
  },
};
