import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {PhysicsDiagramDraw} from '@/components/physics/PhysicsDiagramDraw';
import ProjectileRenderer from '@/components/mechanics/renderers/ProjectileRenderer';

afterEach(cleanup);

describe('Physics assessment renderer safety', () => {
  it('leaves unknown daughter numbers unsolved', () => {
    const {container} = render(<PhysicsDiagramDraw mode="assessment" config={{
      type: 'nuclear_decay', variant: 'alpha_decay', parentSymbol: 'U',
      parentMassNumber: 238, parentAtomicNumber: 92, daughterSymbol: '?',
    }}/>);
    expect(container).toHaveTextContent('238');
    expect(container).toHaveTextContent('92');
    expect(container).toHaveTextContent('?');
    expect(container).not.toHaveTextContent(/234|90|Mass number:|Atomic number:|✓/);
  });

  it('displays supplied daughter numbers including zero without calculating replacements', () => {
    const {container} = render(<PhysicsDiagramDraw mode="assessment" config={{
      type: 'nuclear_decay', variant: 'beta_minus_decay', parentSymbol: 'X',
      parentMassNumber: 14, parentAtomicNumber: 6, daughterSymbol: 'Y',
      daughterMassNumber: 14, daughterAtomicNumber: 0,
    }}/>);
    const labels = [...container.querySelectorAll('text')].map(node => node.textContent);
    expect(labels).toContain('0');
    expect(labels).not.toContain('7');
    expect(container).not.toHaveTextContent('✓');
  });

  it('keeps a flat-mirror setup free of the image and construction requested from the student', () => {
    const {container} = render(<PhysicsDiagramDraw mode="assessment" config={{
      type: 'ray_diagram', variant: 'flat_mirror', showImage: false, showConstruction: false,
    }}/>);
    expect(screen.getByText('Object')).toBeInTheDocument();
    expect(screen.queryByText('Image')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('virtual');
    expect(container.querySelectorAll('line')).toHaveLength(3);
  });

  it('preserves legacy teaching diagrams when assessment mode is not requested', () => {
    const {container} = render(<PhysicsDiagramDraw config={{
      type: 'nuclear_decay', variant: 'alpha_decay', parentSymbol: 'U',
      parentMassNumber: 238, parentAtomicNumber: 92,
    }}/>);
    expect(container).toHaveTextContent('234');
    expect(container).toHaveTextContent('90');
    expect(container).toHaveTextContent('Mass number:');
  });

  it('shows two given waves without solving their superposition', () => {
    const {container} = render(<PhysicsDiagramDraw mode="assessment" config={{
      type: 'wave_diagram', variant: 'superposition', amplitude: 1,
      amplitude2: 0.5, phaseShift: Math.PI,
    }}/>);
    expect(screen.getByText('Wave 1')).toBeInTheDocument();
    expect(screen.getByText('Wave 2')).toBeInTheDocument();
    expect(screen.queryByText('Resultant')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/constructive interference|destructive interference/);
    expect(container.querySelectorAll('path')).toHaveLength(2);
  });

  it('preserves the saved projectile symbols', () => {
    const {container} = render(<svg><ProjectileRenderer config={{
      type: 'projectile', speed: 'u', angle: 'α', launchHeight: 0,
      targetX: 40, targetY: 0, showComponents: false, showLabels: true,
    }}/></svg>);
    expect(screen.getByText('α')).toBeInTheDocument();
    expect(screen.getByText('u')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('40°');
  });

  it.each(['bar_magnet', 'two_bar_magnets_attract', 'two_bar_magnets_repel', 'current_solenoid', 'current_straight_wire', 'motor_effect'] as const)(
    'keeps %s field lines hidden when the student must draw them', variant => {
      const {container} = render(<PhysicsDiagramDraw mode="assessment" config={{
        type: 'magnetic_field', variant, currentDirection: 'out_of_page',
        showFieldLines: false, showArrows: false,
      }}/>);
      expect(container.querySelector('[stroke="hsl(221 83% 53%)"]')).toBeNull();
      expect(container).not.toHaveTextContent(/clockwise|uniform and parallel|Field lines run|unlike poles|like poles|Magnetic field B/);
    },
  );

  it('shows unlike poles facing in the attraction setup', () => {
    const {container} = render(<PhysicsDiagramDraw mode="assessment" config={{
      type: 'magnetic_field', variant: 'two_bar_magnets_attract',
    }}/>);
    expect([...container.querySelectorAll('text')].map(node => node.textContent)).toEqual(['N', 'S', 'N', 'S']);
  });

  it.each(['refraction_block', 'optical_fibre', 'prism_dispersion'] as const)(
    'does not complete the student ray construction for %s', variant => {
      const {container} = render(<PhysicsDiagramDraw mode="assessment" config={{
        type: 'ray_diagram', variant, showConstruction: false, showImage: false,
      }}/>);
      expect(container).not.toHaveTextContent(/Emergent ray|Total Internal Reflection|critical angle|Red|Violet/);
      expect(container.querySelectorAll('[stroke="hsl(25 95% 53%)"]')).toHaveLength(variant === 'refraction_block' ? 1 : 0);
    },
  );

  it('leaves the classification of a standing-wave harmonic to the student', () => {
    const {container} = render(<PhysicsDiagramDraw mode="assessment" config={{
      type: 'wave_diagram', variant: 'standing_wave', harmonicNumber: 2,
    }}/>);
    expect(container.querySelector('path')).not.toBeNull();
    expect(container).not.toHaveTextContent(/harmonic|overtone/);
  });
});
