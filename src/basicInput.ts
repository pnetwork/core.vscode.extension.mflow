import { window, Uri, OpenDialogOptions, InputBoxOptions, Terminal, OutputChannel, QuickPickItem } from "vscode";
import child from "child_process";

const TERMINAL_NAME = "Trek Terminal";

/**
 * Create input box.
 * @param desc: the description in input box prompt.
 * @param example: the example in input box placeHolder.
 * @param validateFunc: validate input text function.
 */
export async function createInputBox(
    desc: string,
    example?: string,
    validateFunc?: (text: string) => string | undefined
): Promise<string | undefined> {
    if (!desc) throw Error("InputBox prompt cannot be empty");
    const options: InputBoxOptions = {
        prompt: desc,
        placeHolder: example,
        validateInput: validateFunc
    };
    const result = await window.showInputBox(options);
    return result;
}

/**
 * Create quick pick.
 * @param quickPickItems: quick pick items.
 * @param onSelectFunc: on select item function.
 */
export async function createQuickPick(
    quickPickItems: any[],
    onSelectFunc: (selection: QuickPickItem) => void
): Promise<void> {
    if (!quickPickItems) throw Error("QuickPickItems cannot be empty");
    const quickPick = window.createQuickPick();
    quickPick.items = quickPickItems;
    quickPick.onDidChangeSelection(async selection => {
        if (selection[0]) await onSelectFunc(selection[0]);
    });
    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
}

/**
 * Create browse foldor.
 * @param defaultUri: Browse folder default uri.
 */
export async function createBrowseFolder(defaultUri?: Uri): Promise<Uri | undefined> {
    const browseOptions: OpenDialogOptions = {
        defaultUri: defaultUri || undefined,
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: "Select"
    };

    const folderUri = await window.showOpenDialog(browseOptions);
    if (folderUri && folderUri[0]) return folderUri[0];
}

/**
 * Execute command callback function
 * @param execFunc: execute call back function after log result on TrekOuputChannel.
 * @param trekOuputChannel: the output channel of Trek.
 */
export function execCommandCallback(
    execFunc: (stdout?: string) => void,
    trekOuputChannel?: OutputChannel
): (error: child.ExecException | null, stdout: string, stderr: string) => void {
    return function(error: child.ExecException | null, stdout: string, stderr: string): void {
        if (error) {
            console.log(error);
            throw error;
        }
        if (stderr) {
            if (trekOuputChannel) trekOuputChannel.appendLine(stderr);
        } else if (stdout) {
            if (trekOuputChannel) trekOuputChannel.appendLine(stdout);
            execFunc(stdout);
        }
    };
}

/**
 * Get or create terminal
 */
export function activeTrekTerminal(): Terminal {
    let terminal = window.activeTerminal;
    if (!(terminal && terminal.name.startsWith(TERMINAL_NAME))) {
        const terminals = window.terminals.filter(x => x.name.startsWith(TERMINAL_NAME));
        terminal = terminals.length > 0 ? terminals[0] : window.createTerminal(TERMINAL_NAME);
    }
    return terminal;
}
