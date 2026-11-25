import { App, PluginSettingTab, Setting, SettingDefinitionItem } from 'obsidian';
import type LinkedFolderPanePlugin from './main';

export interface LinkedFolderPaneSettings {
	propertyName: string;
	showHiddenFiles: boolean;
	foldersFirst: boolean;
}

export const DEFAULT_SETTINGS: LinkedFolderPaneSettings = {
	propertyName: 'linked-folder',
	showHiddenFiles: false,
	foldersFirst: true,
};

type SettingKey = keyof LinkedFolderPaneSettings;

export class LinkedFolderPaneSettingTab extends PluginSettingTab {
	plugin: LinkedFolderPanePlugin;

	constructor(app: App, plugin: LinkedFolderPanePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Kept for Obsidian older than 1.13.0 (minAppVersion is 1.7.2).
	 * On 1.13.0+ the app renders {@link getSettingDefinitions} instead.
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Property name')
			.setDesc('Frontmatter property that holds the folder path for a note. Absolute paths, ~ for your home folder, or paths relative to the vault root.')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.propertyName)
					.setValue(this.plugin.settings.propertyName)
					.onChange(async (value) => {
						this.plugin.settings.propertyName = value.trim() || DEFAULT_SETTINGS.propertyName;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Show hidden files')
			.setDesc('Show files and folders whose names start with a dot.')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showHiddenFiles).onChange(async (value) => {
					this.plugin.settings.showHiddenFiles = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Folders first')
			.setDesc('List subfolders before files.')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.foldersFirst).onChange(async (value) => {
					this.plugin.settings.foldersFirst = value;
					await this.plugin.saveSettings();
				}),
			);
	}

	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		return [
			{
				name: 'Property name',
				desc: 'Frontmatter property that holds the folder path for a note. Absolute paths, ~ for your home folder, or paths relative to the vault root.',
				control: {
					type: 'text',
					key: 'propertyName',
					placeholder: DEFAULT_SETTINGS.propertyName,
				},
			},
			{
				name: 'Show hidden files',
				desc: 'Show files and folders whose names start with a dot.',
				control: {
					type: 'toggle',
					key: 'showHiddenFiles',
				},
			},
			{
				name: 'Folders first',
				desc: 'List subfolders before files.',
				control: {
					type: 'toggle',
					key: 'foldersFirst',
				},
			},
		];
	}

	/** Persist through saveSettings() so the open pane refreshes, matching display(). */
	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'propertyName') {
			const raw = typeof value === 'string' ? value.trim() : '';
			this.plugin.settings.propertyName = raw || DEFAULT_SETTINGS.propertyName;
		} else if (key === 'showHiddenFiles') {
			if (typeof value !== 'boolean') return;
			this.plugin.settings.showHiddenFiles = value;
		} else if (key === 'foldersFirst') {
			if (typeof value !== 'boolean') return;
			this.plugin.settings.foldersFirst = value;
		} else {
			return;
		}
		await this.plugin.saveSettings();
	}
}
