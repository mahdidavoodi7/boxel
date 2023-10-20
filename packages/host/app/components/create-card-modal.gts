import { registerDestructor } from '@ember/destroyable';
import { fn } from '@ember/helper';
import { action } from '@ember/object';

import type Owner from '@ember/owner';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import { enqueueTask } from 'ember-concurrency';

import type {
  CodeRef,
  LooseSingleCardDocument,
} from '@cardstack/runtime-common';
import { Deferred } from '@cardstack/runtime-common/deferred';

import type { CardDef } from 'https://cardstack.com/base/card-api';

import CardEditor from './card-editor';
import ModalContainer from './modal-container';

import type CardService from '../services/card-service';

export default class CreateCardModal extends Component {
  <template>
    {{#let this.currentRequest.card as |card|}}
      {{#if card}}
        <ModalContainer
          @title='Create New Card'
          @onClose={{fn this.save undefined}}
          @zIndex={{this.zIndex}}
          data-test-create-new-card={{card.constructor.name}}
        >
          <:content>
            <CardEditor @card={{card}} @onSave={{this.save}} />
          </:content>
        </ModalContainer>
      {{/if}}
    {{/let}}
  </template>

  @service declare cardService: CardService;
  @tracked currentRequest:
    | {
        card: CardDef;
        deferred: Deferred<CardDef | undefined>;
      }
    | undefined = undefined;
  @tracked zIndex = 20;

  constructor(owner: Owner, args: {}) {
    super(owner, args);
    (globalThis as any)._CARDSTACK_CREATE_NEW_CARD = this;
    registerDestructor(this, () => {
      delete (globalThis as any)._CARDSTACK_CREATE_NEW_CARD;
    });
  }

  async create<T extends CardDef>(
    ref: CodeRef,
    relativeTo: URL | undefined,
    opts?: { 
      realmURL?: URL;
      doc?: LooseSingleCardDocument
    },
  ): Promise<undefined | T> {
    this.zIndex++;
    return (await this._create.perform(ref, relativeTo, opts)) as T | undefined;
  }

  private _create = enqueueTask(
    async <T extends CardDef>(
      ref: CodeRef,
      relativeTo: URL | undefined, // this relativeTo should be the catalog entry ID that the CodeRef comes from
      opts?: {
        doc?: LooseSingleCardDocument;
        realmURL?: URL;
      },
    ) => {
      if ('type' in ref ) {
        throw new Error('bug: can only create new cards from exported card definition');
      }
      // we make the code ref use an absolute URL for safety in
      // case it's being created in a different realm than where the card 
      // definition comes from
      ref.module = new URL(ref.module, relativeTo).href;
      let doc: LooseSingleCardDocument = opts?.doc ?? {
        data: {
          meta: {
            adoptsFrom: ref,
            ...(opts?.realmURL ? { realmURL: opts.realmURL.href} : {})
          }
        },
      };
      this.currentRequest = {
        card: await this.cardService.createFromSerialized(
          doc.data,
          doc,
          relativeTo
        ),
        deferred: new Deferred(),
      };
      let card = await this.currentRequest.deferred.promise;
      if (card) {
        return card as T;
      } else {
        return undefined;
      }
    },
  );

  @action save(card?: CardDef): void {
    if (this.currentRequest) {
      this.currentRequest.deferred.fulfill(card);
      this.currentRequest = undefined;
    }
  }
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    CreateCardModal: typeof CreateCardModal;
  }
}
