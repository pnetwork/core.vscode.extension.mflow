/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

import { window, OpenDialogOptions, InputBoxOptions, Terminal, workspace, OutputChannel, QuickPickItem } from "vscode";
import * as child from "child_process";

/**
 * Create input box.
 * @param desc: the description in input box prompt.
 * @param example: the example in input box placeHolder.
 */
export async function createInputBox(desc: string, example?: string): Promise<string | undefined> {
    const options: InputBoxOptions = {
        prompt: desc,
        placeHolder: example
    };
    const result = await window.showInputBox(options);
    return result;
}

/**
 * Create quick pick.
 * @param items: quick pick items.
 * @param onSelectFunc: on select item function.
 */
export async function createQuickPick(
    quickPickItems: any[],
    onSelectFunc: (selection: QuickPickItem) => void
): Promise<void> {
    const quickPick = window.createQuickPick();
    quickPick.items = quickPickItems;
    quickPick.onDidChangeSelection(async selection => {
        if (selection[0]) {
            await onSelectFunc(selection[0]);
        }
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

    if (folderUri && folderUri[0]) {
        return folderUri[0].fsPath;
    }
}

/**
 * Execute command callback function
 * @param mflowOuputChannel: the output channel of mflow.
 * @param execFunc: execute call back function after log result on mflowOuputChannel.
 */
export function execCommandCallback(
    mflowOuputChannel: OutputChannel,
    execFunc: (stdout?: string) => void
): (error: child.ExecException | null, stdout: string, stderr: string) => void {
    return function(error: child.ExecException | null, stdout: string, stderr: string): void {
        if (error) {
            console.log(error);
            throw error;
        }
        if (stderr) {
            mflowOuputChannel.appendLine(stderr);
        } else if (stdout) {
            mflowOuputChannel.appendLine(stdout);
            execFunc(stdout);
        }
    };
}

/**
 * Get MFlow path from setting
 */
export function getMFlowPath(): string {
    let mflowPath = workspace.getConfiguration().get<string>("mflow.path");
    if (!mflowPath) {
        mflowPath = "mflow";
    }
    return mflowPath;
}

/**
 * Get or create terminal
 */
export function activeTerminalwithConfig(): Terminal {
    let terminal = window.activeTerminal;
    if (!(terminal && terminal.name.startsWith("mflow Terminal"))) {
        terminal = window.createTerminal("mflow Terminal");
    }
    return terminal;
}
