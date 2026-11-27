FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends bubblewrap socat slirp4netns \
    && bwrap --version \
    && socat -V \
    && slirp4netns --version \
    && apt-get clean
