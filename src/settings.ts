import { App, PluginSettingTab, Setting } from 'obsidian';
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

export class LinkedFolderPaneSettingTab extends PluginSettingTab {
	plugin: LinkedFolderPanePlugin;

	constructor(app: App, plugin: LinkedFolderPanePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

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
}
