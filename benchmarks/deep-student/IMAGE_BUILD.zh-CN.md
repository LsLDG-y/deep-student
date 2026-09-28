# 离线评测镜像

`build_image.py` 在宿主机准备固定依赖，然后以断网构建生成 `deep-student-bench:1.0`。评测阶段继续使用 `--network none`。镜像只含工具链和第三方依赖，不含项目生产源码、历史 Git、题目补丁、隐藏测试或参考答案。

```bash
python3 benchmarks/deep-student/build_image.py
```

默认目标是 Linux arm64。Linux amd64 主机使用 `--architecture amd64`。宿主需要 Python 3.12+、Git、Node/npm、Cargo、curl 和可工作的 Docker；首次准备阶段需要宿主网络。Docker 构建本身无需容器网络。镜像使用 Rust 1.94-bookworm 与 Node 22.22.0，Node 架构随目标平台选择。

依赖由固定项目锚点的 `package.json`、`package-lock.json`、`.npmrc` 和 `patches/` 构建。`.npmrc` 中的 legacy-peer-deps 设置不可遗漏。Linux 可选原生包通过 npm 的 `--os=linux --cpu=<目标>` 选择；安装脚本先禁用，再显式执行已有 patch-package 补丁。Cargo 依赖使用 private/backend/harness/Cargo.lock，并用 `cargo vendor --locked` 带入镜像；容器在 `/opt/cargo-vendor` 离线读取。

宿主准备目录会保留在临时目录，命令会打印其位置。中断后可使用同一目录继续：

```bash
python3 benchmarks/deep-student/build_image.py \
  --context /绝对路径/先前打印的准备目录 \
  --reuse-node-deps
```

`--reuse-node-deps` 仅适用于该目录中的 npm 安装已成功结束；它不会重新安装依赖。重新完整安装时，脚本先将已有 node_modules 移到新的 `/tmp/deep-student-old-node-modules-*` 目录保留。没有全局清理动作。

若 Docker 本地官方 Rust 基底不能实际启动，脚本才启用宿主下载恢复：从 Docker Hub 的官方 library/rust 仓库选择目标架构，下载该版本的 config 与完整 layers，打包后 `docker load`。这用于处理 Docker daemon 无法联网或本地镜像层缺失的真实故障。恢复不会清除 Docker 数据或其他镜像；若宿主网络也不可达，脚本明确失败，保留已完成的下载。传输使用 curl 自带的有限网络重试，不增加应用运行时重试逻辑。

镜像中约定的路径：

- `/opt/node/bin`：Node/npm，在 PATH 中。
- `/opt/deps/node_modules`：项目版本的第三方前端依赖。
- `/opt/cargo-vendor`：锁定的 Rust crate 源码。
- `/usr/local/cargo/config.toml`：Cargo vendor 源配置。
- `/opt/cargo-target`：仅第三方依赖和无业务代码的 dummy crate 编译缓存。

评测器应将 `/opt/cargo-target` 复制到本次容器可写的临时目录后再编译候选代码。镜像构建末尾会在无网络容器中执行 Python、Node、Cargo 和 Vitest 的版本检查；各题的参考/缺陷/候选校准由统一评测命令负责。

本机历史 author-side 验证使用 macOS 的原生环境，不能替代容器验证。DS-B05 性能题已在 Linux ARM64 镜像中完成差分校准并纳入正式题集；更换架构、镜像或资源配额后，仍需重新校准。实测记录见 `VALIDATION.zh-CN.md`。
