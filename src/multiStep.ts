import { window, Uri } from "vscode";
import { MultiStepInput, InputStep } from "./basicMultiStepInput";
import { createBrowseFolder } from "./basicInput";
import { PackTypes } from "./basicCliComands";
import { TrekCommand } from "./commands";
import { getConfigProperty, ScriptTypes } from "./util";
import path from "path";

/**
 * Multiple step types.
 */
export enum MultiStepTypes {
    CREATE_PROJECT,
    CREATE_SCRIPT,
    DEPLOY,
    LOGIN,
    RUNBLCKS
}

/**
 * Multi-step result.
 */
interface StepResult {
    isSuc: boolean;
    title: string;
    name: string;
    uri: Uri;
    yn: string;
    scriptType: ScriptTypes;
    type: PackTypes;
    password: string;
    eventPath: string;
}
const scriptNameReg = new RegExp("^[a-z0-9]+$");

/**
 * Verify input text is Y or N. (not case-sensitive)
 * @param input: Input text.
 */
function verifyYesorNo(input: string): boolean {
    input = input.toUpperCase();
    return input === "Y" || input === "N";
}

/**
 * A multi-step input using window.createQuickPick() and window.createInputBox().
 * This first part uses the helper class `MultiStepInput` that wraps the API for the multi-step case.
 * @param title: Window title.
 * @param multiStepType: MultiStepTypes.
 * @param trekCmd: Trek command obj.
 */
export async function multiStepInput(
    title: string,
    multiStepType: MultiStepTypes,
    trekCmd: TrekCommand,
    isWorkflowProject?: boolean,
    scriptType?: ScriptTypes
): Promise<StepResult> {
    async function askInputEvent(input: MultiStepInput, step: Partial<StepResult>): Promise<void> {
        const inputEventPath = getConfigProperty("input_event_path");
        step.eventPath = await input.showInputBox({
            title,
            step: 2,
            totalSteps: 2,
            value: inputEventPath,
            prompt: "Please enter the event data path for running Blcks."
        });
    }
    async function askOpenWorkspace(input: MultiStepInput, step: Partial<StepResult>): Promise<void> {
        step.yn = await input.showInputBox({
            title,
            step: 3,
            totalSteps: 3,
            value: step.yn || "",
            prompt: "Open blcks project in new window?",
            placeHolder: "Y/N",
            validate: text => (!verifyYesorNo(text) ? "Input value should be Y or N." : undefined)
        });
    }
    async function selectBlcks(input: MultiStepInput, step: Partial<StepResult>): Promise<InputStep> {
        const items = trekCmd?.getBlcksQuickPickItems() || [];
        const scriptSelect = await input.showQuickPick({
            title,
            step: 1,
            totalSteps: 2,
            items: items,
            activeItem: undefined,
            value: step.name || undefined
        });
        step.name = scriptSelect.label;
        step.uri = Uri.parse(scriptSelect.detail);
        step.scriptType = scriptSelect.description;
        return (input: MultiStepInput): Promise<void> => askInputEvent(input, step);
    }
    async function askCreateSample(input: MultiStepInput, step: Partial<StepResult>): Promise<void> {
        step.yn = await input.showInputBox({
            title,
            step: 3,
            totalSteps: 3,
            value: step.yn || "",
            prompt: "Create a sample project?",
            placeHolder: "Y/N",
            validate: text => (!verifyYesorNo(text) ? "Input value should be Y or N." : undefined)
        });
    }
    async function inputProjectName(
        isScript: boolean,
        input: MultiStepInput,
        step: Partial<StepResult>
    ): Promise<InputStep> {
        if (isScript) {
            step.name = await input.showInputBox({
                title,
                step: 2,
                totalSteps: 3,
                value: step.name || "",
                prompt: "Please enter project name: ",
                validate: text =>
                    !scriptNameReg.test(text)
                        ? "Script name should be number(0-9) or lowercase letter(a-z)."
                        : undefined
            });
        } else {
            step.name = await input.showInputBox({
                title,
                step: 2,
                totalSteps: 3,
                value: step.name || "",
                prompt: "Please enter project name:"
            });
        }

        return (input: MultiStepInput): Promise<void> =>
            isScript ? askOpenWorkspace(input, step) : askCreateSample(input, step);
    }
    async function selectLocation(
        isScript: boolean,
        input: MultiStepInput,
        step: Partial<StepResult>
    ): Promise<InputStep> {
        const items = [{ label: "$(file-directory) Browse...", value: "0", description: "(recently used)" }];
        if (step.uri) items.push({ label: step.uri.fsPath, value: "1", description: "(selected)" });
        const pick = await input.showQuickPick({
            title,
            step: 1,
            totalSteps: 3,
            placeholder: "Select project location",
            items: items,
            activeItem: undefined,
            value: step.uri?.fsPath || undefined
        });
        const defaultUri = pick.value === "1" ? Uri.parse(pick.label) : undefined;
        if (pick.value !== "1") {
            const folderUri = await createBrowseFolder(defaultUri);
            if (!folderUri) {
                return (input: MultiStepInput): Promise<InputStep> => selectLocation(isScript, input, step);
            }
            step.uri = folderUri;
        }
        return (input: MultiStepInput): Promise<InputStep> => inputProjectName(isScript, input, step);
    }

    async function askOverwrite(input: MultiStepInput, step: Partial<StepResult>): Promise<void> {
        step.yn = await input.showInputBox({
            title,
            step: 3,
            totalSteps: 3,
            value: step.yn || "",
            prompt: "Overwrite existing scripts on Marvin ? ",
            placeHolder: "Y/N",
            validate: text => (!verifyYesorNo(text) ? "Input value should be Y or N." : undefined)
        });
    }

    async function selectScript(input: MultiStepInput, step: Partial<StepResult>): Promise<InputStep> {
        const items = trekCmd?.getScriptQuickPickItems() || [];
        const scriptSelect = await input.showQuickPick({
            title,
            step: 2,
            totalSteps: 3,
            items: items,
            activeItem: undefined,
            value: step.name || undefined
        });
        step.name = scriptSelect.label;
        step.uri = Uri.parse(scriptSelect.detail);
        step.scriptType = scriptSelect.description;
        return (input: MultiStepInput): Promise<void> => askOverwrite(input, step);
    }

    async function selectTarget(input: MultiStepInput, step: Partial<StepResult>): Promise<InputStep> {
        const items = Object.values(PackTypes).map(label => ({ label }));
        const result = await input.showQuickPick({
            title,
            step: 1,
            totalSteps: 3,
            items: items,
            activeItem: undefined,
            value: step.type || undefined
        });
        step.type = result ? result.label : "";
        if (step.type === PackTypes.SCRIPT) {
            return (input: MultiStepInput): Promise<InputStep> => selectScript(input, step);
        } else {
            return (input: MultiStepInput): Promise<void> => askOverwrite(input, step);
        }
    }

    async function inputMarvinUrl(input: MultiStepInput, step: Partial<StepResult>): Promise<void> {
        let marvinUrl = getConfigProperty("marvin_url");
        marvinUrl = await input.showInputBox({
            title,
            step: 3,
            totalSteps: 3,
            value: marvinUrl,
            prompt: "Please enter a marvin url?"
        });
        step.uri = Uri.parse(marvinUrl);
    }

    async function inputPassword(input: MultiStepInput, step: Partial<StepResult>): Promise<InputStep> {
        step.password = await input.showInputBox({
            title,
            step: 2,
            totalSteps: 3,
            value: step.password || "",
            prompt: "Please enter password: ",
            password: true
        });
        return (input: MultiStepInput): Promise<void> => inputMarvinUrl(input, step);
    }

    async function inputUserName(input: MultiStepInput, step: Partial<StepResult>): Promise<InputStep> {
        step.name = await input.showInputBox({
            title,
            step: 1,
            totalSteps: 3,
            value: step.name || "",
            prompt: "Please enter user name: "
        });
        return (input: MultiStepInput): Promise<InputStep> => inputPassword(input, step);
    }

    const result = {} as Partial<StepResult>;
    if (multiStepType === MultiStepTypes.CREATE_PROJECT) {
        await MultiStepInput.run(input => selectLocation(false, input, result));
        if (result.name && result.uri && result.yn) {
            result.title = title;
            result.isSuc = true;
            window.showInformationMessage(`Creating ${scriptType} Project '${result.name}'`);
        } else {
            result.isSuc = false;
        }
    } else if (multiStepType === MultiStepTypes.CREATE_SCRIPT) {
        if (isWorkflowProject) {
            await MultiStepInput.run(input => inputProjectName(true, input, result));
            result.uri = Uri.parse(path.join(trekCmd.rootPath));
        } else {
            await MultiStepInput.run(input => selectLocation(true, input, result));
        }
        if (result.name && result.uri && result.yn) {
            result.title = title;
            result.isSuc = true;
            window.showInformationMessage(`Creating Trek Project '${result.name}'`);
        } else {
            result.isSuc = false;
        }
    } else if (multiStepType === MultiStepTypes.DEPLOY) {
        await MultiStepInput.run(input => selectTarget(input, result));
        if (result.type && result.yn) {
            result.title = title;
            result.isSuc = true;
            window.showInformationMessage(`Deploy Trek Project to Marvin`);
        } else {
            result.isSuc = false;
        }
    } else if (multiStepType === MultiStepTypes.LOGIN) {
        await MultiStepInput.run(input => inputUserName(input, result));
        if (result.name && result.password && result.uri) {
            result.title = title;
            result.isSuc = true;
            window.showInformationMessage(`Login to Marvin.`);
        } else {
            result.isSuc = false;
        }
    } else if (multiStepType === MultiStepTypes.RUNBLCKS) {
        await MultiStepInput.run(input => selectBlcks(input, result));
        if (result.uri && result.eventPath) {
            result.title = title;
            result.isSuc = true;
            window.showInformationMessage(`Run Blcks Project`);
        } else {
            result.isSuc = false;
        }
    }
    return result as StepResult;
}
