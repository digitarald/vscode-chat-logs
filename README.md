# Copilot Chat Log Viewer

A beautiful web app that renders GitHub Copilot VS Code chat logs with a VS Code-like interface.

**🌐 [Try it now →](https://digitarald.github.io/vscode-chat-logs/)**

## Why?

Share your Copilot conversations with others in a readable, shareable format. Perfect for:
- Debugging sessions you want to share with teammates
- Showcasing AI-assisted development workflows
- Creating tutorials and documentation
- Analyzing Copilot's tool usage patterns

## How it works

1. Export your Copilot chat from VS Code
2. Paste it into a GitHub Gist
3. Enter the Gist URL
4. View your conversation with full markdown, code highlighting, and tool call details

## Features

- 🎨 VS Code-inspired dark theme
- 📝 Full markdown and code syntax highlighting
- 🔧 Collapsible tool call sections
- 📱 Mobile responsive
- ⚡ Static site - no server required
- 🔗 Shareable via URL

## Example Gists

You can explore the viewer immediately by opening one of these sample Copilot chat logs:

| Description | Direct Viewer Link | Raw Gist |
|-------------|--------------------|----------|
| Sample Chat Log 1 | `/view?gistId=c4cfa2f93b5a47e815f3fcb6d8d442cb` | https://gist.github.com/digitarald/c4cfa2f93b5a47e815f3fcb6d8d442cb |
| Sample Chat Log 2 | `/view?gistId=3c4369b6b19b509d40460413c8b3a333` | https://gist.github.com/digitarald/3c4369b6b19b509d40460413c8b3a333 |

Click the viewer links (after running the dev server or on the deployed site) to load the chat log. Fetching relies on the public GitHub Gist API and is subject to unauthenticated rate limits (60 requests/hour).

## Development

```bash
npm install
npm run dev     # Start development server
npm test        # Run tests
npm run build   # Build for production
```

Built with Next.js, TypeScript, and Tailwind CSS.

## License

MIT
