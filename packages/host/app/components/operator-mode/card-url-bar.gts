import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { BoxelInput } from '@cardstack/boxel-ui';
import { svgJar } from '@cardstack/boxel-ui/helpers/svg-jar';
import { action } from '@ember/object';
import { service } from '@ember/service';
import { trackedFunction } from 'ember-resources/util/function';
import type { CardDef } from 'https://cardstack.com/base/card-api';
import type CardService from '../../services/card-service';
import { cardTypeDisplayName } from '@cardstack/runtime-common';

interface Signature {
  Element: HTMLElement;
  Args: {
    url: URL;
    onEnterPressed: (url: URL) => void;
    card: CardDef | null;
    notFoundError: string | null;
    resetNotFoundError: () => void;
  };
}

export default class CardURLBar extends Component<Signature> {
  <template>
    <div
      id='card-url-bar'
      class={{this.cssClasses}}
      data-test-card-url-bar
      ...attributes
    >
      <div class='realm-info' data-test-card-url-bar-realm-info>
        <img src={{this.realmIcon}} />
        <span>in
          {{if this.realmName this.realmName 'Unknown Workspace'}}</span>
      </div>
      <div class='input'>
        {{svgJar 'icon-globe' width='22px' height='22px'}}
        <BoxelInput
          class='url-input'
          @value={{this.url}}
          @onInput={{this.onInput}}
          @onKeyPress={{this.onKeyPress}}
          @onFocus={{this.toggleFocus}}
          @onBlur={{this.toggleFocus}}
          data-test-card-url-bar-input
        />
      </div>
      {{#if this.showErrorMessage}}
        <div class='error-message' data-test-card-url-bar-error>
          <span>{{this.errorMessage}}</span>
        </div>
      {{/if}}
    </div>
    <style>
      .card-url-bar {
        display: flex;
        align-items: center;

        background: var(--boxel-purple-700);
        border-radius: var(--boxel-border-radius-xl);
        padding: var(--boxel-sp-xs) 0 var(--boxel-sp-xs) var(--boxel-sp-sm);

        width: 100%;
        position: relative;
      }
      .focused {
        outline: 2px solid var(--boxel-teal);
      }
      .error {
        outline: 2px solid red;
      }
      .realm-info {
        display: flex;
        align-items: center;
        gap: var(--boxel-sp-xs);

        width: max-content;
        color: var(--boxel-light);
        border-right: 2px solid var(--boxel-purple-300);
        padding-right: var(--boxel-sp-xs);
        margin-right: var(--boxel-sp-xs);

        white-space: nowrap;
      }
      .realm-info img {
        width: 22px;
      }
      .input {
        display: flex;
        align-items: center;
        gap: var(--boxel-sp-xs);
        width: 100%;

        --icon-color: var(--boxel-cyan);
      }
      .error .input {
        --icon-color: red;
      }
      .url-input {
        background: none;
        border: none;
        border-radius: 0;
        outline: none;
        padding: 0;
        min-height: 0;

        color: var(--boxel-light);
      }
      .error-message {
        position: absolute;
        bottom: calc(calc(var(--boxel-sp-xs) * 2) * -1);
        color: red;
      }
    </style>
  </template>

  @service declare cardService: CardService;
  @tracked url: string = this.args.url.toString();
  @tracked isFocused = false;
  @tracked isInvalidURL = false;

  get realmIcon() {
    return this.fetchRealmInfo.value?.iconURL;
  }

  get realmName() {
    return this.fetchRealmInfo.value?.name;
  }

  get cardDisplayName() {
    if (!this.args.card) return;
    return cardTypeDisplayName(this.args.card);
  }

  get showErrorMessage() {
    return this.isInvalidURL || this.args.notFoundError;
  }

  get errorMessage() {
    if (this.isInvalidURL) return 'Not a valid URL';
    else return this.args.notFoundError;
  }

  get cssClasses() {
    if (this.showErrorMessage) {
      return 'card-url-bar error';
    } else if (this.isFocused) {
      return 'card-url-bar focused';
    } else {
      return 'card-url-bar';
    }
  }

  fetchCard = trackedFunction(
    this,
    async () => await this.cardService.loadModel(this.args.url),
  );

  fetchRealmInfo = trackedFunction(this, async () => {
    if (!this.args.card) return;
    return this.cardService.getRealmInfo(this.args.card);
  });

  @action
  onInput(url: string) {
    this.url = url;
    this.isInvalidURL = false;
    this.args.resetNotFoundError();
  }

  @action
  onKeyPress(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;

    let url;
    try {
      url = new URL(this.url);
    } catch (e) {
      this.isInvalidURL = true;
    }

    if (url) this.args.onEnterPressed(url);
  }

  @action
  toggleFocus() {
    this.isFocused = !this.isFocused;
  }
}