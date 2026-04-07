# Smoke Test Checklist — Agent Test Manager

Run this checklist after every installer build before distributing.

## Dev mode (`npm start`)
- [ ] App window opens without errors
- [ ] Sidebar renders (Dashboard, Agents, Test Cases, etc.)
- [ ] AI Scorer badge shows (initializing → loading → ready)
- [ ] Project selector populates with existing workspaces
- [ ] Dashboard shows agent/test counts
- [ ] Create a new project → appears in selector
- [ ] Create an agent → appears in Agents list
- [ ] Create a test case (functional) → appears in Test Cases
- [ ] Run a test plan → results appear in Test Runs
- [ ] Git status shows current branch
- [ ] Logs page loads without error

## Packaged installer (`npm run build`)
- [ ] `dist/AgentTestManager-Setup-x.x.x.exe` exists
- [ ] Install on a clean Windows machine (no Node, no Python)
- [ ] Desktop shortcut appears
- [ ] App launches in < 5 seconds
- [ ] `%APPDATA%\agent-test-manager\workspaces\` created with migrated data
- [ ] All smoke tests above pass
- [ ] Uninstall removes app but preserves userData

## Regression
- [ ] Existing workspace data loads correctly after reinstall
- [ ] Scorer model cached in `%APPDATA%\agent-test-manager\models\`
- [ ] No console errors visible in DevTools (F12)
