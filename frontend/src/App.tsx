import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function App() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold text-primary">Savanna Sentinel</h1>

      <div className="flex gap-4">
        <Button variant="default">Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
      </div>

      <Input className="max-w-sm" placeholder="Test input" />
    </main>
  )
}
