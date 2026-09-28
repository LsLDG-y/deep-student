# Backend and protocol cases (private evaluator material)

Ten cases were constructed from the fixed `d6534ff2715e59c4c2c3e6c7bec5f6554576ce68` source tree. All ten passed an author-side baseline → injected defect → reverse-patch reference replay on macOS arm64. The defect state failed a behavior assertion; unrelated pass-to-pass checks remained passing. `verification.json` and its three logs record the results for every case. The author-side logs are evidence, not candidate-visible files and not a substitute for rerunning the evaluator.

| ID | Production behavior | Main test boundary | Difficulty |
|---|---|---|---|
| DS-B01 | Standard MCP wire property names | Real serde serialization/deserialization | 2 |
| DS-B02 | Optional JSON-RPC parameters | Real serde request/notification wire payloads | 1 |
| DS-B03 | Response versus notification dispatch | Real StdioTransport channels and McpClient event loop | 3 |
| DS-B04 | Learning/relearning queue priority | Real scheduling and bounded-bias functions | 2 |
| DS-B05 | Fragmented large SSE event complexity | Real SSE and incremental UTF-8 pipeline | 3 |
| DS-B06 | Legacy Anki source normalization | Real SQLite migration and unique-index constraints | 4 |
| DS-B07 | Local and derived table classification | Real sync classification registry | 3 |
| DS-B08 | Non-monotonic and coupled merge fields | Real merge dispatch, registry and strategies | 3 |
| DS-B09 | Cross-platform filename collisions | Real encoder, decoder, legacy lookup and path checks | 3 |
| DS-B10 | Timeout and in-flight ownership | Real action guard composition with controlled timers | 3 |

## Execution

For Rust cases, run `DS_SOURCE_ROOT=/absolute/candidate cargo test --release --locked --manifest-path /private/backend/harness/Cargo.toml --test b01` (replace the number). The harness compiles whole production modules via `#[path]`, so edits are read from the supplied candidate, not the reference repository. It does not copy production functions. The single framework-bound dependency that none of these tests exercise, learner-profile merging, is a panic-only stub. Any unexpected execution of that dependency fails the run. The library's own test target is disabled; only private integration tests run. Keep the entire private harness outside the candidate sandbox.

DS-B06 uses `DS_SOURCE_ROOT=/absolute/candidate python3 /private/backend/DS-B06/test.py`. Fixtures include NULL-source collisions, already normalized identities, two independent APKG cards, error cards, existing tombstones, idempotent replay and byte-preserved metadata.

DS-B10 imports from a matching repository-relative location and can use the supplied `vitest.config.ts`, or the unified evaluator can rewrite its static import prefix when staging the private test. Its source imports must resolve to candidate modules. Timer control is confined to the test; production guard implementations remain real.

## Preparation and leakage

Apply each `bug.patch` to the fixed anchor, never to a moving branch. The patches edit production portions only and contain no test-module context. Then apply any exact comment fragments in `redactions.json` for that case. The unified preparation step must remove existing tests, historical reports, AGENTS memory, Git data and other solution-bearing artifacts before releasing a candidate bundle. `bug.patch`, `case.json.history`, private tests, reference replay, logs, lock files for the private harness and this directory are evaluator-only.

Some historical fixes were squash commits. DS-B06/08/09 document precisely what the retained aggregate diff or compatibility implementation proves. They do not assert an undocumented number of failed attempts. DS-B04 preserves current interface while restoring the historical single-key priority. DS-B09 restores the documented legacy lossy encoder behavior in the current interface; it is a behavior backport, not a byte-identical reversal of an independently retained commit.

## Performance case qualification

DS-B05 remains `candidate_performance_requires_linux_calibration` until the standard Linux evaluator is calibrated. In the author environment, the 2 MB / 2 million tiny-chunk production workload took approximately 0.06 seconds at the reference and 51 seconds with the historical parser; its reference budget is 3 seconds. Compile time is excluded from the assertion. This large observed margin is promising but does not establish a Linux/VM runtime contract. Exclude this case from the scored core if the reference lacks adequate margin there. Do not silently count timeouts, compile errors or infrastructure failures as behavioral bug detections.

## Scope limits

These cases exercise production business modules and protocol paths, not a full Tauri app launch or a live cloud account. DS-B07 validates the registry boundary, not a complete cross-device sync. UI rendering, storage-provider behavior and desktop lifecycle are outside this subset. A shared evaluator should label these boundaries in the result and offer the raw machine reports to the later reviewer.
