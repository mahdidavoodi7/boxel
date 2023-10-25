import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { inject as service } from '@ember/service';

import { IconButton } from '@cardstack/boxel-ui/components';
import { Sparkle as SparkleIcon } from '@cardstack/boxel-ui/icons';

import type OperatorModeStateService from '../../services/operator-mode-state-service';

import type { CardDef } from 'https://cardstack.com/base/card-api';

import { assertNever } from '@cardstack/host/utils/assert-never';

// import DeleteModal from './delete-modal';
import SubmodeSwitcher, { Submode } from '../submode-switcher';
import ChatSidebar from '../matrix/chat-sidebar';
import CardCatalogModal from '../card-catalog/modal';

import ENV from '@cardstack/host/config/environment';

const { APP } = ENV;

interface Signature {
  Element: HTMLDivElement;
  Args: {};
  Blocks: {
    main: [];
    search: [];
  };
}

export default class SubmodeLayout extends Component<Signature> {
  @tracked private isChatVisible = false;
  // private deleteModal: DeleteModal | undefined;

  @service private declare operatorModeStateService: OperatorModeStateService;

  private get chatVisibilityClass() {
    return this.isChatVisible ? 'chat-open' : 'chat-closed';
  }

  private get allStackItems() {
    return this.operatorModeStateService.state?.stacks.flat() ?? [];
  }

  private get lastCardInRightMostStack(): CardDef | null {
    if (this.allStackItems.length <= 0) {
      return null;
    }

    return this.allStackItems[this.allStackItems.length - 1].card;
  }

  // private setupDeleteModal = (deleteModal: DeleteModal) => {
  //   this.deleteModal = deleteModal;
  // };

  @action private updateSubmode(submode: Submode) {
    switch (submode) {
      case Submode.Interact:
        this.operatorModeStateService.updateCodePath(null);
        break;
      case Submode.Code:
        let codePath = this.lastCardInRightMostStack
          ? new URL(this.lastCardInRightMostStack.id + '.json')
          : null;
        this.operatorModeStateService.updateCodePath(codePath);
        break;
      default:
        throw assertNever(submode);
    }

    this.operatorModeStateService.updateSubmode(submode);
  }

  @action
  private toggleChat() {
    this.isChatVisible = !this.isChatVisible;
  }

  <template>
    <CardCatalogModal />

    <div class='operator-mode__with-chat {{this.chatVisibilityClass}}'>
      <SubmodeSwitcher
        @submode={{this.operatorModeStateService.state.submode}}
        @onSubmodeSelect={{this.updateSubmode}}
        class='submode-switcher'
      />
      {{yield to='main'}}

      {{#if APP.experimentalAIEnabled}}
        {{#if this.isChatVisible}}
          <div class='container__chat-sidebar'>
            <ChatSidebar @onClose={{this.toggleChat}} />
          </div>
        {{else}}
          <IconButton
            data-test-open-chat
            class='chat-btn'
            @icon={{SparkleIcon}}
            @width='25'
            @height='25'
            {{on 'click' this.toggleChat}}
          />
        {{/if}}
      {{/if}}
    </div>
    {{yield to='search'}}
    <style>
      .operator-mode__with-chat {
        display: grid;
        grid-template-rows: 1fr;
        grid-template-columns: 1.5fr 0.5fr;
        gap: 0px;
        height: 100%;
      }

      .chat-open {
        grid-template-columns: 1.5fr 0.5fr;
      }

      .chat-closed {
        grid-template-columns: 1fr;
      }

      .chat-btn {
        --boxel-icon-button-width: var(--container-button-size);
        --boxel-icon-button-height: var(--container-button-size);
        --icon-color: var(--boxel-highlight-hover);

        position: absolute;
        bottom: var(--boxel-sp);
        right: var(--boxel-sp);
        margin-right: 0;
        padding: var(--boxel-sp-xxxs);
        border-radius: var(--boxel-border-radius);
        background-color: var(--boxel-dark);
        border: none;
        box-shadow: var(--boxel-deep-box-shadow);
        transition: background-color var(--boxel-transition);
        z-index: 1;
      }
      .chat-btn:hover {
        --icon-color: var(--boxel-dark);
        background-color: var(--boxel-highlight-hover);
      }

      .submode-switcher {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 2;
        padding: var(--boxel-sp);
      }

      .container__chat-sidebar {
        height: 100vh;
        grid-column: 2;
        z-index: 1;
      }
    </style>
  </template>
}
