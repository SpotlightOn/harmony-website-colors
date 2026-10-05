import { ControlPanel } from '@/components/ControlPanel';
import { DemoSite } from '@/components/site/DemoSite';
import { useScheme } from '@/state/useScheme';

export function App() {
  const controls = useScheme();

  return (
    <div className="app">
      <ControlPanel controls={controls} />
      <DemoSite derived={controls.derived} />
    </div>
  );
}