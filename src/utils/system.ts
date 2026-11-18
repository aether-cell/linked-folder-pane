/**
 * Thin wrapper around the Electron APIs available to desktop plugins.
 * The plugin is desktop-only (isDesktopOnly: true in the manifest).
 */
import * as electron from 'electron';

interface OpenDialogResult {
	canceled: boolean;
	filePaths: string[];
}

interface ElectronLike {
	shell?: {
		openPath(path: string): Promise<string>;
		showItemInFolder(path: string): void;
	};
	remote?: {
		dialog?: {
			showOpenDialog(options: {
				title?: string;
				defaultPath?: string;
				properties: string[];
			}): Promise<OpenDialogResult>;
		};
	};
}

const api = electron as unknown as ElectronLike;

/** Open a file or folder with the operating system's default app. Returns an error message, or '' on success. */
export async function openWithDefaultApp(fullPath: string): Promise<string> {
	if (!api.shell) return 'Opening files is not supported on this platform.';
	return api.shell.openPath(fullPath);
}

/** Show the item selected in the system file manager. */
export function revealInFileManager(fullPath: string): void {
	api.shell?.showItemInFolder(fullPath);
}

/** True if a native folder picker is available. */
export function canPickFolder(): boolean {
	return typeof api.remote?.dialog?.showOpenDialog === 'function';
}

/** Show a native folder picker. Resolves to the chosen folder, or null. */
export async function pickFolder(defaultPath?: string): Promise<string | null> {
	const dialog = api.remote?.dialog;
	if (!dialog) return null;
	const result = await dialog.showOpenDialog({
		title: 'Choose linked folder',
		defaultPath,
		properties: ['openDirectory', 'createDirectory'],
	});
	if (result.canceled || result.filePaths.length === 0) return null;
	return result.filePaths[0] ?? null;
}
