import { MarkdownView, Notice } from 'obsidian';
import type LinkedFolderPanePlugin from './main';
import { SetFolderModal } from './ui/set-folder-modal';
import { openWithDefaultApp } from './utils/system';

export function registerCommands(plugin: LinkedFolderPanePlugin) {
	plugin.addCommand({
		id: 'open-pane',
		name: 'Open pane',
		callback: () => {
			void plugin.activateView();
		},
	});

	plugin.addCommand({
		id: 'set-linked-folder',
		name: 'Set linked folder for current note',
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file;
			if (!file) return false;
			if (!checking) new SetFolderModal(plugin.app, plugin, file).open();
			return true;
		},
	});

	plugin.addCommand({
		id: 'remove-linked-folder',
		name: 'Remove linked folder from current note',
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file ?? null;
			if (!file || !plugin.getLinkedFolder(file)) return false;
			if (!checking) {
				const prop = plugin.settings.propertyName;
				void plugin.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
					delete fm[prop];
				});
			}
			return true;
		},
	});

	plugin.addCommand({
		id: 'open-linked-folder-in-system',
		name: 'Open linked folder in system file manager',
		checkCallback: (checking) => {
			const info = plugin.getLinkedFolder(plugin.app.workspace.getActiveFile());
			if (!info) return false;
			if (!checking) {
				void openWithDefaultApp(info.absolute).then((err) => {
					if (err) new Notice(`Could not open folder: ${err}`);
				});
			}
			return true;
		},
	});
}
