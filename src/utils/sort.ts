/** Pure listing helpers (no filesystem access), unit tested in Node. */

export interface FolderEntry {
	name: string;
	fullPath: string;
	isDirectory: boolean;
}

export interface ListOptions {
	showHidden: boolean;
	foldersFirst: boolean;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Filter and sort entries. Pure, so it can be unit tested. */
export function sortEntries(entries: FolderEntry[], opts: ListOptions): FolderEntry[] {
	return entries
		.filter((e) => opts.showHidden || !e.name.startsWith('.'))
		.sort((a, b) => {
			if (opts.foldersFirst && a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
			return collator.compare(a.name, b.name);
		});
}

