import { assert } from '@ember/debug';

import { type Snapshot, CopiedCSS } from '../utils/measurement.ts';
import { type Value } from '../value/index.ts';
import { type Animator } from './animator.ts';
import ContextAwareBounds, {
  type Bounds,
  type BoundsDelta,
} from './context-aware-bounds.ts';

export interface ISpriteModifier {
  element: Element;
  id: string;
  role: string | null; // TODO can we change this to HTMLElement
}
export class SpriteIdentifier {
  id: string | null;
  role: string | null;

  // assign defaults here because we get inconsistent results from non-typesafe arguments from modifiers
  constructor(id: string | null = null, role: string | null = null) {
    this.id = id;
    this.role = role;
  }
  equals(other: SpriteIdentifier): boolean {
    return this.id === other.id && this.role === other.role;
  }
  toString(): string {
    return `id:${this.id};role:${this.role}`;
  }
}

export default class Sprite {
  element: HTMLElement;
  identifier: SpriteIdentifier;
  type: SpriteType | null = null;
  counterpart: Sprite | null = null;
  time: number;
  hidden = false;

  animatorAncestors: Animator[] = [];
  defaultAnimator: Animator | undefined = undefined;

  // These ones are non-null asserted because we should have them by the time we animate
  _defaultParentState!: { final?: Snapshot; initial?: Snapshot }; // This is set by the AnimationParticipantManager
  _contextElementState!: {
    final: Snapshot;
    initial: Snapshot;
  };

  constructor(
    element: HTMLElement,
    metadata: { id: string; role: string | null },
    public _state: {
      final?: Snapshot;
      initial?: Snapshot;
    },
    type: SpriteType,
    public callbacks: {
      onAnimationStart(animation: Animation): void;
    },
  ) {
    this.element = element;
    this.identifier = new SpriteIdentifier(metadata.id, metadata.role);
    this.type = type;
    this.time = new Date().getTime();
  }

  // TODO: when a sprite is placed within a context
  // AND it's Removed
  // AND it animates, we should move the DOMRef under the context's DOMRef
  // Also when it clones, this is a more specific case
  within(animator: Animator) {
    // An Animator ALWAYS has initial and final Snapshots
    // Otherwise it should not be eligible to animate (check definition of context.isStable)
    assert(
      'Animator always has initial and final Snapshots',
      animator._state.initial && animator._state.final,
    );

    this._contextElementState = animator._state;
    if (this.counterpart) {
      this.counterpart._contextElementState = animator._state;
    }
  }

  get initialBounds(): ContextAwareBounds | undefined {
    if (this._state.initial) {
      if (!this._defaultParentState?.initial) {
        throw new Error('Unexpected missing default parent initial bounds');
      }

      return new ContextAwareBounds({
        element: this._state.initial.bounds,
        parent: this._defaultParentState.initial.bounds,
        contextElement: this._contextElementState.initial.bounds,
      });
    } else {
      return undefined;
    }
  }

  get initialComputedStyle(): CopiedCSS | undefined {
    return this._state.initial?.styles;
  }

  get finalBounds(): ContextAwareBounds | undefined {
    if (this._state.final) {
      if (!this._defaultParentState?.final) {
        throw new Error('Unexpected missing default parent final bounds');
      }

      return new ContextAwareBounds({
        element: this._state.final.bounds,
        parent: this._defaultParentState.final.bounds,
        contextElement: this._contextElementState.final.bounds,
      });
    } else {
      return undefined;
    }
  }

  get finalComputedStyle(): CopiedCSS | undefined {
    return this._state.final?.styles;
  }

  get id(): string | null {
    return this.identifier.id;
  }
  get role(): string | null {
    return this.identifier.role;
  }

  get initialWidth(): number | undefined {
    return this.initialBounds?.element.width;
  }

  get initialHeight(): number | undefined {
    return this.initialBounds?.element.height;
  }

  get finalHeight(): number | undefined {
    return this.finalBounds?.element.height;
  }

  get finalWidth(): number | undefined {
    return this.finalBounds?.element.width;
  }

  get boundsDelta(): BoundsDelta | undefined {
    if (!this.initialBounds || !this.finalBounds) {
      return undefined;
    }
    let initialBounds = this.initialBounds.relativeToParent;
    let finalBounds = this.finalBounds.relativeToParent;
    return {
      x: finalBounds.left - initialBounds.left,
      y: finalBounds.top - initialBounds.top,
      width: finalBounds.width - initialBounds.width,
      height: finalBounds.height - initialBounds.height,
    };
  }

  get initial(): { [k in string]: Value } {
    let initialBounds = {};
    let boundsRect: DOMRect;
    if (this.initialBounds) {
      if (this.type == SpriteType.Removed) {
        // because removed sprites are moved to the orphans container under the AnimationContext
        boundsRect = this.initialBounds.relativeToContext;
      } else {
        boundsRect = this.initialBounds.relativeToParent;
      }

      initialBounds = {
        // TODO: maybe also for top/left?
        // TODO: figure out if we want the boundsDelta to be under these properties
        'translate-x': `${-(this.boundsDelta?.x ?? 0)}px`,
        'translate-y': `${-(this.boundsDelta?.y ?? 0)}px`,

        x: `${boundsRect.x}px`,
        y: `${boundsRect.y}px`,
        width: `${boundsRect.width}px`,
        height: `${boundsRect.height}px`,
        top: `${boundsRect.top}px`,
        right: `${boundsRect.right}px`,
        bottom: `${boundsRect.bottom}px`,
        left: `${boundsRect.left}px`,
      };
    }

    return {
      ...this.initialComputedStyle,
      ...initialBounds,
    };
  }

  get final(): { [k in string]: Value } {
    let finalBounds = {};
    if (this.finalBounds) {
      let { x, y, width, height, top, right, bottom, left } =
        this.finalBounds.relativeToParent;

      finalBounds = {
        // TODO: maybe also for top/left?
        // TODO: figure out if we want the boundsDelta to be under these properties
        'translate-x': `${0}px`,
        'translate-y': `${0}px`,

        x: `${x}px`,
        y: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        top: `${top}px`,
        right: `${right}px`,
        bottom: `${bottom}px`,
        left: `${left}px`,
      };
    }

    return {
      ...this.finalComputedStyle,
      ...finalBounds,
    };
  }

  /*  get canBeGarbageCollected(): boolean {
    return this.type === SpriteType.Removed && this.hidden;
  }*/

  lockStyles(bounds: Bounds | null = null): void {
    if (!bounds) {
      if (this.initialBounds) {
        bounds = this.initialBounds.relativeToContext;
      } else {
        bounds = { left: 0, top: 0, width: 0, height: 0 };
      }
    }
    this.element.style.position = 'absolute';
    this.element.style.left = bounds.left + 'px';
    this.element.style.top = bounds.top + 'px';
    if (bounds.width) {
      this.element.style.width = bounds.width + 'px';
    }
    if (bounds.height) {
      this.element.style.height = bounds.height + 'px';
    }
  }

  unlockStyles(): void {
    this.element.style.removeProperty('position');
    this.element.style.removeProperty('left');
    this.element.style.removeProperty('top');
    this.element.style.removeProperty('width');
    this.element.style.removeProperty('height');
    this.element.style.removeProperty('opacity');
  }

  // hidden things get dropped at interruption
  /*  hide(): void {
    this.hidden = true;
    this.element.style.opacity = '0';
    this.element.setAttribute('data-sprite-hidden', 'true');
    this.element.getAnimations().forEach((a) => a.cancel());
  }*/
}

export enum SpriteType {
  Inserted = 'inserted',
  Intermediate = 'intermediate',
  Kept = 'kept',
  Removed = 'removed',
}
