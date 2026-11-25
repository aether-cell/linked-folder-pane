/**
 * Narrow typings for the Node builtins this plugin actually uses.
 *
 * The community scanner's type-aware ESLint pass often fails to resolve
 * `@types/node`. Imports from `fs` / `os` / `path` then become TypeScript's
 * `error` type (which acts as `any`), and the scorecard fills with
 * `no-unsafe-*` and `no-redundant-type-constituents` warnings. Casting
 * once through `unknown` onto these interfaces keeps those rules clean
 * whether or not `@types/node` is visible.
 */
import * as fsMod from 'fs';
import * as osMod from 'os';
import * as pathMod from 'path';
import type { PathApi } from './paths';

export interface Stats {
	isDirectory(): boolean;
}

export interface Dirent {
	name: string;
	isDirectory(): boolean;
	isSymbolicLink(): boolean;
}

export interface FSWatcher {
	close(): void;
	on(event: 'error', listener: () => void): unknown;
}

interface FsApi {
	existsSync(path: string): boolean;
	statSync(path: string): Stats;
	watch(path: string, options: { persistent: boolean }, listener: () => void): FSWatcher;
	promises: {
		stat(path: string): Promise<Stats>;
		readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
	};
}

interface OsApi {
	homedir(): string;
}

function narrow<T>(value: unknown): T {
	return value as T;
}

const fs = narrow<FsApi>(fsMod);
const os = narrow<OsApi>(osMod);

export const existsSync = (path: string): boolean => fs.existsSync(path);
export const statSync = (path: string): Stats => fs.statSync(path);
export const watch = (
	path: string,
	options: { persistent: boolean },
	listener: () => void,
): FSWatcher => fs.watch(path, options, listener);
export const fsp = fs.promises;
export const homedir = (): string => os.homedir();
export const path = narrow<PathApi>(pathMod);
