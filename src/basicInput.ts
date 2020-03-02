import { window, OpenDialogOptions, InputBoxOptions, Terminal, OutputChannel, QuickPickItem } from "vscode";
import child from "child_process";

const TERMINAL_NAME = "mflow Terminal";

/**
 * Create input box.
 * @param desc: the description in input box prompt.
 * @param example: the example in input box placeHolder.
 */
export async function createInputBox(desc: string, example?: string): Promise<string | undefined> {
    if (!desc) throw Error("InputBox prompt cannot be empty");
    const options: InputBoxOptions = {
        prompt: desc,
        placeHolder: example
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
 */
export async function createBrowseFolder(): Promise<string | undefined> {
    const browseOptions: OpenDialogOptions = {
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: "Select"
    };

    const folderUri = await window.showOpenDialog(browseOptions);
    if (folderUri && folderUri[0]) return folderUri[0].fsPath;
}

/**
 * Execute command callback function
 * @param execFunc: execute call back function after log result on mflowOuputChannel.
 * @param mflowOuputChannel: the output channel of mflow.
 */
export function execCommandCallback(
    execFunc: (stdout?: string) => void,
    mflowOuputChannel?: OutputChannel
): (error: child.ExecException | null, stdout: string, stderr: string) => void {
    return function(error: child.ExecException | null, stdout: string, stderr: string): void {
        if (error) {
            console.log(error);
            throw error;
        }
        if (stderr) {
            if (mflowOuputChannel) mflowOuputChannel.appendLine(stderr);
        } else if (stdout) {
            if (mflowOuputChannel) mflowOuputChannel.appendLine(stdout);
            execFunc(stdout);
        }
    };
}

/**
 * Get or create terminal
 */
export function activeMflowTerminal(): Terminal {
    let terminal = window.activeTerminal;
    if (!(terminal && terminal.name.startsWith(TERMINAL_NAME))) {
        const terminals = window.terminals.filter(x => x.name.startsWith(TERMINAL_NAME));
        terminal = terminals.length > 0 ? terminals[0] : window.createTerminal(TERMINAL_NAME);
    }
    return terminal;
}
