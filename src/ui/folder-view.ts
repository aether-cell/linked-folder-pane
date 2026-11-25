import { ItemView, Menu, Notice, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import type LinkedFolderPanePlugin from '../main';
import { FolderEntry, readFolder } from '../utils/listing';
import { type FSWatcher, watch } from '../utils/node';
import { openWithDefaultApp, revealInFileManager } from '../utils/system';
import { SetFolderModal } from './set-folder-modal';

export const VIEW_TYPE_LINKED_FOLDER = 'linked-folder-pane';

/** Entries shown per folder level before collapsing the rest into a single row. */
const MAX_ENTRIES_PER_LEVEL = 500;
const REFRESH_DEBOUNCE_MS = 250;

export class LinkedFolderView extends ItemView {
	private plugin: LinkedFolderPanePlugin;
	private file: TFile | null = null;
	private folder: string | null = null;
	private raw: string | null = null;
	private expanded = new Set<string>();
	private watchers = new Map<string, FSWatcher>();
	private refreshTimer: number | null = null;
	private renderToken = 0;

	constructor(leaf: WorkspaceLeaf, plugin: LinkedFolderPanePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_LINKED_FOLDER;
	}

	getDisplayText(): string {
		return 'Linked folder';
	}

	getIcon(): string {
		return 'folder-symlink';
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass('linked-folder-pane');
		this.setNote(this.app.workspace.getActiveFile(), true);
	}

	async onClose(): Promise<void> {
		this.stopWatching();
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
		this.refreshTimer = null;
	}

	/**
	 * Point the pane at a note. A null file (for example when the pane itself
	 * is focused or a non-note is open) keeps the last note.
	 */
	setNote(file: TFile | null, force = false): void {
		if (file && file.extension !== 'md') file = null;
		const nextFile = file ?? this.file;
		const info = this.plugin.getLinkedFolder(nextFile);
		const nextFolder = info?.absolute ?? null;
		const changed = nextFile !== this.file || nextFolder !== this.folder || info?.raw !== this.raw;
		if (!changed && !force) return;
		if (nextFolder !== this.folder) this.expanded.clear();
		this.file = nextFile;
		this.folder = nextFolder;
		this.raw = info?.raw ?? null;
		void this.render();
	}

	private scheduleRefresh(): void {
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			void this.render();
		}, REFRESH_DEBOUNCE_MS);
	}

	private stopWatching(): void {
		for (const w of this.watchers.values()) w.close();
		this.watchers.clear();
	}

	/** Watch exactly the folders currently on screen (root + expanded subfolders). */
	private syncWatchers(folders: Set<string>): void {
		for (const [dir, w] of this.watchers) {
			if (!folders.has(dir)) {
				w.close();
				this.watchers.delete(dir);
			}
		}
		for (const dir of folders) {
			if (this.watchers.has(dir)) continue;
			try {
				const w: FSWatcher = watch(dir, { persistent: false }, () => this.scheduleRefresh());
				w.on('error', () => {
					w.close();
					this.watchers.delete(dir);
					this.scheduleRefresh();
				});
				this.watchers.set(dir, w);
			} catch {
				// Folder vanished between listing and watching; the next refresh will show it.
			}
		}
	}

	private async render(): Promise<void> {
		const token = ++this.renderToken;
		const root = this.contentEl;
		const opts = {
			showHidden: this.plugin.settings.showHiddenFiles,
			foldersFirst: this.plugin.settings.foldersFirst,
		};

		const container = createDiv({ cls: 'linked-folder-pane-inner' });
		this.renderHeader(container);

		const watched = new Set<string>();

		if (!this.file) {
			this.renderEmpty(container, 'Open a note to see its linked folder.');
		} else if (!this.plugin.getResolveContext()) {
			this.renderEmpty(container, 'This vault is not stored on a local disk.');
		} else if (!this.folder) {
			this.renderEmpty(
				container,
				`This note has no linked folder. Add a "${this.plugin.settings.propertyName}" property or choose a folder.`,
				true,
			);
		} else {
			const state = await readFolder(this.folder, opts);
			if (token !== this.renderToken) return;
			if (state.kind === 'ok') {
				watched.add(this.folder);
				const list = container.createDiv({ cls: 'linked-folder-pane-tree', attr: { role: 'tree' } });
				if (state.entries.length === 0) {
					list.createDiv({ cls: 'linked-folder-pane-message', text: 'This folder is empty.' });
				}
				await this.renderEntries(list, state.entries, 0, opts, watched, token);
				if (token !== this.renderToken) return;
			} else if (state.kind === 'missing') {
				this.renderProblem(container, 'Folder not found. It may have been moved, renamed, or be on a drive that is not connected.');
			} else if (state.kind === 'not-a-folder') {
				this.renderProblem(container, 'This path points to a file, not a folder.');
			} else {
				this.renderProblem(container, `Could not read folder: ${state.message}`);
			}
		}

		if (token !== this.renderToken) return;
		const scroll = root.scrollTop;
		root.empty();
		root.appendChild(container);
		root.scrollTop = scroll;
		this.syncWatchers(watched);
	}

	private renderHeader(container: HTMLElement): void {
		const header = container.createDiv({ cls: 'linked-folder-pane-header' });
		const title = header.createDiv({ cls: 'linked-folder-pane-title' });
		title.setText(this.file ? this.file.basename : 'No note');
		if (this.folder) {
			header.createDiv({ cls: 'linked-folder-pane-path', text: this.folder, attr: { title: this.folder } });
		}

		const actions = header.createDiv({ cls: 'linked-folder-pane-actions' });
		this.addHeaderButton(actions, 'refresh-cw', 'Refresh', () => void this.render());
		if (this.file) {
			this.addHeaderButton(actions, 'folder-pen', 'Set linked folder', () => this.openSetModal());
		}
		if (this.folder) {
			const folder = this.folder;
			this.addHeaderButton(actions, 'external-link', 'Open folder in system file manager', () => void this.open(folder));
		}
	}

	private addHeaderButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): void {
		const btn = parent.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': label } });
		setIcon(btn, icon);
		btn.addEventListener('click', onClick);
	}

	private renderEmpty(container: HTMLElement, message: string, offerChoose = false): void {
		const box = container.createDiv({ cls: 'linked-folder-pane-message' });
		box.createDiv({ text: message });
		if (offerChoose && this.file) {
			const btn = box.createEl('button', { text: 'Choose folder', cls: 'mod-cta' });
			btn.addEventListener('click', () => this.openSetModal());
		}
	}

	private renderProblem(container: HTMLElement, message: string): void {
		const box = container.createDiv({ cls: 'linked-folder-pane-message linked-folder-pane-problem' });
		box.createDiv({ text: message });
		const row = box.createDiv({ cls: 'linked-folder-pane-buttons' });
		row.createEl('button', { text: 'Retry' }).addEventListener('click', () => void this.render());
		if (this.file) {
			row.createEl('button', { text: 'Change folder' }).addEventListener('click', () => this.openSetModal());
		}
	}

	private async renderEntries(
		parent: HTMLElement,
		entries: FolderEntry[],
		depth: number,
		opts: { showHidden: boolean; foldersFirst: boolean },
		watched: Set<string>,
		token: number,
	): Promise<void> {
		const shown = entries.slice(0, MAX_ENTRIES_PER_LEVEL);
		for (const entry of shown) {
			if (token !== this.renderToken) return;
			const isOpen = entry.isDirectory && this.expanded.has(entry.fullPath);
			this.renderRow(parent, entry, depth, isOpen);
			if (isOpen) {
				const child = await readFolder(entry.fullPath, opts);
				if (child.kind === 'ok') {
					watched.add(entry.fullPath);
					if (child.entries.length === 0) {
						this.renderNote(parent, 'Empty', depth + 1);
					}
					await this.renderEntries(parent, child.entries, depth + 1, opts, watched, token);
				} else {
					this.renderNote(parent, child.kind === 'error' ? child.message : 'Not available', depth + 1);
				}
			}
		}
		if (entries.length > shown.length) {
			this.renderNote(parent, `${entries.length - shown.length} more items not shown`, depth);
		}
	}

	private renderNote(parent: HTMLElement, text: string, depth: number): void {
		const row = parent.createDiv({ cls: 'linked-folder-pane-row linked-folder-pane-note', text });
		row.setCssProps({ '--lfp-depth': String(depth) });
	}

	private renderRow(parent: HTMLElement, entry: FolderEntry, depth: number, isOpen: boolean): void {
		const row = parent.createDiv({
			cls: 'linked-folder-pane-row tree-item-self is-clickable',
			attr: { role: 'treeitem', tabindex: '0', title: entry.fullPath },
		});
		row.setCssProps({ '--lfp-depth': String(depth) });
		if (entry.isDirectory) row.setAttr('aria-expanded', String(isOpen));

		const icon = row.createSpan({ cls: 'linked-folder-pane-icon' });
		setIcon(icon, entry.isDirectory ? (isOpen ? 'folder-open' : 'folder') : 'file');
		row.createSpan({ cls: 'linked-folder-pane-name', text: entry.name });

		const activate = () => {
			if (entry.isDirectory) {
				if (this.expanded.has(entry.fullPath)) this.expanded.delete(entry.fullPath);
				else this.expanded.add(entry.fullPath);
				void this.render();
			} else {
				void this.open(entry.fullPath);
			}
		};
		row.addEventListener('click', activate);
		row.addEventListener('keydown', (evt) => {
			if (evt.key === 'Enter' || evt.key === ' ') {
				evt.preventDefault();
				activate();
			}
		});
		row.addEventListener('contextmenu', (evt) => {
			const menu = new Menu();
			menu.addItem((item) =>
				item
					.setTitle('Open with default app')
					.setIcon('external-link')
					.onClick(() => void this.open(entry.fullPath)),
			);
			menu.addItem((item) =>
				item
					.setTitle('Reveal in system file manager')
					.setIcon('folder-search')
					.onClick(() => revealInFileManager(entry.fullPath)),
			);
			menu.addItem((item) =>
				item
					.setTitle('Copy path')
					.setIcon('copy')
					.onClick(() => void navigator.clipboard.writeText(entry.fullPath)),
			);
			menu.showAtMouseEvent(evt);
		});
	}

	private async open(fullPath: string): Promise<void> {
		const err = await openWithDefaultApp(fullPath);
		if (err) new Notice(`Could not open: ${err}`);
	}

	private openSetModal(): void {
		if (this.file) new SetFolderModal(this.app, this.plugin, this.file).open();
	}
}
