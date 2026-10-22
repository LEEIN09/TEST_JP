# Working on 하루

- Use the existing checkout. Cloud tasks are already isolated; do not create a Git worktree unless the user requests one.
- Read README.md for current scope, run commands, storage compatibility, and limitations.
- The project uses React, TypeScript, Vite, Node.js 24, and npm. Run commands from this repository root. Use `npm ci --cache=/tmp/test-jp-npm-cache` to install from the lockfile.
- Keep Japanese learning content in `src/curriculum.json`, lesson definitions in `src/content.ts`, scheduling/storage in `src/progress.ts`, and answer matching in `src/reading.ts`. Preserve existing `haru.progress.v1` browser records when evolving the schema.
- Pronunciation files are bundled MP3s with attribution in `public/audio/NOTICE.txt`. The optional generator is `tools/generate_audio.py`; it is not a runtime dependency. Do not remove voice attribution or claim that synthesized speech has been checked by a native speaker without evidence.
- Verify learning or scheduling changes with `npm test`, `npm run build`, and the relevant Playwright flows (`npm run test:e2e`). E2E tests use the configured Chromium executable and start/reuse a Vite server on port 5173.
- Distinguish local development, an environment configuration draft, GitHub publication, and app deployment. Do not introduce API credentials, login, or deployment as part of routine local setup.
