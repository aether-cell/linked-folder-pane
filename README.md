# Linked Folder Pane

See the files of a project folder on your disk right next to the note about that project.

Add one property to a note, for example:

```yaml
---
linked-folder: ~/Work/Acme website
---
```

The **Linked folder** pane in the sidebar then lists everything in that folder: office documents, source code, PDFs, images, anything. Files that you add or delete later show up or disappear on their own, so you never have to link each file by hand. Select a file to open it in its default app.

Your notes stay where they are and your files stay where they are. Nothing is copied, moved, or imported into the vault.

## Features

- One frontmatter property per note points to a folder anywhere on your disk.
- A sidebar pane that follows the active note.
- Live updates when files are added, removed, or renamed in the folder.
- Expand subfolders inline without leaving Obsidian.
- Select a file to open it in the default app for its type. Right-click for **Reveal in system file manager** and **Copy path**.
- A command to set the folder, with a native folder picker where available.
- Clear messages when a folder is missing (for example an unplugged drive), with **Retry** and **Change folder** buttons.

## Usage

1. Open the pane with the ribbon icon or the command **Linked Folder Pane: Open pane**.
2. Open a note and run **Linked Folder Pane: Set linked folder for current note**. Paste a path or select **Browse** to pick a folder. You can also type the property yourself in the note's properties.
3. The pane lists the folder's contents. Select a file to open it. Select a folder to expand it.

### Path formats

| Value | Resolves to |
|---|---|
| `/Users/me/Projects/Acme` or `D:\Projects\Acme` | That absolute path |
| `~/Projects/Acme` | A folder in your home folder |
| `Attachments/Acme` | A folder relative to the vault root |
| `file:///Users/me/Projects/Acme` | The decoded path |

If the property holds a list, the first entry is used. When you pick a folder inside the vault with **Browse**, the plugin stores it relative to the vault so it keeps working on other computers.

### Commands

- **Open pane**
- **Set linked folder for current note**
- **Remove linked folder from current note**
- **Open linked folder in system file manager**

### Settings

- **Property name**: the frontmatter property to read. Default: `linked-folder`.
- **Show hidden files**: show names that start with a dot. Default: off.
- **Folders first**: list subfolders before files. Default: on.

## Disclosures

- **Accesses files outside your vault.** This is the purpose of the plugin: it reads the list of files in the folder you set on a note, so you can see and open them from Obsidian. It only lists names in folders that you set yourself, and it only watches the folders currently shown in the pane. It never reads file contents, and it never writes, moves, or deletes anything outside the vault. Inside the vault, the only change it makes is to the note's property, and only when you use the set or remove commands.
- **No network use.** The plugin makes no network requests.
- **No telemetry.** Nothing is collected or sent anywhere.
- **No account or payment.**

## Limitations

- Desktop only. It uses Node.js file APIs that aren't available on mobile.
- Each level shows at most 500 entries. Very large folders are cut off with a note.
- Live updates use the operating system's file watcher. Some network drives and cloud-sync folders don't report changes reliably. Use the **Refresh** button in that case.
- Email is not supported.

## Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Copy them to `<your vault>/.obsidian/plugins/linked-folder-pane/`.
3. Reload Obsidian and turn on **Linked Folder Pane** in **Settings → Community plugins**.

## Development

```bash
npm install
npm run dev     # watch build
npm run build   # type-check and production build
npm run lint
npm test        # unit tests for path resolution (Node 22.6+ or 24)
```

## License

[MIT](LICENSE)
