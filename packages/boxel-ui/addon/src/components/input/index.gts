import { concat } from '@ember/helper';
import { on } from '@ember/modifier';
import { guidFor } from '@ember/object/internals';
import Component from '@glimmer/component';

import cn from '../../helpers/cn.ts';
import element from '../../helpers/element.ts';
import optional from '../../helpers/optional.ts';
import pick from '../../helpers/pick.ts';
import { and, bool, not } from '../../helpers/truth-helpers.ts';

export interface Signature {
  Args: {
    disabled?: boolean;
    errorMessage?: string;
    helperText?: string;
    id?: string;
    invalid?: boolean;
    multiline?: boolean;
    onBlur?: (ev: Event) => void;
    onFocus?: (ev: Event) => void;
    onInput?: (val: string) => void;
    onKeyPress?: (ev: KeyboardEvent) => void;
    optional?: boolean;
    placeholder?: string;
    required?: boolean;
    value: string | number | null | undefined;
  };
  Element: HTMLInputElement | HTMLTextAreaElement;
}

export default class BoxelInput extends Component<Signature> {
  helperId = guidFor(this);
  get id() {
    return this.args.id || this.helperId;
  }

  <template>
    {{#if (and (not @required) @optional)}}
      <div class='optional'>Optional</div>
    {{/if}}
    {{#let (and @invalid (bool @errorMessage)) as |shouldShowErrorMessage|}}
      {{#let (element (if @multiline 'textarea' 'input')) as |InputTag|}}
        <InputTag
          class={{cn 'boxel-input' invalid=@invalid}}
          id={{this.id}}
          value={{@value}}
          placeholder={{@placeholder}}
          required={{@required}}
          disabled={{@disabled}}
          aria-describedby={{if
            @helperText
            (concat 'helper-text-' this.helperId)
            false
          }}
          aria-invalid={{if @invalid 'true'}}
          aria-errormessage={{if
            shouldShowErrorMessage
            (concat 'error-message-' this.helperId)
            false
          }}
          data-test-boxel-input
          data-test-boxel-input-id={{@id}}
          {{on 'input' (pick 'target.value' (optional @onInput))}}
          {{on 'blur' (optional @onBlur)}}
          {{on 'keypress' (optional @onKeyPress)}}
          {{on 'focus' (optional @onFocus)}}
          ...attributes
        />
        {{#if shouldShowErrorMessage}}
          <div
            id={{concat 'error-message-' this.helperId}}
            class='error-message'
            aria-live='polite'
            data-test-boxel-input-error-message
          >{{@errorMessage}}</div>
        {{/if}}
        {{#if @helperText}}
          <div
            id={{concat 'helper-text-' this.helperId}}
            class='helper-text'
            data-test-boxel-input-helper-text
          >{{@helperText}}</div>
        {{/if}}
      {{/let}}
    {{/let}}
    <style>
      @layer {
        .boxel-input {
          --boxel-input-height: var(--boxel-form-control-height);

          box-sizing: border-box;
          width: 100%;
          min-height: var(--boxel-input-height);
          padding: var(--boxel-sp-xs) 0 var(--boxel-sp-xs) var(--boxel-sp-sm);
          border: 1px solid var(--boxel-form-control-border-color);
          border-radius: var(--boxel-form-control-border-radius);
          font: var(--boxel-font-sm);
          font-weight: 400;
          letter-spacing: var(--boxel-lsp-xs);
          transition: border-color var(--boxel-transition);
        }

        .boxel-text-area {
          --boxel-input-height: 10rem;
        }

        .boxel-input:disabled {
          background-color: var(--boxel-light);
          border-color: var(--boxel-purple-300);
          color: rgb(0 0 0 / 50%);
          opacity: 0.5;
        }

        .boxel-input:hover:not(:disabled) {
          border-color: var(--boxel-dark);
        }

        .invalid {
          border-color: var(--boxel-error-100);
          box-shadow: 0 0 0 1px var(--boxel-error-100);
        }

        .invalid:focus {
          outline: 1px solid transparent; /* Make sure that we make the invalid state visible */
          box-shadow: 0 0 0 1.5px var(--boxel-error-100);
        }

        .invalid:hover:not(:disabled) {
          border-color: var(--boxel-error-100);
        }

        .optional {
          grid-row: 1;
          grid-column: 1 / -1;
          margin-bottom: var(--boxel-sp-xxxs);
          color: rgb(0 0 0 / 75%);
          font: var(--boxel-font-sm);
          font-style: oblique;
          letter-spacing: var(--boxel-lsp);
          text-align: right;
        }

        .error-message {
          grid-column: 2;
          margin-top: var(--boxel-sp-xxxs);
          margin-left: var(--boxel-sp-xxxs);
          color: var(--boxel-error-200);
          font: 500 var(--boxel-font-sm);
          letter-spacing: var(--boxel-lsp);
        }

        .helper-text {
          grid-column: 2;
          margin-top: var(--boxel-sp-xs);
          margin-left: var(--boxel-sp-xs);
          color: rgb(0 0 0 / 75%);
          font: var(--boxel-font-sm);
          letter-spacing: var(--boxel-lsp);
        }

        /* Combine these when this is fixed: https://github.com/cardstack/glimmer-scoped-css/pull/11 */
        .boxel-input:disabled ~ .error-message {
          display: none;
        }

        .boxel-input:disabled ~ .helper-text {
          display: none;
        }

        .boxel-input::placeholder {
          color: var(--boxel-light);
          opacity: 0.6;
        }
      }
    </style>
  </template>
}