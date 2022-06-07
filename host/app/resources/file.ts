import { Resource, TaskInstance, useResource } from 'ember-resources';
import { tracked } from '@glimmer/tracking';
import { restartableTask } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { registerDestructor } from '@ember/destroyable';
import { traverse } from '@cardstack/runtime-common';

interface Args {
  named: {
    path: string | undefined;
    handle: FileSystemDirectoryHandle | undefined;
  };
}

export type FileResource =
  | {
      state: 'not-ready';
      loading: TaskInstance<void> | null;
    }
  | {
      state: 'not-found';
      path: string;
      loading: TaskInstance<void> | null;
    }
  | {
      state: 'ready';
      content: string;
      name: string;
      path: string;
      loading: TaskInstance<void> | null;
      write(content: string): void;
    };

class _FileResource extends Resource<Args> {
  private handle: FileSystemFileHandle | undefined;
  private lastModified: number | undefined;
  private interval: ReturnType<typeof setInterval>;
  private _path: string | undefined;
  @tracked content: string | undefined;
  @tracked state = 'not-ready';

  constructor(owner: unknown, args: Args) {
    super(owner, args);
    taskFor(this.read).perform(args.named.path, args.named.handle);
    this.interval = setInterval(
      () => taskFor(this.read).perform(args.named.path, args.named.handle),
      1000
    );
    registerDestructor(this, () => clearInterval(this.interval));
  }

  get path() {
    return this._path;
  }

  get name() {
    return this.handle?.name;
  }

  get loading() {
    return taskFor(this.read).last;
  }

  @restartableTask private async read(
    path: string | undefined,
    dirHandle: FileSystemDirectoryHandle | undefined
  ) {
    if (path && dirHandle) {
      this._path = path;
      let handle: FileSystemFileHandle | undefined;
      try {
        let { handle: subdir, filename } = await traverse(dirHandle, path);
        handle = await subdir.getFileHandle(filename);
      } catch (err: unknown) {
        clearInterval(this.interval);
        if ((err as DOMException).name !== 'NotFoundError') {
          throw err;
        }
        console.log(`can't find file ${path} from the local realm`);
        this.state = 'not-found';
        return;
      }

      this.handle = handle;
      let file = await this.handle.getFile();
      if (file.lastModified === this.lastModified) {
        return;
      }
      this.lastModified = file.lastModified;
      let reader = new FileReader();
      this.content = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
      this.state = 'ready';
    } else {
      this.content = undefined;
      this.state = 'not-ready';
    }
  }

  async write(content: string) {
    taskFor(this.doWrite).perform(content);
  }

  @restartableTask private async doWrite(content: string) {
    if (!this.handle) {
      throw new Error(`can't write to not ready FileResource`);
    }
    // TypeScript seems to lack types for the writable stream features
    let stream = await (this.handle as any).createWritable();
    await stream.write(content);
    await stream.close();
  }
}

export function file(
  parent: object,
  path: () => string | undefined,
  handle: () => FileSystemDirectoryHandle | undefined
): FileResource {
  return useResource(parent, _FileResource, () => ({
    named: { path: path(), handle: handle() },
  })) as FileResource;
}
