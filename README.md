<p align="center">
  <img src="media/icon.png" alt="TS AiTool Logo" width="128" height="128" />
</p>

<h1 align="center">TS AiTool</h1>

<p align="center">
  <strong>AI-Powered Project Management with Multi-Agent System & Hebrew RTL Support</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=ts-aitool.ts-aitool">
    <img src="https://img.shields.io/visual-studio-marketplace/v/ts-aitool.ts-aitool?label=VS%20Code%20Marketplace&color=blue" alt="VS Code Marketplace" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=ts-aitool.ts-aitool">
    <img src="https://img.shields.io/visual-studio-marketplace/d/ts-aitool.ts-aitool?color=green" alt="Downloads" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=ts-aitool.ts-aitool">
    <img src="https://img.shields.io/visual-studio-marketplace/r/ts-aitool.ts-aitool?color=yellow" alt="Rating" />
  </a>
  <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="License" />
  <img src="https://img.shields.io/badge/Claude-Sonnet%204%20%7C%20Opus%204%20%7C%20Haiku%204.5-blueviolet" alt="Claude Models" />
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#installation">Installation</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#agents">Agents</a> |
  <a href="#configuration">Configuration</a> |
  <a href="#keyboard-shortcuts">Shortcuts</a> |
  <a href="#hebrew-section">עברית</a>
</p>

---

## Overview

**TS AiTool** is a comprehensive VS Code extension that brings Claude AI directly into your development workflow. It features a **multi-agent system** with 7 specialized AI agents, **workflow automation**, native **Hebrew RTL support**, and a rich chat interface -- all powered by Anthropic's Claude models.

Use your existing **Claude Max/Pro subscription** via CLI mode (no extra cost!) or connect with an **API key** for pay-per-token usage.

<!-- Screenshot placeholder -->
<!-- ![TS AiTool Screenshot](media/screenshot-main.png) -->

---

## Features

### Multi-Agent System

Seven specialized AI agents, each with a distinct role, system prompt, and set of allowed tools:

| Agent | Role | Description |
|-------|------|-------------|
| **Manager** | Project Manager | Analyzes tasks, delegates work, coordinates agents |
| **Architect** | Software Architect | Plans system architecture, design patterns, tech decisions |
| **Developer** | Developer | Writes code, fixes bugs, implements features |
| **QA** | Quality Assurance | Writes tests, finds bugs, ensures quality |
| **Designer** | UI/UX Designer | Designs interfaces, RTL support, accessibility |
| **Security** | Security Expert | OWASP scans, vulnerability detection, security audits |
| **Writer** | Technical Writer | README files, API docs, JSDoc/TSDoc comments |

### Automated Workflows

Chain multiple agents together for complex tasks with **graceful degradation** -- if one step fails, the workflow continues with the remaining steps.

| Workflow | Pipeline | Description |
|----------|----------|-------------|
| **New Feature** | Architect -> Developer -> QA -> Security -> Writer | End-to-end feature implementation |
| **Bug Fix** | Developer (analyze) -> Developer (fix) -> QA | Root cause analysis and fix with tests |
| **Code Review** | Security -> QA -> Writer | Comprehensive security and quality review |
| **Release** | QA -> Security -> Developer (bump) -> Writer | Full release preparation pipeline |

### Dual Connection Modes

- **CLI Mode** (Recommended) -- Uses your Claude Max/Pro subscription at no additional cost
- **API Mode** -- Pay-per-token via Anthropic API key

### Chat Interface

- Real-time **streaming responses** with typing indicators
- **Markdown rendering** with syntax-highlighted code blocks
- **File attachments** -- drag and drop code files, images, and documents
- **Image attachments** with base64 encoding
- **Chat history persistence** across sessions
- **Search** across all conversations
- **Export** conversations to Markdown, HTML, JSON, or clipboard
- **Bookmarks and pinned messages** for important references
- **Prompt templates** with variable substitution (10 built-in templates)

### Editor Integration

Right-click context menu commands when you select code:

- **Ask Claude about code** -- Get explanations and answers
- **Explain code** -- Detailed walkthrough of logic and design patterns
- **Improve code** -- Refactoring and quality suggestions
- **Security check** -- OWASP vulnerability scan on selected code

Right-click files in the Explorer:

- **Analyze file** -- Comprehensive file analysis
- **Security scan** -- Full security audit of a file

### Git Integration

- View current branch, uncommitted changes, and last commit
- **Git Push** directly from the extension
- **Create Pull Requests** through the chat
- **View GitHub Issues**
- Cached Git queries for performance

### Project Management

- **Project Dashboard** with health scores (0-100)
- Automatic tech stack detection
- **CLAUDE.md** support for project-specific AI context
- Project-specific settings (default model, agent, system prompt)
- **Project Timeline** -- visual history of commits, chats, builds

### Skills Marketplace

Installable skill modules that augment agent capabilities:

- Hebrew Code Review
- Git Workflow (conventional commits, branch naming)
- Testing Strategy (unit, integration, e2e)
- Security Checklist (OWASP Top 10)
- Performance Audit
- Accessibility Check (WCAG 2.1 AA)

### Tool Execution System

Agents can use tools with a **permission system**:

- **Safe tools** (read_file, list_files, search_files) -- auto-approved
- **Dangerous tools** (write_file, execute_command, delete_file) -- require user confirmation
- Three permission presets: Conservative, Normal, Full

### Additional Features

- **Full-screen mode** and **split view** for side-by-side chat panels
- **Voice input** support (Hebrew, English, Arabic)
- **Screenshot to code** conversion
- **Dependency scanning**
- **System diagnostics** (Doctor command)
- **Quick Actions** toolbar with 12 one-click prompts
- **Status bar** showing current model, connection status, and token usage
- **Onboarding wizard** for first-time setup
- **Dark/Light/Auto** theme support
- **Learning mode** -- adds detailed Hebrew comments to all generated code
- **Analytics dashboard** with usage statistics, token tracking, and cost estimation
- **Session state recovery** after crashes or reloads
- **LRU response cache** for repeated queries
- **Error classification** with smart retry logic (network, auth, rate limit)

---

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac)
3. Search for **"TS AiTool"**
4. Click **Install**

### From VSIX File

```bash
code --install-extension ts-aitool-0.1.0.vsix
```

### Build from Source

```bash
git clone https://github.com/ts-aitool/ts-aitool.git
cd ts-aitool
npm install
npm run build
npm run package
```

---

## Quick Start

1. **Install the extension** from the VS Code Marketplace
2. Click the **TS AiTool icon** in the Activity Bar (left sidebar)
3. Choose your connection mode:
   - **CLI Mode** (recommended): Requires the [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) installed and authenticated
   - **API Mode**: Enter your Anthropic API key in settings
4. Start chatting with Claude!

### First Run

The onboarding wizard will guide you through:
- Choosing a connection mode
- Setting your preferred language (Hebrew / English)
- Selecting a default AI model
- Creating your first project

---

## Agents

### How the Agent System Works

Each agent has a specialized **system prompt**, a set of **allowed tools**, and a **maximum turns** limit. When you switch agents, the AI adapts its behavior, expertise, and capabilities accordingly.

**Switch agents** using:
- The agent tabs in the sidebar
- The `Ctrl+Shift+G` keyboard shortcut
- The command palette: "TS AiTool: Select Agent"

### Workflow Execution

Workflows chain multiple agents in sequence. Each step receives the output of previous steps via `{{variable}}` template substitution. Workflows support:

- **Graceful degradation**: If a step fails, subsequent independent steps still execute
- **Partial success reporting**: A detailed summary shows which steps succeeded, failed, or were skipped
- **State persistence**: Interrupted workflows can be resumed from where they stopped
- **Real-time progress**: Each step streams its output to the chat in real time

---

## Configuration

All settings are accessible via `File > Preferences > Settings > TS AiTool` or the gear icon in the sidebar.

| Setting | Default | Description |
|---------|---------|-------------|
| `tsAiTool.connectionMode` | `cli` | Connection mode: `cli` (your subscription) or `api` (pay-per-token) |
| `tsAiTool.apiKey` | `""` | Anthropic API Key (only needed in API mode) |
| `tsAiTool.model` | `claude-sonnet-4-20250514` | Default AI model: Sonnet 4 (recommended), Opus 4 (most capable), or Haiku 4.5 (fastest) |
| `tsAiTool.language` | `he` | Interface language: Hebrew (`he`) or English (`en`) |
| `tsAiTool.theme` | `auto` | Color theme: `auto`, `dark`, or `light` |
| `tsAiTool.fontSize` | `14` | Chat font size (10--24) |
| `tsAiTool.maxTokens` | `4096` | Maximum tokens per response (256--200,000) |
| `tsAiTool.learningMode` | `false` | When enabled, adds detailed Hebrew comments to all generated code |
| `tsAiTool.permissionPreset` | `normal` | Tool permission level: `conservative`, `normal`, or `full` |
| `tsAiTool.quickActionsVisible` | `true` | Show quick action buttons in the chat toolbar |
| `tsAiTool.autoContext` | `true` | Automatically detect and attach relevant files to context |
| `tsAiTool.voiceLanguage` | `he-IL` | Voice input language: Hebrew, English, or Arabic |

---

## Keyboard Shortcuts

| Shortcut | Mac | Command | Context |
|----------|-----|---------|---------|
| `Ctrl+Shift+A` | `Cmd+Shift+A` | Toggle AI Panel | Global |
| `Ctrl+Shift+N` | `Cmd+Shift+N` | New Chat | Global |
| `Ctrl+Shift+F1` | `Cmd+Shift+F1` | Full-Screen Mode | Global |
| `Ctrl+Shift+F` | `Cmd+Shift+F` | Search Chats | Panel focused |
| `Ctrl+L` | `Ctrl+L` | Clear Chat | Panel focused |
| `Ctrl+/` | `Ctrl+/` | Quick Actions | Panel focused |
| `Ctrl+Shift+G` | `Cmd+Shift+G` | Switch Agent | Panel focused |
| `Ctrl+Shift+2` | `Cmd+Shift+2` | Split View | Panel focused |
| `Ctrl+Shift+V` | `Cmd+Shift+V` | Voice Input | Panel focused |
| `Ctrl+Shift+B` | `Cmd+Shift+B` | Run Project | Panel focused |

---

## Commands

All commands are available from the Command Palette (`Ctrl+Shift+P`):

| Command | Description |
|---------|-------------|
| `TS AiTool: Toggle Panel` | Open/close the AI sidebar |
| `TS AiTool: New Chat` | Start a new conversation |
| `TS AiTool: Cancel Request` | Cancel the current AI request |
| `TS AiTool: Clear Chat` | Clear the current conversation |
| `TS AiTool: Full Screen` | Open chat in a full editor tab |
| `TS AiTool: Split View` | Open two chat panels side by side |
| `TS AiTool: Select Agent` | Choose a specialized AI agent |
| `TS AiTool: Run Workflow` | Execute a multi-agent workflow |
| `TS AiTool: Switch Model` | Change the Claude model |
| `TS AiTool: Search Chats` | Search across all conversations |
| `TS AiTool: Export Chat` | Export current conversation |
| `TS AiTool: Git Push` | Push changes to remote |
| `TS AiTool: Create PR` | Create a Pull Request |
| `TS AiTool: Show Issues` | View GitHub Issues |
| `TS AiTool: New Project` | Create a new project |
| `TS AiTool: Switch Project` | Switch between projects |
| `TS AiTool: Run Project` | Build and run the current project |
| `TS AiTool: Settings` | Open extension settings |
| `TS AiTool: Skill Marketplace` | Browse and install skills |
| `TS AiTool: Scan Dependencies` | Scan project dependencies |
| `TS AiTool: Project Timeline` | View project event timeline |
| `TS AiTool: Run Diagnostics` | System health check |
| `TS AiTool: Voice Input` | Start voice input |
| `TS AiTool: Screenshot to Code` | Convert a screenshot to code |
| `TS AiTool: Open Terminal` | Open an in-chat terminal |

---

## Requirements

- **VS Code** 1.85.0 or later
- **Node.js** 18+ (for CLI mode)
- **Claude CLI** installed and authenticated (for CLI mode) -- [Installation Guide](https://docs.anthropic.com/en/docs/claude-cli)
- **Anthropic API Key** (for API mode only) -- [Get API Key](https://console.anthropic.com/)

---

## Supported Models

| Model | Best For | Max Tokens |
|-------|----------|------------|
| **Claude Sonnet 4** | General use, balanced speed and intelligence (recommended) | 64,000 |
| **Claude Opus 4** | Complex tasks, deep reasoning, large codebases | 200,000 |
| **Claude Haiku 4.5** | Quick tasks, simple questions, low latency | 64,000 |

---

## Troubleshooting

### API Key Not Working

- **Symptom**: "Authentication error" or "401 Unauthorized" when sending messages.
- **Fix**:
  1. Verify your API key starts with `sk-ant-` and has not expired.
  2. Re-enter your API key via the extension settings panel (not in `settings.json` -- keys are stored securely via VS Code's SecretStorage).
  3. Ensure you have sufficient credits on your [Anthropic Console](https://console.anthropic.com/).
  4. If using CLI mode, run `claude login` in your terminal to re-authenticate.

### Extension Not Loading

- **Symptom**: The TS AiTool icon does not appear in the Activity Bar, or the sidebar shows a blank panel.
- **Fix**:
  1. Check that VS Code is version 1.85.0 or later (`Help > About`).
  2. Reload the window: `Ctrl+Shift+P` then "Developer: Reload Window".
  3. Check the Output panel (`View > Output`) and select "TS AiTool" from the dropdown for error logs.
  4. If you installed from a VSIX, ensure it was built for your VS Code version.
  5. Disable other extensions temporarily to rule out conflicts.

### CLI Mode Issues

- **Symptom**: "Claude Code CLI not found" error.
- **Fix**:
  1. Install the CLI globally: `npm install -g @anthropic-ai/claude-code`
  2. Authenticate: `claude login`
  3. Verify it works: `claude -p "hello"` in your terminal.
  4. On Windows with `fnm`, ensure a stable `node.exe` path is available (not a temporary `fnm_multishells` path). Installing Node.js via the official installer to `C:\Program Files\nodejs\` is recommended.

### Slow Performance with Long Conversations

- **Symptom**: The chat panel becomes sluggish after many messages.
- **Fix**: The extension uses virtualized rendering for conversations with more than 15 messages. If you still experience slowness, start a new chat (`Ctrl+Shift+N`) and keep individual conversations focused.

### Known Limitations

- Voice input requires a browser-compatible speech recognition API and may not work in all environments.
- Screenshot-to-code is experimental and works best with simple UI layouts.
- CLI mode timeout is set to 5 minutes of idle time; very large project scans may occasionally exceed this.
- The extension currently supports up to 50 projects with 200 conversations each.

---

## Known Issues

- Voice input requires a browser-compatible speech recognition API and may not work in all environments
- Screenshot-to-code is experimental and works best with simple UI layouts
- CLI mode requires the Claude CLI to be properly installed and accessible in PATH
- On Windows with `fnm`, ensure a stable `node.exe` path is available

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes with conventional commits (`feat:`, `fix:`, `refactor:`)
4. Run tests: `npm test`
5. Run lint: `npm run lint`
6. Submit a Pull Request

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode (watches both extension and webview)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Package as VSIX
npm run package
```

### Project Architecture

```
src/
  extension/           # VS Code extension backend (Node.js)
    handlers/          # Message handlers (Chat, Agent, Git, Settings, etc.)
    services/          # Core services (Claude, Git, Export, Projects, etc.)
    SidebarProvider.ts # Webview sidebar bridge
    FullScreenPanel.ts # Full-screen editor panel
    extension.ts       # Entry point
  webview/             # React frontend (Webview)
    components/        # UI components (Chat, Agents, Projects, Settings)
    state/             # App state management (Context + Reducer)
    utils/             # Markdown rendering, diff parser, performance
    i18n.ts            # Internationalization (Hebrew/English)
  shared/              # Shared types, constants, and utilities
    types.ts           # TypeScript interfaces
    constants.ts       # Agents, workflows, models, quick actions
    messages.ts        # Message protocol between extension and webview
  i18n/                # Translation files
  test/                # Unit tests (Vitest)
```

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div dir="rtl">

<a name="hebrew-section"></a>

## עברית

### סקירה כללית

**TS AiTool** הוא תוסף VS Code מקיף שמביא את Claude AI ישירות לסביבת הפיתוח שלך. התוסף כולל **מערכת מולטי-אייג'נט** עם 7 סוכנים מתמחים, **אוטומציית תהליכי עבודה**, תמיכה מלאה ב**עברית וב-RTL**, וממשק צ'אט עשיר.

### תכונות עיקריות

- **7 סוכני AI מתמחים**: מנהל פרויקט, ארכיטקט, מפתח, בודק איכות, מעצב UI/UX, מומחה אבטחה, כותב תיעוד
- **תהליכי עבודה אוטומטיים**: שרשור סוכנים למשימות מורכבות עם התאוששות חכמה מכשלונות
- **מצב CLI**: השתמש במנוי Claude Max/Pro שלך ללא עלות נוספת
- **תמיכה מלאה ב-RTL**: ממשק עברי מותאם מימין לשמאל
- **מצב למידה**: הערות מפורטות בעברית על כל קוד שנוצר
- **חנות כישורים**: מודולים להרחבת יכולות הסוכנים
- **אינטגרציית Git**: Push, Pull Request, Issues ישירות מהתוסף
- **ייצוא שיחות**: Markdown, HTML, JSON, העתקה ללוח
- **תבניות פרומפט**: 10 תבניות מובנות עם תמיכה במשתנים
- **אבחון מערכת**: בדיקת תקינות CLI, API, וחיבורים

### סוכנים

| סוכן | תפקיד | תיאור |
|------|--------|-------|
| **מנהל פרויקט** | ניהול | מנתח משימות, מחלק עבודה, מתאם בין סוכנים |
| **ארכיטקט** | תכנון | מתכנן מבנה מערכת, דפוסי עיצוב, החלטות טכנולוגיות |
| **מפתח** | פיתוח | כותב קוד, מתקן באגים, מממש פיצ'רים |
| **בודק איכות** | בדיקות | כותב טסטים, מוצא באגים, מבטיח איכות |
| **מעצב UI/UX** | עיצוב | מעצב ממשקים, תמיכה ב-RTL, נגישות |
| **מומחה אבטחה** | אבטחה | סורק פגיעויות, OWASP, בדיקות אבטחה |
| **כותב תיעוד** | תיעוד | README, API docs, הערות JSDoc/TSDoc |

### תהליכי עבודה מובנים

| תהליך | צינור | תיאור |
|--------|-------|-------|
| **פיצ'ר חדש** | ארכיטקט -> מפתח -> QA -> אבטחה -> תיעוד | מימוש פיצ'ר מקצה לקצה |
| **תיקון באג** | מפתח (ניתוח) -> מפתח (תיקון) -> QA | ניתוח שורש הבעיה ותיקון |
| **סקירת קוד** | אבטחה -> QA -> כותב | סקירה מקיפה של אבטחה ואיכות |
| **שחרור גרסה** | QA -> אבטחה -> מפתח -> תיעוד | הכנה מלאה לשחרור |

### קיצורי מקלדת

| קיצור | פקודה |
|--------|-------|
| `Ctrl+Shift+A` | פתיחת/סגירת פאנל AI |
| `Ctrl+Shift+N` | שיחה חדשה |
| `Ctrl+Shift+F1` | מסך מלא |
| `Ctrl+Shift+F` | חיפוש בשיחות |
| `Ctrl+L` | ניקוי שיחה |
| `Ctrl+/` | פעולות מהירות |
| `Ctrl+Shift+G` | החלפת סוכן |
| `Ctrl+Shift+2` | תצוגה מפוצלת |
| `Ctrl+Shift+V` | קלט קולי |
| `Ctrl+Shift+B` | הרצת פרויקט |

### התקנה מהירה

1. התקן את התוסף מ-VS Code Marketplace
2. לחץ על אייקון **TS AiTool** בסרגל הפעילות
3. בחר מצב חיבור:
   - **CLI** (מומלץ): דורש התקנת [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli)
   - **API**: הזן מפתח API של Anthropic
4. התחל לשוחח עם Claude!

### דרישות מערכת

- VS Code 1.85.0 ומעלה
- Node.js 18+ (למצב CLI)
- Claude CLI מותקן ומאומת (למצב CLI)
- מפתח API של Anthropic (למצב API בלבד)

</div>

---

<p align="center">
  Made with care for Hebrew-speaking developers and the global community.
  <br/>
  <sub>Powered by <a href="https://www.anthropic.com/">Anthropic Claude</a></sub>
</p>
