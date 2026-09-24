# Agent instructions

## Auto-sync of this workspace

- When working on this repo during a session and files under `~/.hubsy` change (edits, new outputs, logs, config, skills, memory), commit and push to `origin/main` WITHOUT asking the user first.
- Use a concise, descriptive commit message.
- Prefer committing related changes together; commit promptly after meaningful changes rather than waiting until the end of the session.
- Do not set up any background watcher/launchd job — this is in-session only.
- Never commit secrets or personal data without checking first.