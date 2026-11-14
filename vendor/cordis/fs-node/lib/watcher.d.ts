import { Watcher } from '@cordisjs/fs';
/** Serves `watcher` at `filename` through chokidar, and returns a function that stops it. */
export declare function watchPath(watcher: Watcher, filename: string): () => Promise<void>;
