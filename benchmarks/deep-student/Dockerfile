ARG BASE_IMAGE=rust:1.94-bookworm
FROM ${BASE_IMAGE}
ARG NODE_DIRECTORY=node-v22.22.0-linux-arm64
COPY ${NODE_DIRECTORY}/ /opt/node/
ENV PATH="/opt/node/bin:${PATH}"
COPY deps/node_modules/ /opt/deps/node_modules/
COPY cargo-vendor/ /opt/cargo-vendor/
COPY cargo-config.toml /usr/local/cargo/config.toml
COPY cargo-warmup/ /opt/cargo-warmup/
ENV CARGO_TARGET_DIR=/opt/cargo-target
RUN python3 --version && node --version && cargo --version && \
    cargo build --release --locked --offline --manifest-path /opt/cargo-warmup/Cargo.toml
WORKDIR /work
CMD ["python3", "--version"]
