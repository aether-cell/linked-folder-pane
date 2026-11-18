import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fromFileUrl, isInside, readFolderValue, resolveLinkedFolder, toStoredValue } from '../src/utils/paths.ts';
import { sortEntries } from '../src/utils/sort.ts';

const posix = { vaultRoot: '/home/u/vault', homeDir: '/home/u', path: path.posix };
const win = { vaultRoot: 'C:\\Users\\u\\vault', homeDir: 'C:\\Users\\u', path: path.win32 };

test('readFolderValue handles strings, quotes, lists and junk', () => {
	assert.equal(readFolderValue('  /a/b  '), '/a/b');
	assert.equal(readFolderValue('"/a b/c"'), '/a b/c');
	assert.equal(readFolderValue("'~/x'"), '~/x');
	assert.equal(readFolderValue('</a b>'), '/a b');
	assert.equal(readFolderValue(['', '/first', '/second']), '/first');
	assert.equal(readFolderValue(''), null);
	assert.equal(readFolderValue('   '), null);
	assert.equal(readFolderValue(42), null);
	assert.equal(readFolderValue(null), null);
	assert.equal(readFolderValue(undefined), null);
});

test('POSIX: absolute, home, vault-relative', () => {
	assert.equal(resolveLinkedFolder('/srv/projects/acme', posix), '/srv/projects/acme');
	assert.equal(resolveLinkedFolder('/srv/projects/acme/', posix), '/srv/projects/acme');
	assert.equal(resolveLinkedFolder('~', posix), '/home/u');
	assert.equal(resolveLinkedFolder('~/Documents/acme', posix), '/home/u/Documents/acme');
	assert.equal(resolveLinkedFolder('attachments/acme', posix), '/home/u/vault/attachments/acme');
	assert.equal(resolveLinkedFolder('../outside', posix), '/home/u/outside');
	assert.equal(resolveLinkedFolder('.', posix), '/home/u/vault');
	assert.equal(resolveLinkedFolder('', posix), null);
	assert.equal(resolveLinkedFolder(undefined, posix), null);
});

test('Windows: drive, UNC, home, vault-relative', () => {
	assert.equal(resolveLinkedFolder('D:\\Work\\Acme', win), 'D:\\Work\\Acme');
	assert.equal(resolveLinkedFolder('D:/Work/Acme', win), 'D:\\Work\\Acme');
	assert.equal(resolveLinkedFolder('\\\\server\\share\\acme', win), '\\\\server\\share\\acme');
	assert.equal(resolveLinkedFolder('~\\Documents', win), 'C:\\Users\\u\\Documents');
	assert.equal(resolveLinkedFolder('sub/dir', win), 'C:\\Users\\u\\vault\\sub\\dir');
});

test('file:// URLs', () => {
	assert.equal(fromFileUrl('file:///home/u/My%20Docs'), '/home/u/My Docs');
	assert.equal(fromFileUrl('file:///C:/Work'), 'C:/Work');
	assert.equal(fromFileUrl('file://localhost/tmp'), '/tmp');
	assert.equal(fromFileUrl('/plain/path'), '/plain/path');
	assert.equal(resolveLinkedFolder('file:///srv/a%20b', posix), '/srv/a b');
	assert.equal(resolveLinkedFolder('file:///D:/Work', win), 'D:\\Work');
});

test('toStoredValue keeps vault folders relative, others absolute', () => {
	assert.equal(toStoredValue('/home/u/vault/files/acme', posix), 'files/acme');
	assert.equal(toStoredValue('/home/u/vault', posix), '.');
	assert.equal(toStoredValue('/home/u/vault-other', posix), '/home/u/vault-other');
	assert.equal(toStoredValue('/srv/acme', posix), '/srv/acme');
	assert.equal(toStoredValue('C:\\Users\\u\\vault\\a\\b', win), 'a/b');
	assert.equal(toStoredValue('D:\\Work', win), 'D:\\Work');
	// round trip
	for (const p of ['/home/u/vault/x/y', '/srv/z']) {
		assert.equal(resolveLinkedFolder(toStoredValue(p, posix), posix), p);
	}
});

test('isInside', () => {
	assert.equal(isInside('/a', '/a/b', path.posix), true);
	assert.equal(isInside('/a', '/a', path.posix), true);
	assert.equal(isInside('/a', '/ab', path.posix), false);
	assert.equal(isInside('C:\\a', 'D:\\a', path.win32), false);
});

test('sortEntries: hidden filter, folders first, natural order', () => {
	const e = (name: string, isDirectory = false) => ({ name, fullPath: '/x/' + name, isDirectory });
	const input = [e('file10.txt'), e('.git', true), e('b', true), e('file2.txt'), e('A', true), e('.env')];
	assert.deepEqual(
		sortEntries(input, { showHidden: false, foldersFirst: true }).map((x) => x.name),
		['A', 'b', 'file2.txt', 'file10.txt'],
	);
	assert.deepEqual(
		sortEntries(input, { showHidden: true, foldersFirst: false }).map((x) => x.name),
		['.env', '.git', 'A', 'b', 'file2.txt', 'file10.txt'],
	);
});
