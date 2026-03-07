

# MechanicsDraw Component System — Implementation Plan

## Overview

Build a programmatic SVG-based mechanics diagram system that renders five diagram types (slope, pulley, beam, projectile, rod) from JSON config objects. No static images — every line, arc, arrow, and label is computed from config values.

## New Files to Create

### 1. `src/components/mechanics/types.ts`
Define TypeScript interfaces for all five config schemas:
- `SlopeConfig` — inclined plane with mass, forces, friction
- `PulleyConfig` — connected particles over pulley
- `BeamConfig` — moments with pivot, loads, reactions
- `ProjectileConfig` — trajectory with velocity components
- `RodConfig` — leaning ladder/rod against wall
- Union type `MechanicsConfig` and shared constants (colors, marker IDs)

### 2. `src/components/mechanics/MechanicsDraw.tsx`
Main component with `switch(config.type)` dispatching to sub-renderers. Shared SVG setup:
- `viewBox="0 0 400 300"`, `width="100%"` for responsive scaling
- `<defs>` block with named arrow markers per color (black, red, blue, orange, green) — no `context-fill`
- Hatched ground baseline helper function
- `showLabels` toggle: when false, render `?` placeholder boxes instead of labels

### 3. `src/components/mechanics/renderers/SlopeRenderer.tsx`
- Compute slope endpoints via `Math.cos/sin(angle * Math.PI/180)`
- Rotate parent group for slope alignment; counter-rotate weight arrow to keep it vertical
- Draw: slope surface, mass block, normal (blue), weight (red), friction (orange if rough)
- Angle arc via SVG `<path>` arc command, radius 35px, grey stroke

### 4. `src/components/mechanics/renderers/PulleyRenderer.tsx`
- Pulley circle at top-right, string lines to both masses
- Surface mass on table/slope, hanging mass below pulley
- Force arrows: tension (black), weight (red), normal (blue), friction (orange if rough)
- Hatched ground/table surface

### 5. `src/components/mechanics/renderers/BeamRenderer.tsx`
- Horizontal beam scaled by `length`, loads as downward red arrows at positions
- Pivot rendered as triangle (support), wall bracket (wall), or circle (hinge)
- Reaction arrows (blue, upward) at pivot positions
- Distance labels between key points along the beam

### 6. `src/components/mechanics/renderers/ProjectileRenderer.tsx`
- Parabolic trajectory via parametric equations from speed/angle
- Dashed trajectory path, launch point, target point
- Velocity component vectors (green) with horizontal/vertical decomposition
- Angle arc at launch point

### 7. `src/components/mechanics/renderers/RodRenderer.tsx`
- Rod leaning at angle between floor and wall
- Wall reaction (blue, horizontal), floor reaction (blue, vertical), friction (orange)
- Weight arrow (red) at center of mass
- Smooth/rough labels for wall and floor surfaces

### 8. `src/components/mechanics/index.ts`
Export all types, `MechanicsDraw` component, and helper functions like `generateSlopeConfig()`.

### 9. `src/pages/MechanicsDemo.tsx`
Demo page rendering 4 example configs side-by-side in a 2×2 grid (slope, pulley, beam, projectile) for visual verification.

## Files to Modify

### `src/App.tsx`
- Add route: `/mechanics-demo` → `MechanicsDemo` page

## Styling Constants (Exam Paper Aesthetic)
- Background: `#ffffff`
- Structural lines: black, `strokeWidth={2}`
- Weight arrows: `#cc0000` (red)
- Normal reactions: `#0055cc` (blue)
- Tension/strings: black
- Friction: `#cc6600` (orange)
- Velocity: `#007700` (green)
- Labels: `fontFamily="serif"`, `fontStyle="italic"` (LaTeX-like)
- Ground: hatched diagonal ticks every 15px

## Key Technical Details

- **Geometry from config**: All positions computed mathematically — e.g., slope end = `(length * cos(θ), length * sin(θ))`
- **Arrow markers**: One `<marker>` per color in `<defs>`, referenced via `markerEnd="url(#arrow-red)"`
- **Weight always vertical**: Use nested `<g transform>` — rotate group for slope, counter-rotate weight vector
- **showLabels=false**: Renders small bordered rectangles with "?" for student identification exercises
- **No external libraries**: Pure React + SVG

