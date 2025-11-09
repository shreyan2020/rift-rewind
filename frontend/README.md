# Rift Rewind Frontend# React + TypeScript + Vite



React + TypeScript frontend for the Rift Rewind v2 experience - an immersive narrative journey through League of Legends data.This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.



## Tech StackCurrently, two official plugins are available:



- **React 18**: Modern React with hooks- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh

- **TypeScript**: Type-safe development- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

- **Vite**: Lightning-fast build tool

- **Tailwind CSS**: Utility-first styling## React Compiler

- **Framer Motion**: Smooth animations

- **Recharts**: Data visualizationsThe React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

- **Axios**: HTTP client

## Expanding the ESLint configuration

## Project Structure

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```

frontend/```js

├── src/export default defineConfig([

│   ├── components/  globalIgnores(['dist']),

│   │   ├── Journey.tsx         # Main orchestrator  {

│   │   ├── ChapterView.tsx     # Individual quarter display    files: ['**/*.{ts,tsx}'],

│   │   └── FinalDashboard.tsx  # Final summary with charts    extends: [

│   ├── constants/      // Other configs...

│   │   ├── regionThemes.ts     # Region-specific theming

│   │   └── valueDescriptions.ts # Playstyle value explanations      // Remove tseslint.configs.recommended and replace with this

│   ├── api.ts                  # API client functions      tseslint.configs.recommendedTypeChecked,

│   ├── App.tsx                 # Entry point      // Alternatively, use this for stricter rules

│   ├── main.tsx                # React DOM root      tseslint.configs.strictTypeChecked,

│   └── index.css               # Global styles + Tailwind      // Optionally, add this for stylistic rules

├── public/                     # Static assets      tseslint.configs.stylisticTypeChecked,

├── index.html                  # HTML entry point

├── package.json                # Dependencies      // Other configs...

├── tsconfig.json               # TypeScript config    ],

├── tailwind.config.js          # Tailwind configuration    languageOptions: {

└── vite.config.ts              # Vite build config      parserOptions: {

```        project: ['./tsconfig.node.json', './tsconfig.app.json'],

        tsconfigRootDir: import.meta.dirname,

## Components      },

      // other options...

### Journey.tsx    },

  },

**Purpose**: Orchestrates the entire user journey from start to finale.])

```

**Responsibilities**:

- Poll job status every 3 secondsYou can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

- Load quarter data when ready

- Manage navigation between chapters```js

- Load finale data after Q4// eslint.config.js

- Handle reset/new journeyimport reactX from 'eslint-plugin-react-x'

import reactDom from 'eslint-plugin-react-dom'

**State**:

- `jobStatus`: Current job status from APIexport default defineConfig([

- `currentChapter`: Active chapter (Q1-Q4 or FINAL)  globalIgnores(['dist']),

- `chapterData`: Loaded quarter stories  {

- `finaleData`: Final summary data    files: ['**/*.{ts,tsx}'],

    extends: [

### ChapterView.tsx      // Other configs...

      // Enable lint rules for React

**Purpose**: Display individual quarter with region theme and narrative.      reactX.configs['recommended-typescript'],

      // Enable lint rules for React DOM

**Features**:      reactDom.configs.recommended,

- Region-specific backgrounds (Demacia, Noxus, Ionia, etc.)    ],

- Animated lore text    languageOptions: {

- Performance stats display      parserOptions: {

- Playstyle values visualization        project: ['./tsconfig.node.json', './tsconfig.app.json'],

- Role-specific reflection        tsconfigRootDir: import.meta.dirname,

- Next chapter navigation      },

      // other options...

### FinalDashboard.tsx    },

  },

**Purpose**: Consolidated view of all 4 quarters with progression charts.])

```

**Features**:
- AI-generated finale lore
- Consolidated reflections (bullet points)
- Season stats summary
- Interactive timeline charts
- Value progression visualization
- "New Journey" button

## API Integration

### Type Definitions

```typescript
interface Quarter {
  quarter: string;
  region: string;
  lore: string;
  reflection: string;
  stats: {
    games: number;
    kda_proxy: number;
    cs_per_min: number;
    gold_per_min: number;
    vision_score_per_min: number;
    ping_rate_per_min: number;
    primary_role: string;
    obj_damage_per_min: number;
    kill_participation: number;
    control_wards_per_game: number;
  };
  values: Record<string, number>;
  top_values: string[];
  top_champions: Array<{ name: string; games: number }>;
}

interface Finale {
  lore: string;
  final_reflection: string[];
  total_games: number;
  quarters: Quarter[];
}
```

## Development

### Setup

```bash
cd frontend
npm install
```

### Running Locally

```bash
npm run dev
# Opens at http://localhost:5173
```

### Building

```bash
npm run build
# Output in dist/
```

### Linting

```bash
npm run lint
```

## Configuration

### API Endpoint

Update in `src/api.ts`:

```typescript
const BASE_URL = 'https://your-api-gateway-url.amazonaws.com';
```

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy to S3

```bash
aws s3 sync dist/ s3://your-frontend-bucket --delete --region your-region
```

## Troubleshooting

### Issue: API calls failing with CORS error

**Solution**: Verify API Gateway CORS settings and bucket policy.

### Issue: Blank page after deployment

**Solution**: Check browser console, ensure S3 error document is `index.html`.

### Issue: Finale not loading (403 error)

**Solution**: Update S3 bucket policy to allow public read for `*/finale.json`.

---

For more information, see the main [README.md](../README.md).
