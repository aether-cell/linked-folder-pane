import { FileSystemAdapter, Plugin, TFile } from 'obsidian';
import * as os from 'os';
import * as path from 'path';
import { registerCommands } from './commands';
import { DEFAULT_SETTINGS, LinkedFolderPaneSettings, LinkedFolderPaneSettingTab } from './settings';
import { LinkedFolderView, VIEW_TYPE_LINKED_FOLDER } from './ui/folder-view';
import { readFolderValue, resolveLinkedFolder, ResolveContext } from './utils/paths';

export interface LinkedFolderInfo {
	/** The raw string from the note's frontmatter. */
	raw: string;
	/** The resolved absolute path. */
	absolute: string;
}

export default class LinkedFolderPanePlugin extends Plugin {
	settings!: LinkedFolderPaneSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_LINKED_FOLDER, (leaf) => new LinkedFolderView(leaf, this));
		this.addRibbonIcon('folder-symlink', 'Open linked folder pane', () => {
			void this.activateView();
		});
		registerCommands(this);
		this.addSettingTab(new LinkedFolderPaneSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on('file-open', () => this.refreshViews()));
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (file === this.app.workspace.getActiveFile()) this.refreshViews();
			}),
		);
		this.registerEvent(
			this.app.vault.on('rename', (file) => {
				if (file === this.app.workspace.getActiveFile()) this.refreshViews();
			}),
		);
		this.app.workspace.onLayoutReady(() => this.refreshViews());
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<LinkedFolderPaneSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshViews(true);
	}

	/** Path context for resolving frontmatter values, or null if the vault is not on a local disk. */
	getResolveContext(): ResolveContext | null {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) return null;
		return { vaultRoot: adapter.getBasePath(), homeDir: os.homedir(), path };
	}

	/** Linked folder for a note, or null if the note has no usable property. */
	getLinkedFolder(file: TFile | null): LinkedFolderInfo | null {
		if (!file || file.extension !== 'md') return null;
		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
		const value: unknown = fm?.[this.settings.propertyName];
		const raw = readFolderValue(value);
		const ctx = this.getResolveContext();
		if (!raw || !ctx) return null;
		const absolute = resolveLinkedFolder(raw, ctx);
		return absolute ? { raw, absolute } : null;
	}

	/** Ask every open pane to re-read the active note. */
	refreshViews(force = false) {
		const file = this.app.workspace.getActiveFile();
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_LINKED_FOLDER)) {
			const view = leaf.view;
			if (view instanceof LinkedFolderView) view.setNote(file, force);
		}
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_LINKED_FOLDER)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			if (!leaf) return;
			await leaf.setViewState({ type: VIEW_TYPE_LINKED_FOLDER, active: true });
		}
		await workspace.revealLeaf(leaf);
		this.refreshViews();
	}
}
