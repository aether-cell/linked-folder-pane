/**
 * Pure helpers for turning a frontmatter value into an absolute folder path.
 * No Obsidian or filesystem access here, so it can be unit tested in Node.
 */

export interface PathApi {
	isAbsolute(p: string): boolean;
	resolve(...segments: string[]): string;
	relative(from: string, to: string): string;
	join(...segments: string[]): string;
	sep: string;
}

export interface ResolveContext {
	/** Absolute path of the vault root on disk. */
	vaultRoot: string;
	/** Absolute path of the user's home directory, used for `~`. */
	homeDir: string;
	/** Platform path implementation (node:path, or path.win32/path.posix in tests). */
	path: PathApi;
}

/**
 * Extract a usable string from a raw frontmatter value.
 * Accepts a string or a list (first non-empty string wins), strips surrounding
 * quotes and whitespace. Returns null if nothing usable is found.
 */
export function readFolderValue(raw: unknown): string | null {
	if (Array.isArray(raw)) {
		for (const item of raw) {
			const v = readFolderValue(item);
			if (v) return v;
		}
		return null;
	}
	if (typeof raw !== 'string') return null;
	let v = raw.trim();
	if (v.length >= 2) {
		const first = v[0];
		const last = v[v.length - 1];
		if ((first === '"' || first === "'" || first === '<') && last === (first === '<' ? '>' : first)) {
			v = v.slice(1, -1).trim();
		}
	}
	return v.length > 0 ? v : null;
}

/** Decode a `file://` URL into a local path. Returns the input unchanged otherwise. */
export function fromFileUrl(value: string): string {
	if (!/^file:\/\//i.test(value)) return value;
	let rest = value.replace(/^file:\/\//i, '');
	// file://localhost/path
	if (rest.toLowerCase().startsWith('localhost/')) rest = rest.slice('localhost'.length);
	try {
		rest = decodeURIComponent(rest);
	} catch {
		// keep undecoded
	}
	// file:///C:/Users -> C:/Users
	if (/^\/[A-Za-z]:[/\\]/.test(rest)) rest = rest.slice(1);
	// file://server/share -> \\server\share style (UNC), keep as //server/share
	else if (!rest.startsWith('/')) rest = '//' + rest;
	return rest;
}

/**
 * Resolve a raw frontmatter value to an absolute folder path.
 *
 * - Absolute paths are used as-is (normalized).
 * - `~` or `~/...` is expanded to the home directory.
 * - `file://` URLs are decoded.
 * - Anything else is resolved relative to the vault root.
 *
 * Returns null when the value is empty or not a string.
 */
export function resolveLinkedFolder(raw: unknown, ctx: ResolveContext): string | null {
	const value = readFolderValue(raw);
	if (!value) return null;
	const p = ctx.path;
	let v = fromFileUrl(value);

	if (v === '~') return p.resolve(ctx.homeDir);
	if (v.startsWith('~/') || v.startsWith('~\\')) {
		return p.resolve(ctx.homeDir, v.slice(2));
	}
	if (p.isAbsolute(v)) return p.resolve(v);
	return p.resolve(ctx.vaultRoot, v);
}

/**
 * Convert an absolute folder path into the value to store in frontmatter.
 * Folders inside the vault are stored relative to the vault root (portable
 * across machines); everything else is stored as an absolute path.
 * Forward slashes are used for vault-relative values.
 */
export function toStoredValue(absFolder: string, ctx: ResolveContext): string {
	const p = ctx.path;
	const abs = p.resolve(absFolder);
	const root = p.resolve(ctx.vaultRoot);
	const rel = p.relative(root, abs);
	if (rel === '') return '.';
	const escapes = rel === '..' || rel.startsWith('..' + p.sep) || p.isAbsolute(rel);
	if (escapes) return abs;
	return rel.split(p.sep).join('/');
}

/** True if `child` is the same as or inside `parent`. */
export function isInside(parent: string, child: string, p: PathApi): boolean {
	const rel = p.relative(p.resolve(parent), p.resolve(child));
	return rel === '' || (!rel.startsWith('..') && !p.isAbsolute(rel));
}
