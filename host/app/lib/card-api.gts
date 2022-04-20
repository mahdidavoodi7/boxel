import GlimmerComponent from '@glimmer/component';
import { ComponentLike } from '@glint/template';

export const primitive = Symbol('cardstack-primitive');
const isField = Symbol('cardstack-field');

type CardInstanceType<T extends Constructable> = T extends { [primitive]: infer P } ? P : InstanceType<T>;

type FieldsTypeFor<CardT extends Constructable> = {
  [Field in keyof InstanceType<CardT>]: (new() => GlimmerComponent<{ Args: {}, Blocks: {} }>) & FieldsTypeFor<InstanceType<CardT>[Field]>;
}

export type Format = 'isolated' | 'embedded' | 'edit';

export function contains<CardT extends Constructable>(card: CardT): CardInstanceType<CardT> {
  if (primitive in card) {
    return {
      setupField() {
        let bucket = new WeakMap();
        let get = function(this: InstanceType<CardT>) { 
          return bucket.get(this); 
        };
        (get as any)[isField] = card;
        return {
          enumerable: true,
          get,
          set(value: any) {
            bucket.set(this, value);
          }
        };
      }
    } as any;
  } else {
    return {
      setupField() {
        let instance = new card();
        let get = function(this: InstanceType<CardT>) { return instance };
        (get as any)[isField] = card;
        return {
          enumerable: true,
          get,
          set(value: any) {
            Object.assign(instance, value);
          }
        };
      }
    } as any
  }
}

// our decorators are implemented by Babel, not TypeScript, so they have a
// different signature than Typescript thinks they do.
export const field = function(_target: object, _key: string| symbol, { initializer }: { initializer(): any }) {
  return initializer().setupField();
} as unknown as PropertyDecorator;

export type Constructable = new(...args: any) => any;

type SignatureFor<CardT extends Constructable> = { Args: { model: CardInstanceType<CardT>; fields: FieldsTypeFor<CardT> } }

export class Component<CardT extends Constructable> extends GlimmerComponent<SignatureFor<CardT>> {

}

class DefaultIsolated extends GlimmerComponent<{ Args: { fields: Record<string, new() => GlimmerComponent>}}> {
  <template>
    {{#each-in @fields as |_key Field|}}
      <Field />
    {{/each-in}}
  </template>;
}
const defaultComponent = {
  embedded: <template><!-- Inherited from base card embedded view. Did your card forget to specify its embedded component? --></template>,
  isolated: DefaultIsolated,
  edit: <template></template>
}

function defaultFieldFormat(format: Format): Format {
  switch (format) {
    case 'edit':
      return 'edit';
    case 'isolated':
    case 'embedded':
      return 'embedded';
  }
}

function getComponent<CardT extends Constructable>(card: CardT, format: Format, model: InstanceType<CardT>): ComponentLike<{ Args: never, Blocks: never }> {
  let Implementation = (card as any)[format] ?? defaultComponent[format];

  // *inside* our own component, @fields is a proxy object that looks 
  // up our fields on demand. 
  let internalFields = fieldsComponentsFor({}, model, defaultFieldFormat(format));
  let component = <template>
    <Implementation @model={{model}} @fields={{internalFields}}/>
  </template>

  // when viewed from *outside*, our component is both an invokable component 
  // and a proxy that makes our fields available for nested invocation, like
  // <@fields.us.deeper />.
  //
  // It would be possible to use `externalFields` in place of `internalFields` above, 
  // avoiding the need for two separate Proxies. But that has the uncanny property of 
  // making `<@fields />` be an infinite recursion.
  let externalFields = fieldsComponentsFor(component, model, defaultFieldFormat(format));

  // This cast is safe because we're returning a proxy that wraps component.
  return externalFields as unknown as typeof component;
}

function getInitialData(card: Constructable): Record<string, any> | undefined {
  return (card as any).data;
}

export async function prepareToRender<CardT extends Constructable>(card: CardT, format: Format): Promise<{ component: ComponentLike<{ Args: never, Blocks: never }> }> {
  let model = new card();
  let data = getInitialData(card);
  if (data) {
    Object.assign(model, data);
  }
  let component = getComponent(card, format, model);
  return { component };
}

function getField<CardT extends Constructable>(card: CardT, fieldName: string): Constructable | undefined {
  let obj = card.prototype;
  while (obj) {
    let desc = Reflect.getOwnPropertyDescriptor(obj, fieldName);
    let fieldCard = (desc?.get as any)?.[isField];
    if (fieldCard) {
      return fieldCard;
    }
    obj = Reflect.getPrototypeOf(obj);
  }
  return undefined
}

function fieldsComponentsFor<CardT extends Constructable>(target: object, model: InstanceType<CardT>, defaultFormat: Format): FieldsTypeFor<CardT> {
  return new Proxy(target, {
    get(target, property, received) {
      if (typeof property === 'symbol') {
        // don't handle symbols
        return Reflect.get(target, property, received);
      }
      let field = getField(model.constructor, property);
      if (!field) {
        // field doesn't exist, fall back to normal property access behavior
        return Reflect.get(target, property, received);
      }
      // found field: get the corresponding component
      let innerModel = model[property];
      return getComponent(field, defaultFormat, innerModel);
    },
    getPrototypeOf() {
      // This is necessary for Ember to be able to locate the template associated 
      // with a proxied component. Our Proxy object won't be in the template WeakMap,
      // but we can pretend our Proxy object inherits from the true component, and
      // Ember's template lookup respects inheritance.
      return target;
    },
    ownKeys(target)  {
      let keys = Reflect.ownKeys(target);
      for (let name in model) {
        let field = getField(model.constructor, name);
        if (field) {
          keys.push(name);
        }
      }
      return keys;
    },
    getOwnPropertyDescriptor(target, property) {
      if (typeof property === 'symbol') {
        // don't handle symbols
        return Reflect.getOwnPropertyDescriptor(target, property);
      }
      let field = getField(model.constructor, property);
      if (!field) {
        // field doesn't exist, fall back to normal property access behavior
        return Reflect.getOwnPropertyDescriptor(target, property);
      }
      // found field: fields are enumerable properties
      return {
        enumerable: true,
        writable: true,
        configurable: true,
      }
    }

  }) as any;
}