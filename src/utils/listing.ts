import { fsp, path } from './node';
import { FolderEntry, ListOptions, sortEntries } from './sort';

export type { FolderEntry, ListOptions };

export type FolderState =
	| { kind: 'ok'; entries: FolderEntry[] }
	| { kind: 'missing' }
	| { kind: 'not-a-folder' }
	| { kind: 'error'; message: string };

/** Read one folder level. Never throws; reports a state instead. */
export async function readFolder(folder: string, opts: ListOptions): Promise<FolderState> {
	try {
		const stat = await fsp.stat(folder);
		if (!stat.isDirectory()) return { kind: 'not-a-folder' };
	} catch (err) {
		const code = errnoCode(err);
		if (code === 'ENOENT' || code === 'ENOTDIR') return { kind: 'missing' };
		return { kind: 'error', message: errorMessage(err) };
	}
	try {
		const dirents = await fsp.readdir(folder, { withFileTypes: true });
		const entries: FolderEntry[] = [];
		for (const d of dirents) {
			const fullPath = path.join(folder, d.name);
			let isDirectory = d.isDirectory();
			if (d.isSymbolicLink()) {
				try {
					isDirectory = (await fsp.stat(fullPath)).isDirectory();
				} catch {
					isDirectory = false; // broken link: show as a file
				}
			}
			entries.push({ name: d.name, fullPath, isDirectory });
		}
		return { kind: 'ok', entries: sortEntries(entries, opts) };
	} catch (err) {
		return { kind: 'error', message: errorMessage(err) };
	}
}

function errnoCode(err: unknown): string | undefined {
	if (typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string') {
		return err.code;
	}
	return undefined;
}

function errorMessage(err: unknown): string {
	const code = errnoCode(err);
	if (code === 'EACCES' || code === 'EPERM') return 'Permission denied.';
	if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') {
		return err.message;
	}
	return String(err);
}
