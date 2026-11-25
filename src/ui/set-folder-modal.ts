import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import type LinkedFolderPanePlugin from '../main';
import { existsSync, statSync } from '../utils/node';
import { resolveLinkedFolder, toStoredValue } from '../utils/paths';
import { canPickFolder, pickFolder } from '../utils/system';

/** Modal to type, paste, or pick the linked folder for a note. */
export class SetFolderModal extends Modal {
	private plugin: LinkedFolderPanePlugin;
	private file: TFile;
	private value: string;

	constructor(app: App, plugin: LinkedFolderPanePlugin, file: TFile) {
		super(app);
		this.plugin = plugin;
		this.file = file;
		this.value = plugin.getLinkedFolder(file)?.raw ?? '';
	}

	onOpen(): void {
		const { contentEl } = this;
		this.setTitle(`Linked folder for "${this.file.basename}"`);

		let input: HTMLInputElement | null = null;
		const pathSetting = new Setting(contentEl)
			.setName('Folder path')
			.setDesc('Absolute path, ~ for your home folder, or a path relative to the vault root.')
			.addText((text) => {
				input = text.inputEl;
				text.setPlaceholder('/path/to/folder').setValue(this.value).onChange((v) => {
					this.value = v;
				});
				text.inputEl.addClass('linked-folder-pane-input');
				text.inputEl.addEventListener('keydown', (evt) => {
					if (evt.key === 'Enter') {
						evt.preventDefault();
						void this.save();
					}
				});
			});

		if (canPickFolder()) {
			pathSetting.addButton((btn) =>
				btn.setButtonText('Browse').onClick(async () => {
					const ctx = this.plugin.getResolveContext();
					const current = ctx ? resolveLinkedFolder(this.value, ctx) : null;
					const picked = await pickFolder(current ?? undefined);
					if (!picked) return;
					this.value = ctx ? toStoredValue(picked, ctx) : picked;
					if (input) input.value = this.value;
				}),
			);
		}

		new Setting(contentEl)
			.addButton((btn) => btn.setButtonText('Save').setCta().onClick(() => void this.save()))
			.addButton((btn) =>
				btn.setButtonText('Remove').onClick(async () => {
					await this.write(null);
					this.close();
				}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async save(): Promise<void> {
		const value = this.value.trim();
		if (!value) {
			await this.write(null);
			this.close();
			return;
		}
		const ctx = this.plugin.getResolveContext();
		const abs = ctx ? resolveLinkedFolder(value, ctx) : null;
		if (abs) {
			const stat = existsSync(abs) ? statSync(abs) : null;
			if (!stat || !stat.isDirectory()) {
				new Notice('Saved, but that folder does not exist yet.');
			}
		}
		await this.write(value);
		this.close();
	}

	private async write(value: string | null): Promise<void> {
		const prop = this.plugin.settings.propertyName;
		await this.app.fileManager.processFrontMatter(this.file, (fm: Record<string, unknown>) => {
			if (value === null) delete fm[prop];
			else fm[prop] = value;
		});
	}
}
