# Changelog

All notable changes to the **TS AiTool** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2025-05-14

### Added

#### Multi-Agent System
- 7 specialized AI agents: Manager, Architect, Developer, QA, Designer, Security, and Writer
- Each agent has a unique system prompt, tool permissions, and turn limits
- Agent switching via sidebar tabs, keyboard shortcut (`Ctrl+Shift+G`), or command palette

#### Workflow Automation
- 4 built-in multi-agent workflows: New Feature, Bug Fix, Code Review, and Release
- Graceful degradation -- workflows continue when individual steps fail
- Partial success reporting with detailed step-by-step summaries
- Workflow state persistence for resume after interruption
- Real-time streaming output for each workflow step

#### Dual Connection Modes
- **CLI Mode**: Connect through your Claude Max/Pro subscription at no additional cost
- **API Mode**: Pay-per-token via Anthropic API key
- Automatic connection status display in the status bar

#### Chat Interface
- Real-time streaming responses with typing indicators
- Markdown rendering with syntax-highlighted code blocks (highlight.js)
- File drag-and-drop attachments (code, text, images, data, config files)
- Image attachments with base64 encoding
- Chat history persistence across VS Code sessions
- Conversation search across all stored chats
- Export conversations to Markdown, HTML, JSON, or clipboard
- Message bookmarks and pinned messages
- 10 built-in prompt templates with `{{variable}}` substitution

#### Editor Integration
- Right-click context menu: Ask Claude, Explain Code, Improve Code, Security Check
- Explorer context menu: Analyze File, Security Scan File
- Active file change detection with automatic context updates
- CWD (current working directory) context awareness

#### Git Integration
- Git status display (branch, uncommitted changes, last commit)
- Git Push command
- Create Pull Request from chat
- View GitHub Issues
- Timed cache for Git queries to reduce overhead

#### Project Management
- Project Dashboard with health scores (0-100)
- Automatic tech stack detection
- CLAUDE.md support for project-level AI context
- Per-project settings (default model, agent, system prompt, ignored files)
- Project timeline with commit, chat, build, and deploy events
- Up to 50 projects with 200 conversations each

#### Skills System
- 6 built-in skills: Hebrew Code Review, Git Workflow, Testing Strategy, Security Checklist, Performance Audit, Accessibility Check
- Skill marketplace UI for browsing and installing skills
- Skills augment agent system prompts with domain-specific expertise

#### Tool Execution
- ToolExecutor service with permission management
- Safe tools (read_file, list_files, search_files) auto-approved
- Dangerous tools (write_file, execute_command, delete_file) require user confirmation
- Three permission presets: Conservative, Normal, Full
- Execution history tracking with timing metrics

#### UI Features
- Full-screen mode in a dedicated editor tab
- Split view for side-by-side chat panels
- Voice input support (Hebrew, English, Arabic)
- Screenshot-to-code conversion
- Quick Actions toolbar with 12 one-click prompt buttons
- Dark, Light, and Auto theme support
- Onboarding wizard for first-time users
- Keyboard shortcuts modal
- Virtual list rendering for long conversations
- Error boundary for graceful UI error recovery
- Toast notification system
- Confirmation dialogs for destructive actions
- Skeleton loaders for async content

#### Internationalization
- Full Hebrew (RTL) and English (LTR) support
- i18next integration with react-i18next
- Automatic document direction switching on language change
- Hebrew-first UI with English fallback

#### Status Bar
- Current Claude model indicator (click to switch)
- Connection mode indicator (CLI/API/Disconnected)
- Session token usage counter with live updates

#### Analytics
- Usage statistics dashboard
- Token tracking per session and per conversation
- Cost estimation based on model pricing
- Daily message and token trends
- Agent usage distribution
- Popular commands tracking

#### Performance & Reliability
- LRU response cache for repeated queries
- Error classification system (Network, Auth, Rate Limit, Validation)
- Smart retry logic with exponential backoff
- Idle-based CLI timeout management
- Session state recovery after crashes or reloads
- Auto-save on window blur

#### Developer Experience
- Learning mode: adds detailed Hebrew comments to all generated code
- Auto-context: automatically detects and attaches relevant files
- Dependency scanning command
- System diagnostics (Doctor command) for troubleshooting

#### Security
- Content Security Policy (CSP) enforcement in webviews
- DOMPurify for HTML sanitization
- Input validation on all tool inputs
- No secrets stored in plaintext (API keys via VS Code secret storage)

### Fixed

- CLI subprocess stability on Windows with `fnm` (use stable `node.exe` path)
- Result event text extraction bug in streaming responses
- Chat history not persisting across session reloads
- CLI timeout too aggressive (increased to 180s with idle-based detection)
- CSP violations in webview resource loading

### Security

- All webview content sanitized with DOMPurify
- CSP headers applied to all webview panels
- Tool execution requires explicit user approval for write operations
- API keys stored securely via VS Code extension context

---

## [0.2.0] - 2026-03-14

### Added
- Circular dependency detection for workflows (DFS algorithm prevents infinite loops)
- Comprehensive CSS design system: semantic colors, z-index scale, typography scale
- Button system with 3 sizes, 4 variants, loading state, disabled state
- Status badges (success/warning/error/info) with built-in styling
- Responsive breakpoints (768px, 480px) with touch device support
- Keyboard navigation for AgentTabs (arrows, Home/End) with full ARIA support
- Character counter with Hebrew support in InputArea
- Toast animations (entrance/exit) with smooth transitions
- ConfirmDialog with backdrop blur and entrance animation
- `useMemo` optimization for message filtering in ChatPanel
- Agent-colored borders on MessageBubble component
- Semantic health score colors on ProjectCard

### Changed
- AgentTabs now fully accessible with ARIA roles and keyboard navigation
- Chat messages cleared immediately on agent/project switch (no more flash)

### Fixed
- **Flash of old messages** when switching agents via tabs (critical UX bug)
- **Flash of old messages** when switching projects (critical UX bug)
- Promise leak in ToolExecutionCoordinator (added `.catch()` handler)
- Non-null assertion crashes in AgentHandler (4 locations → null checks with early return)
- Non-null assertion crash in ClaudeService (→ null check with error throw)
- Fire-and-forget promises in SidebarProvider and FullScreenPanel (added `.catch()`)
- Silent failure in ConversationStore (added `.catch()` with logging)
- Missing error boundary in AppContext message handler (added `try/catch`)
- Draft save crash in ConversationManager (added `try/catch`)

---

## [Unreleased]

### Added
<!-- Add new features here -->

### Changed
<!-- Add changes here -->

### Fixed
<!-- Add bug fixes here -->

### Security
<!-- Add security-related changes here -->

---

<!-- Release template for future versions:

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing features

### Deprecated
- Features that will be removed in future versions

### Removed
- Features that were removed

### Fixed
- Bug fixes

### Security
- Security-related changes

-->

[0.1.0]: https://github.com/ts-aitool/ts-aitool/releases/tag/v0.1.0
[Unreleased]: https://github.com/ts-aitool/ts-aitool/compare/v0.1.0...HEAD
