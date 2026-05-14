# Savanna Sentinel — Frontend

React + TypeScript + Vite PWA. UI built with shadcn/ui and Tailwind CSS v4.

## Getting started

```bash
npm install
npm run dev
```

## Adding shadcn components

```bash
npx shadcn@latest add button
npx shadcn@latest add card dialog input
```

Components are copied into `src/components/ui/` and are fully editable.

## Using colours

### Brand palette — general UI

```tsx
<div className="bg-brand-dark-blue text-brand-off-white" />
<div className="bg-brand-steel-blue" />
<div className="border-brand-light-grey" />
```

### shadcn system tokens — use these inside components

```tsx
<div className="bg-primary text-primary-foreground" />  {}
<div className="bg-accent text-accent-foreground" />    {}
<div className="bg-muted text-muted-foreground" />
<div className="bg-sidebar text-sidebar-foreground" />  {}
```

### Spot colours — alerts, heatmaps, risk scoring only

```tsx
<span className="text-spot-green" />   {}
<span className="text-spot-yellow" />  {}
<span className="text-spot-red" />     {}
<span className="text-spot-orange" />  {}
```

## Utilities

```ts
import { cn } from '@/lib/utils'

// Merge Tailwind classes safely
cn('px-4 py-2', isActive && 'bg-primary')
```

## Icons

Lucide React is the only icon library. No others should be added.

```tsx
import { MapPin, AlertTriangle, Shield } from 'lucide-react'

<MapPin className="size-4" />
```
