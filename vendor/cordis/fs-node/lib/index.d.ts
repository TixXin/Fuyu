import { BaseFs, Watcher } from '@cordisjs/fs';
/** The local file system of Node.js. */
declare class NodeFs extends BaseFs {
    static mount: string;
    watch(watcher: Watcher): () => Promise<void>;
}
export default NodeFs;
