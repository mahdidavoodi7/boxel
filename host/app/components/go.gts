import { on } from '@ember/modifier';
import Component from '@glint/environment-ember-loose/glimmer-component';
import { action } from '@ember/object';
import monaco from '../modifiers/monaco';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import * as monacoEditor from 'monaco-editor';
import LocalRealm from '../services/local-realm';
import { directory, Entry } from '../resources/directory';
import { file } from '../resources/file';
import Preview from './preview';

function getEditorLanguage(fileName: string) {
  const languages = monacoEditor.languages.getLanguages();
  let extension = '.' + fileName.split('.').pop();
  let language = languages.find(lang => {
    if (!lang.extensions || lang.extensions.length === 0) {
      return;
    }
    return lang.extensions.find(ext => ext === extension ? lang : null);
  });

  if (!language) {
    return 'plaintext';
  }
  return language.id;
}

function isRunnable(filename: string): boolean {
  return ['.gjs', '.js', '.gts', '.ts'].some(extension => filename.endsWith(extension));
}

function eq<T>(a: T, b: T, _namedArgs: unknown): boolean {
  return a === b;
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    Go: typeof Go;
   }
}

export default class Go extends Component {
  <template>
    <div class="editor">
      <div class="file-tree">
        {{#if this.localRealm.isAvailable}}
          <button {{on "click" this.closeRealm}}>Close local realm</button>
          {{#each this.listing.entries as |entry|}}
            {{#if (eq entry.handle.kind 'file')}}
              <div class="item file indent-{{entry.indent}}"
                   {{on "click" (fn this.open entry)}}>
                {{entry.name}}
              </div>
            {{else}}
              <div class="item directory indent-{{entry.indent}}">
                {{entry.name}}/
              </div>
            {{/if}}
          {{/each}}
        {{else if this.localRealm.isLoading }}
          ...
        {{else if this.localRealm.isEmpty}}
          <button {{on "click" this.openRealm}}>Open a local realm</button>
        {{/if}}
      </div>
      {{#if this.openFile.ready}}
        <div {{monaco content=this.openFile.content
                      language=(getEditorLanguage this.openFile.name)
                      contentChanged=this.contentChanged}}></div>
        <div>
          {{#if (isRunnable this.openFile.name)}}
            <Preview @filename={{this.openFile.name}} />
          {{/if}}
        </div>
      {{/if}}              
    </div>
  </template>

  @service declare localRealm: LocalRealm;
  @tracked selectedFile: Entry | undefined;

  @action
  openRealm() {
    this.localRealm.chooseDirectory();
  }

  @action
  closeRealm() {
    if (this.localRealm.isAvailable) {
      this.localRealm.close();
      this.selectedFile = undefined;
    }
  }

  @action
  open(handle: Entry) {
    this.selectedFile = handle;
  }

  @action
  contentChanged(content: string) {
    if (this.openFile.ready && content !== this.openFile.content) {
      this.openFile.write(content);
    }
  }

  listing = directory(this, () => this.localRealm.isAvailable ? this.localRealm.fsHandle : null)

  openFile = file(this, () => {
    if (this.selectedFile) {
      let { handle } = this.selectedFile;
      if (handle.kind !== 'file') {
        throw new Error(`Cannot open the directory ${handle.name} in monaco`);
      }
      return handle;
    }
    return undefined;
  });
}
