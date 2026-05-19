# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**React Component Generator** is a web application that generates React components from natural language prompts using AI. Users write descriptions, the backend calls Claude or Gemini API, and the generated components are instantly previewed and displayed with code.

## Technology Stack

- **Frontend**: React 19 + TypeScript + Vite (port 5173)
- **Backend**: Bun server (port 3002)
- **Runtime Rendering**: react-live
- **AI Providers**: Anthropic Claude (haiku) + Google Gemini 2.5-flash

## Architecture

### Frontend Structure
- **src/App.tsx**: Main layout with header, settings panel (provider + API key), and results grid
- **src/components/**:
  - `PromptInput.tsx`: Input form for component descriptions
  - `ComponentCard.tsx`: Card layout displaying each generated component
  - `LivePreview.tsx`: Runtime preview using react-live
  - `CodeView.tsx`: Displays generated code with syntax highlighting
- **src/hooks/useComponentGenerator.ts**: Custom hook managing component state, API calls, and error handling
- **src/types/index.ts**: TypeScript type definitions (Provider, GeneratedComponent)

### Backend Structure
- **server/index.ts**: Bun server with two API endpoints
  - `GET /api/config`: Returns which API keys are configured in `.env`
  - `POST /api/generate`: Takes `{ prompt, apiKey?, provider }`, calls AI, returns `{ code }`
  - **SYSTEM_PROMPT**: Instructions for AI to generate valid react-live compatible code

### Data Flow
1. User enters prompt → PromptInput component
2. `handleGenerate()` calls `useComponentGenerator.generate(prompt, apiKey, provider)`
3. Frontend POST to `/api/generate` with provider and optional apiKey
4. Server strips code fences and ensures `render(<Component />)` call
5. Generated code stored in component state with timestamp
6. ComponentCard renders with LivePreview + CodeView side-by-side

## Common Commands

```bash
# Install dependencies (uses Bun)
bun install

# Run dev server + API server concurrently
bun run dev

# Run server only (watches for changes)
bun run server

# Build TypeScript + Vite bundle
bun run build

# Run ESLint
bun run lint

# Preview production build
bun run preview
```

## Configuration

Create `.env` with API keys to avoid entering them in the UI:

```
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
```

Or leave `.env` empty and users can paste keys directly in the UI.

## Key Implementation Details

### Code Generation Rules (in SYSTEM_PROMPT)
- **No TypeScript syntax**: Plain JavaScript only, no type annotations
- **No imports**: React is global; use `React.useState`, `React.useEffect`
- **Inline styles only**: No CSS imports or modules
- **Self-contained**: Single component definition + `render()` call
- **Interactive**: Add hover/click states where appropriate

### Important Quirks
- `stripCodeFences()` removes markdown code blocks (triple backticks)
- `ensureRenderCall()` auto-appends `render(<ComponentName />)` if missing
- Vite proxy routes `/api/*` to `http://localhost:3002`
- Component IDs: `{timestamp}-{random}` for uniqueness

### Error Handling
- 400: Missing API key or prompt
- 429: Rate limit (Google/Claude)
- 503: API overload (Google/Claude)
- MAX_TOKENS: Gemini response too long (caught and reported)

## Testing the App

1. Start dev server: `bun run dev`
2. Open `http://localhost:5173`
3. Choose provider (Anthropic or Google)
4. Paste API key or ensure `.env` is configured
5. Enter prompt like "a blue button with hover effect"
6. Check preview and code

## Future Improvements

- Component history/persistence (localStorage or DB)
- Code export (JSX file download)
- Prompt templates/examples library
- Dark mode support
- Custom CSS module support (currently inline-only)
