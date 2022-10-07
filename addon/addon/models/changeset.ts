import Sprite, {
  SpriteIdentifier,
  SpriteType,
} from 'animations-experiment/models/sprite';
import { assert } from '@ember/debug';
import SpriteTree, {
  IContext,
  GetDescendantNodesOptions,
  ISpriteModifier,
  SpriteTreeNode,
} from 'animations-experiment/models/sprite-tree';
import ContextAwareBounds from 'animations-experiment/models/context-aware-bounds';
import { IntermediateSprite } from 'animations-experiment/services/animations';

export type SpritesForArgs = {
  type?: SpriteType | undefined;
  role?: string | undefined;
  id?: string | undefined;
};

function union<T>(...sets: Set<T>[]): Set<T> {
  switch (sets.length) {
    case 0:
      return new Set();
    case 1:
      return new Set(sets[0]);
    default:
      // eslint-disable-next-line no-case-declarations
      let result = new Set<T>();
      for (let set of sets) {
        for (let item of set) {
          result.add(item);
        }
      }
      return result;
  }
}

export class Changeset {
  context: IContext;
  intent: string | undefined;
  insertedSprites: Set<Sprite> = new Set();
  removedSprites: Set<Sprite> = new Set();
  keptSprites: Set<Sprite> = new Set();

  constructor(context: IContext) {
    this.context = context;
  }

  get hasSprites() {
    return (
      this.insertedSprites.size ||
      this.removedSprites.size ||
      this.keptSprites.size
    );
  }

  spritesFor(criteria: SpritesForArgs): Set<Sprite> {
    assert(
      'expect spritesFor to be called with some criteria',
      criteria.type || criteria.role || criteria.id
    );
    let result;
    if (criteria.type) {
      switch (criteria.type) {
        case SpriteType.Inserted:
          result = new Set(this.insertedSprites);
          break;
        case SpriteType.Removed:
          result = new Set(this.removedSprites);
          break;
        case SpriteType.Kept:
          result = new Set(this.keptSprites);
          break;
      }
    }
    result =
      result ||
      union(this.keptSprites, this.insertedSprites, this.removedSprites);

    if (criteria.id) {
      for (let sprite of result) {
        if (sprite.id !== criteria.id) {
          result.delete(sprite);
        }
      }
    }
    if (criteria.role) {
      for (let sprite of result) {
        if (sprite.role !== criteria.role) {
          result.delete(sprite);
        }
      }
    }

    return result;
  }

  spriteFor(criteria: SpritesForArgs): Sprite | null {
    let set = this.spritesFor(criteria);
    if (set.size > 1) {
      throw new Error(
        `More than one sprite found matching criteria ${criteria}`
      );
    }
    if (set.size === 0) {
      return null;
    }
    return [...set][0] ?? null;
  }
}

export class ChangesetBuilder {
  contextToChangeset: WeakMap<IContext, Changeset> = new WeakMap();
  spriteTree: SpriteTree;

  constructor(
    spriteTree: SpriteTree,
    contexts: Set<IContext>,
    freshlyAdded: Set<ISpriteModifier>,
    freshlyRemoved: Set<ISpriteModifier>,
    intermediateSprites: Map<string, IntermediateSprite>
  ) {
    this.spriteTree = spriteTree;

    // Capture snapshots & lookup natural KeptSprites
    let naturalKept: Set<ISpriteModifier> = new Set();
    for (let context of contexts) {
      context.captureSnapshot();
      let contextNode = this.spriteTree.lookupNodeByElement(context.element);
      let contextChildren: ISpriteModifier[] = contextNode!
        .getSpriteDescendants()
        .filter((v) => !v.isRemoved)
        .map((c) => c.spriteModifier);

      for (let spriteModifier of contextChildren) {
        spriteModifier.captureSnapshot({
          withAnimations: false,
          playAnimations: false,
        });

        if (!freshlyAdded.has(spriteModifier)) {
          naturalKept.add(spriteModifier);
        }
      }
    }

    let unallocatedItems: {
      sprite: Sprite;
      highestLevelModifier: ISpriteModifier;
    }[] = this.createSprites(
      freshlyAdded,
      freshlyRemoved,
      naturalKept,
      intermediateSprites
    );

    for (let context of contexts) {
      if (context.isStable) {
        let changeset = new Changeset(context);

        let node = spriteTree.lookupNodeByElement(context.element);
        let contextDescendants = node!
          .getSpriteDescendants({ deep: true })
          .map((v) => v.spriteModifier);

        let _next = [];
        let itemsForContext: {
          sprite: Sprite;
          highestLevelModifier: ISpriteModifier;
        }[] = [];
        for (let item of unallocatedItems) {
          if (contextDescendants.includes(item.highestLevelModifier)) {
            itemsForContext.push(item);
          } else {
            _next.push(item);
          }
        }
        unallocatedItems = _next;

        for (let { highestLevelModifier, sprite } of itemsForContext) {
          this.setSpriteEnvironmentBounds(
            sprite,
            highestLevelModifier,
            context
          );
          this.addSpriteTo(changeset, sprite);
        }

        this.contextToChangeset.set(context, changeset);
      } else {
        // We already decided what contexts we're going to use for this render,
        // so we can mark new contexts for the next run.
        context.isInitialRenderCompleted = true;
      }
    }
  }

  createSprites(
    freshlyAdded: Set<ISpriteModifier>,
    freshlyRemoved: Set<ISpriteModifier>,
    naturalKept: Set<ISpriteModifier>,
    intermediateSprites: Map<string, IntermediateSprite>
  ) {
    let {
      spriteModifiers,
      spriteModifierToSpriteMap,
      spriteModifierToCounterpartModifierMap,
    } = this.classifySprites(
      freshlyAdded,
      freshlyRemoved,
      naturalKept,
      intermediateSprites
    );

    let unallocatedItems: {
      sprite: Sprite;
      highestLevelModifier: ISpriteModifier;
    }[] = [];
    for (let spriteModifier of spriteModifiers) {
      let sprite = spriteModifierToSpriteMap.get(spriteModifier) as Sprite;
      let counterpartModifier =
        spriteModifierToCounterpartModifierMap.get(spriteModifier);
      let intermediateSprite = intermediateSprites.get(
        sprite.identifier.toString()
      );

      this.setSpriteOwnBounds(
        sprite,
        spriteModifier,
        counterpartModifier,
        intermediateSprite
      );

      let highestLevelModifier = spriteModifier;
      if (counterpartModifier) {
        let ancestorsOfKeptSprite = this.spriteTree.lookupNodeByElement(
          spriteModifier.element
        )!.ancestors;
        let stableAncestorsOfKeptSprite = ancestorsOfKeptSprite.filter(
          (v) => v.contextModel?.isStable
        );
        let ancestorsOfCounterpartSprite =
          this.spriteTree.lookupRemovedNode(counterpartModifier)!.ancestors;
        let stableAncestorsOfCounterpartSprite =
          ancestorsOfCounterpartSprite?.filter((v) => v.contextModel?.isStable);

        let sharedContextNode = stableAncestorsOfKeptSprite?.find((v) =>
          stableAncestorsOfCounterpartSprite?.includes(v)
        );

        if (!sharedContextNode) {
          console.warn(
            `Non-natural kept sprite with id ${spriteModifier.id} will not animate because there is no shared animation context that encloses both it and its counterpart`
          );
          continue;
        }

        if (
          ancestorsOfCounterpartSprite?.length < ancestorsOfKeptSprite?.length
        ) {
          highestLevelModifier = counterpartModifier;
        }
      }

      unallocatedItems.push({ sprite, highestLevelModifier });
    }

    return unallocatedItems;
  }

  classifySprites(
    freshlyAdded: Set<ISpriteModifier>,
    freshlyRemoved: Set<ISpriteModifier>,
    naturalKept: Set<ISpriteModifier>,
    intermediateSprites: Map<string, IntermediateSprite>
  ) {
    let classifiedInsertedSpriteModifiers = new Set([...freshlyAdded]);
    let classifiedRemovedSpriteModifiers = new Set([...freshlyRemoved]);

    let spriteModifiers: Set<ISpriteModifier> = new Set();
    let spriteModifierToSpriteMap = new WeakMap<ISpriteModifier, Sprite>();
    let spriteModifierToCounterpartModifierMap = new Map<
      ISpriteModifier,
      ISpriteModifier
    >();

    // Classify non-natural KeptSprites
    for (let insertedSpriteModifier of classifiedInsertedSpriteModifiers) {
      // find a suitable RemovedSprite counterpart if any
      let removedSpriteModifiers = [...classifiedRemovedSpriteModifiers].filter(
        (removedSpriteModifier) =>
          new SpriteIdentifier(
            insertedSpriteModifier.id,
            insertedSpriteModifier.role
          ).equals(
            new SpriteIdentifier(
              removedSpriteModifier.id,
              removedSpriteModifier.role
            )
          )
      );

      assert(
        'Multiple matching removedSpriteModifiers found',
        removedSpriteModifiers.length < 2
      );

      let removedSpriteModifier = removedSpriteModifiers[0];
      if (removedSpriteModifier) {
        classifiedRemovedSpriteModifiers.delete(removedSpriteModifier);
      }

      let intermediateSprite = intermediateSprites.get(
        new SpriteIdentifier(
          insertedSpriteModifier.id,
          insertedSpriteModifier.role
        ).toString()
      );

      // a matching IntermediateSprite always wins from a RemovedSprite counterpart
      // as it is more up-to-date (mid-animation interruption).
      let counterpartSpriteModifier =
        intermediateSprite?.modifier ?? removedSpriteModifier;
      if (counterpartSpriteModifier) {
        classifiedInsertedSpriteModifiers.delete(insertedSpriteModifier);

        let keptSprite = new Sprite(
          insertedSpriteModifier.element as HTMLElement,
          insertedSpriteModifier.id,
          insertedSpriteModifier.role,
          SpriteType.Kept
        );
        keptSprite.counterpart = new Sprite(
          counterpartSpriteModifier.element as HTMLElement,
          counterpartSpriteModifier.id,
          counterpartSpriteModifier.role,
          SpriteType.Removed
        );

        spriteModifierToSpriteMap.set(insertedSpriteModifier, keptSprite);
        spriteModifierToCounterpartModifierMap.set(
          insertedSpriteModifier,
          counterpartSpriteModifier
        );
        spriteModifiers.add(insertedSpriteModifier);
      }
    }

    for (let insertedSpriteModifier of classifiedInsertedSpriteModifiers) {
      spriteModifiers.add(insertedSpriteModifier);
      spriteModifierToSpriteMap.set(
        insertedSpriteModifier,
        new Sprite(
          insertedSpriteModifier.element as HTMLElement,
          insertedSpriteModifier.id,
          insertedSpriteModifier.role,
          SpriteType.Inserted
        )
      );
    }

    for (let removedSpriteModifier of classifiedRemovedSpriteModifiers) {
      spriteModifiers.add(removedSpriteModifier);
      spriteModifierToSpriteMap.set(
        removedSpriteModifier,
        new Sprite(
          removedSpriteModifier.element as HTMLElement,
          removedSpriteModifier.id,
          removedSpriteModifier.role,
          SpriteType.Removed
        )
      );
    }

    for (let keptSpriteModifier of naturalKept) {
      assert(
        'Freshly changed sprite modifier has already been processed as a non-natural kept sprite',
        !spriteModifierToCounterpartModifierMap.has(keptSpriteModifier)
      );
      spriteModifiers.add(keptSpriteModifier);
      spriteModifierToSpriteMap.set(
        keptSpriteModifier,
        new Sprite(
          keptSpriteModifier.element as HTMLElement,
          keptSpriteModifier.id,
          keptSpriteModifier.role,
          SpriteType.Kept
        )
      );
    }

    return {
      spriteModifiers,
      spriteModifierToSpriteMap,
      spriteModifierToCounterpartModifierMap,
    };
  }

  setSpriteEnvironmentBounds(
    sprite: Sprite,
    spriteModifier: ISpriteModifier,
    context: IContext
  ) {
    let spriteNode =
      this.spriteTree.lookupNodeByElement(sprite.element) ??
      this.spriteTree.freshlyRemovedToNode.get(spriteModifier);
    let parentNode = spriteNode!.parent;
    let parent = parentNode.contextModel ?? parentNode.spriteModel!;

    assert(
      'Contexts should always be stable and have last and current bounds',
      context.lastBounds && context.currentBounds && context.isStable
    );

    sprite.within({
      parent: parent,
      contextElement: context,
    });
  }

  addSpriteTo(changeset: Changeset, sprite: Sprite) {
    if (sprite.type === SpriteType.Kept) {
      changeset.keptSprites.add(sprite);
    } else if (sprite.type === SpriteType.Inserted) {
      changeset.insertedSprites.add(sprite);
    } else if (sprite.type === SpriteType.Removed) {
      changeset.removedSprites.add(sprite);
    } else {
      throw new Error('Unexpected sprite type received in changeset');
    }
  }

  setSpriteOwnBounds(
    sprite: Sprite,
    spriteModifier: ISpriteModifier,
    counterpartModifier?: ISpriteModifier,
    intermediateSprite?: IntermediateSprite
  ): void {
    if (sprite.type === SpriteType.Kept) {
      assert(
        'kept sprite should have lastBounds and currentBounds',
        spriteModifier.lastBounds && spriteModifier.currentBounds
      );

      if (intermediateSprite) {
        // If an interruption happened we set the intermediate sprite's bounds as the starting point.
        sprite.initialBounds = new ContextAwareBounds({
          element: intermediateSprite.intermediateBounds,
        });
        sprite.initialComputedStyle = intermediateSprite.intermediateStyles;
      } else {
        sprite.initialBounds = new ContextAwareBounds({
          element: spriteModifier.lastBounds,
        });
        sprite.initialComputedStyle = spriteModifier.lastComputedStyle;
      }

      sprite.finalBounds = new ContextAwareBounds({
        element: spriteModifier.currentBounds,
      });
      sprite.finalComputedStyle = spriteModifier.currentComputedStyle;

      if (sprite.counterpart) {
        assert(
          'counterpart modifier should have been passed',
          counterpartModifier
        );
        assert(
          'kept sprite counterpart should have lastBounds and currentBounds',
          counterpartModifier.lastBounds && counterpartModifier.currentBounds
        );

        if (counterpartModifier) {
          if (intermediateSprite) {
            // If an interruption happened the counterpart starts at the same point as the sprite.
            sprite.counterpart.initialBounds = sprite.initialBounds;
            sprite.counterpart.initialComputedStyle =
              sprite.initialComputedStyle;
          } else {
            sprite.counterpart.initialBounds = new ContextAwareBounds({
              element: counterpartModifier.currentBounds,
            });
            sprite.counterpart.initialComputedStyle =
              counterpartModifier.lastComputedStyle;

            // If we have a counterpart the sprite should start there.
            sprite.initialBounds = sprite.counterpart.initialBounds;
            sprite.initialComputedStyle =
              sprite.counterpart.initialComputedStyle;
          }
          sprite.counterpart.finalBounds = sprite.finalBounds;
          sprite.counterpart.finalComputedStyle = sprite.finalComputedStyle;
        }
      }
    } else if (sprite.type === SpriteType.Inserted) {
      assert(
        'inserted sprite should have currentBounds',
        spriteModifier.currentBounds
      );
      assert(
        'there should not be an intermediate sprite for an inserted sprite',
        !intermediateSprite
      );

      sprite.finalBounds = new ContextAwareBounds({
        element: spriteModifier.currentBounds,
      });
      sprite.finalComputedStyle = spriteModifier.currentComputedStyle;
    } else if (sprite.type === SpriteType.Removed) {
      assert(
        'removed sprite should have currentBounds',
        spriteModifier.currentBounds
      );

      if (intermediateSprite) {
        sprite.initialBounds = new ContextAwareBounds({
          element: intermediateSprite.intermediateBounds,
        });
        sprite.initialComputedStyle = intermediateSprite.intermediateStyles;
      } else {
        sprite.initialBounds = new ContextAwareBounds({
          element: spriteModifier.currentBounds,
        });
        sprite.initialComputedStyle = spriteModifier.currentComputedStyle;
      }
    }
  }
}
