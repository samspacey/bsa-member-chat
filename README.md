# BSA Member Chat

A simulation tool for building society executives to "chat" with representative member personas. Built for use at BSA conferences to help board members and ExCo understand their customers' perspectives.

## Features

- **Persona-based roleplay**: Chat with AI-powered simulated members based on real customer archetypes
- **Society-specific knowledge**: Each persona understands their building society's products, branches, and recent news
- **Authentic responses**: Personas express genuine concerns, push back on corporate speak, and ask their own questions

## Current Personas

### Monmouthshire Building Society

| Persona | Description |
|---------|-------------|
| **Margaret Davies** (👵) | 74, retired teacher, traditional saver. Uses Newport branch weekly. Worried about branch closures, doesn't trust apps. |
| **Rhys Morgan** (👨‍💻) | 29, software developer, first-time buyer. Digital-first, frustrated by outdated tech. Wants to support local but needs convincing. |

## Getting Started

### Prerequisites

- Node.js 18+
- Anthropic API key

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/bsa-member-chat.git
cd bsa-member-chat

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start chatting.

### Deployment (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Add `ANTHROPIC_API_KEY` environment variable
4. Deploy

## Adding New Personas

1. Create a YAML file in `/personas/` (see existing files for structure)
2. Add society knowledge in `/knowledge/` if needed
3. Update the `personas` array in `app/page.tsx`

## Adding New Building Societies

1. Create knowledge markdown in `/knowledge/society-name.md`
2. Add mapping in `app/api/chat/route.ts`
3. Create personas that reference the new society

## Project Structure

```
bsa-member-chat/
├── app/
│   ├── api/chat/route.ts    # Claude API integration
│   ├── page.tsx             # Main chat UI
│   ├── layout.tsx           # App layout
│   └── globals.css          # Styles
├── personas/                 # Persona YAML definitions
│   ├── margaret.yaml
│   └── rhys.yaml
├── knowledge/               # Society knowledge bases
│   └── monmouthshire.md
└── README.md
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **AI**: Claude (Anthropic API)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## License

MIT
