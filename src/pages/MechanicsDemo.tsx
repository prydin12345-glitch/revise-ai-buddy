import React from 'react';
import { MechanicsDraw } from '@/components/mechanics';
import type { MechanicsConfig } from '@/components/mechanics';

const examples: { title: string; config: MechanicsConfig }[] = [
  {
    title: 'Inclined Plane (Rough)',
    config: {
      type: 'slope',
      angle: 30,
      mass: 'm',
      surface: 'rough',
      showNormal: true,
      showWeight: true,
      showFriction: true,
      showComponents: false,
      showLabels: true,
    },
  },
  {
    title: 'Connected Particles (Pulley)',
    config: {
      type: 'pulley',
      surface: 'smooth',
      angle: 0,
      masses: { hanging: 3, onSurface: 5 },
      showLabels: true,
      showForces: true,
      friction: false,
    },
  },
  {
    title: 'Moments on a Beam',
    config: {
      type: 'beam',
      length: 6,
      pivot: { type: 'support', position: 2 },
      loads: [
        { position: 0.5, magnitude: 10, label: 'W' },
        { position: 5, magnitude: 15, label: '3W' },
      ],
      reactions: [{ position: 2, label: 'R' }],
      showLabels: true,
    },
  },
  {
    title: 'Projectile Motion',
    config: {
      type: 'projectile',
      speed: 28,
      angle: 45,
      launchHeight: 0,
      targetX: 40,
      targetY: 20,
      showComponents: true,
      showLabels: true,
    },
  },
  {
    title: 'Leaning Rod (Ladder)',
    config: {
      type: 'rod',
      angle: 60,
      mass: 'M',
      length: '2a',
      wallType: 'smooth',
      floorType: 'rough',
      showForces: true,
      showLabels: true,
    },
  },
];

const MechanicsDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="text-2xl font-bold mb-6 text-foreground">MechanicsDraw — Diagram Gallery</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {examples.map((ex, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3 text-foreground">{ex.title}</h2>
            <MechanicsDraw config={ex.config} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MechanicsDemo;
